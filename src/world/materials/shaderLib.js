import * as THREE from 'three'
import { U } from './globalUniforms'

// GLSL shared by the world's stylized materials, plus patchToon(), which upgrades
// three's MeshToonMaterial in place via onBeforeCompile. Patching the built-in material
// (instead of writing shaders from scratch) keeps everything three already does right —
// shadow maps, skinning, instancing, fog plumbing — and swaps only the parts that make
// the look: the light ramp, how shadows band, the rim light, and the fog colour.
//
// Pinned to three r185's shader chunks (CLAUDE.md pins three). If an upgrade renames a
// chunk, `replaceOrWarn` says so in development instead of silently doing nothing.

export const SKY_GLSL = /* glsl */ `
uniform vec3 uSkyZenith;
uniform vec3 uSkyUpper;
uniform vec3 uSkyHorizon;
uniform vec3 uSkyBelow;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uSunSize;
uniform float uSunGlow;

// Sky colour in a world-space direction. Used by the sky dome AND by fog, so a far-away
// hillside fades into exactly the sky that sits behind it, sun glow included.
vec3 skyGradient(vec3 dir) {
  float h = dir.y;
  vec3 col;
  if (h >= 0.0) {
    col = mix(uSkyHorizon, uSkyUpper, smoothstep(0.0, 0.3, pow(h, 0.75)));
    col = mix(col, uSkyZenith, smoothstep(0.3, 0.98, h));
  } else {
    col = mix(uSkyHorizon, uSkyBelow, smoothstep(0.0, 0.32, -h));
  }
  // A low sun spreads warm light along the horizon toward its side of the sky…
  vec2 sunAz = normalize(uSunDir.xz + vec2(1e-5));
  float az = max(dot(normalize(dir.xz + vec2(1e-5)), sunAz), 0.0);
  col += uSunColor * pow(az, 3.0) * exp(-abs(h) * 7.0) * 0.32 * uSunGlow;
  // …and glows around itself: a broad halo plus a tighter core.
  float s = max(dot(dir, uSunDir), 0.0);
  col += uSunColor * (pow(s, 5.0) * 0.3 + pow(s, 42.0) * 0.55) * uSunGlow;
  return col;
}
`

export const NOISE_GLSL = /* glsl */ `
uniform sampler2D uNoise;
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
`

const TOON_PARS = /* glsl */ `
varying vec3 vViewPosition;

struct ToonMaterial {
  vec3 diffuseColor;
};

uniform vec3 uToonShadow;
uniform vec3 uToonTerminator;
uniform vec3 uToonLit;
uniform float uToonThreshold;
uniform float uToonSoftness;
uniform float uToonTerminatorWidth;

// Shadow-map visibility of the key light for this fragment, filled in by the patched
// light loop (1 = lit, 0 = in shadow). Folding it into the ramp below makes cast shadows
// band exactly like form shadows — the crisp, flat look of anime backgrounds.
float toonShadow = 1.0;

// Three-tone ramp: cool shadow → warm terminator band → lit. fwidth() widens the
// transition by one pixel's worth of change, which anti-aliases the band edge at any
// distance without blurring it.
vec3 toonRamp(float x) {
  float aa = fwidth(x) * 1.2 + uToonSoftness;
  float lit = smoothstep(uToonThreshold - aa, uToonThreshold + aa, x);
  float band = smoothstep(uToonThreshold - uToonTerminatorWidth - aa, uToonThreshold - uToonTerminatorWidth * 0.25, x);
  vec3 c = mix(uToonShadow, uToonLit, lit);
  return mix(c, uToonTerminator, band * (1.0 - lit) * 0.55);
}

void RE_Direct_Toon(const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight) {
  float x = dot(geometryNormal, directLight.direction) * 0.5 + 0.5;
  // In a cast shadow, push the ramp coordinate below the threshold.
  x = min(x, mix(uToonThreshold - 0.2, 1.0, toonShadow));
  reflectedLight.directDiffuse += toonRamp(x) * directLight.color * BRDF_Lambert(material.diffuseColor);
}

void RE_IndirectDiffuse_Toon(const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight) {
  reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert(material.diffuseColor);
}

#define RE_Direct RE_Direct_Toon
#define RE_IndirectDiffuse RE_IndirectDiffuse_Toon
`

const RIM_GLSL = /* glsl */ `
uniform vec3 uRimColor;
uniform float uRimStrength;
uniform float uRimPower;
uniform vec4 uLanternLights[16];
uniform int uLanternCount;
uniform vec3 uLanternColor;
`

// Warm light from nearby lanterns (registered in systems/lanterns.js), added as emission
// with a wrapped N·L falloff. Skipped entirely in daylight (uLanterns ≈ 0).
const LANTERN_APPLY = /* glsl */ `
if (uLanterns > 0.02) {
  vec3 lanternSum = vec3(0.0);
  vec3 surfaceView = -vViewPosition;
  for (int i = 0; i < 16; i++) {
    if (i >= uLanternCount) break;
    vec3 toLight = uLanternLights[i].xyz - surfaceView;
    float dist = length(toLight);
    float reach = 1.0 - clamp(dist / uLanternLights[i].w, 0.0, 1.0);
    float wrap = clamp(dot(normal, toLight / max(dist, 1e-4)) * 0.6 + 0.45, 0.0, 1.0);
    lanternSum += vec3(reach * reach * wrap);
  }
  totalEmissiveRadiance += uLanternColor * lanternSum * uLanterns * diffuseColor.rgb * 2.4;
}
`

// Rim light, added as emission: brightest along silhouettes on the side that faces the
// key light, like a backlit edge. Tinted by the surface colour so it reads as light on
// the material, not a white outline.
const RIM_APPLY = /* glsl */ `
#if NUM_DIR_LIGHTS > 0
{
  vec3 rimView = normalize(vViewPosition);
  float rimFresnel = pow(1.0 - clamp(dot(normal, rimView), 0.0, 1.0), uRimPower);
  float rimSide = clamp(dot(normal, directionalLights[0].direction) * 0.6 + 0.5, 0.0, 1.0);
  totalEmissiveRadiance += uRimColor * rimFresnel * rimSide * uRimStrength * (0.35 + diffuseColor.rgb);
}
#endif
`

const FOG_PARS_VERTEX = /* glsl */ `
#ifdef USE_FOG
  varying vec3 vFogWorldPos;
#endif
`

const FOG_VERTEX = /* glsl */ `
#ifdef USE_FOG
{
  vec4 fogWorld = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    fogWorld = instanceMatrix * fogWorld;
  #endif
  vFogWorldPos = (modelMatrix * fogWorld).xyz;
}
#endif
`

const FOG_PARS_FRAGMENT = /* glsl */ `
#ifdef USE_FOG
  varying vec3 vFogWorldPos;
  uniform float uFogNear;
  uniform float uFogFar;
  uniform float uFogHeightFalloff;
#endif
`

// Aerial perspective: distance fog coloured by the sky in the view direction, thicker
// low down (toward the sea of clouds) and thinner high up.
const FOG_FRAGMENT = /* glsl */ `
#ifdef USE_FOG
{
  vec3 fogRay = vFogWorldPos - cameraPosition;
  float fogDist = length(fogRay);
  float fogAmount = smoothstep(uFogNear, uFogFar, fogDist);
  // 1 at and below the cloud sea, falling off with altitude above it.
  float heightFactor = clamp(exp(-max(vFogWorldPos.y + 6.0, 0.0) * uFogHeightFalloff), 0.0, 1.0);
  fogAmount *= mix(0.55, 1.0, heightFactor);
  gl_FragColor.rgb = mix(gl_FragColor.rgb, skyGradient(fogRay / max(fogDist, 1e-4)), fogAmount);
}
#endif
`

const isDev = import.meta.env.DEV

function replaceOrWarn(source, search, replacement, label) {
  if (!source.includes(search)) {
    if (isDev) console.warn(`[shaderLib] ${label}: "${search.slice(0, 48)}…" not found — three chunk changed?`)
    return source
  }
  return source.replace(search, replacement)
}

const DIR_SHADOW_LINE =
  'directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;'
const DIR_SHADOW_TOON =
  'toonShadow = ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;'

/** Every uniform patchToon may reference (merged into shader.uniforms). */
const TOON_UNIFORMS = [
  'uToonShadow',
  'uToonTerminator',
  'uToonLit',
  'uToonThreshold',
  'uToonSoftness',
  'uToonTerminatorWidth',
  'uRimColor',
  'uRimStrength',
  'uRimPower',
  'uSkyZenith',
  'uSkyUpper',
  'uSkyHorizon',
  'uSkyBelow',
  'uSunDir',
  'uSunColor',
  'uSunSize',
  'uSunGlow',
  'uFogNear',
  'uFogFar',
  'uFogHeightFalloff',
  'uTime',
  'uWindDir',
  'uWindStrength',
  'uNoise',
  'uCharacterPos',
  'uLanterns',
  'uLanternLights',
  'uLanternCount',
  'uLanternColor',
]

/**
 * Apply the world look to a MeshToonMaterial shader inside onBeforeCompile.
 * `opts.rim` (default true) adds the rim light; `opts.vertex` / `opts.fragment` let a
 * caller inject extra code (e.g. grass wind) — see their use sites.
 */
export function patchToon(shader, opts = {}) {
  for (const name of TOON_UNIFORMS) shader.uniforms[name] = U[name]
  Object.assign(shader.uniforms, opts.uniforms ?? {})

  let vs = shader.vertexShader
  vs = replaceOrWarn(vs, '#include <common>', `#include <common>\nuniform float uTime;\nuniform vec2 uWindDir;\nuniform float uWindStrength;\nuniform vec3 uCharacterPos;\n${NOISE_GLSL}\n${opts.vertexPars ?? ''}`, 'vs common')
  vs = replaceOrWarn(vs, '#include <fog_pars_vertex>', FOG_PARS_VERTEX, 'fog_pars_vertex')
  if (opts.vertex) vs = replaceOrWarn(vs, '#include <begin_vertex>', `#include <begin_vertex>\n${opts.vertex}`, 'begin_vertex')
  if (opts.normal) vs = replaceOrWarn(vs, '#include <beginnormal_vertex>', `#include <beginnormal_vertex>\n${opts.normal}`, 'beginnormal_vertex')
  vs = replaceOrWarn(vs, '#include <fog_vertex>', FOG_VERTEX, 'fog_vertex')
  shader.vertexShader = vs

  let fs = shader.fragmentShader
  fs = replaceOrWarn(fs, '#include <common>', `#include <common>\n${SKY_GLSL}\n${RIM_GLSL}\nuniform float uTime;\nuniform float uLanterns;\n${opts.fragmentPars ?? ''}`, 'fs common')
  fs = replaceOrWarn(fs, '#include <lights_toon_pars_fragment>', TOON_PARS, 'lights_toon_pars_fragment')
  fs = replaceOrWarn(
    fs,
    '#include <lights_fragment_begin>',
    THREE.ShaderChunk.lights_fragment_begin.includes(DIR_SHADOW_LINE)
      ? THREE.ShaderChunk.lights_fragment_begin.replace(DIR_SHADOW_LINE, DIR_SHADOW_TOON)
      : (isDev && console.warn('[shaderLib] directional shadow line not found'), '#include <lights_fragment_begin>'),
    'lights_fragment_begin',
  )
  if (opts.fragmentColor) fs = replaceOrWarn(fs, '#include <color_fragment>', `#include <color_fragment>\n${opts.fragmentColor}`, 'color_fragment')
  // Double-sided cards whose normals are authored (grass: straight up) must not have
  // them flipped for back faces, or every blade seen from behind would go dark.
  if (opts.keepNormals) fs = replaceOrWarn(fs, '#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = normalize(vNormal);', 'normal_fragment_maps')
  fs = replaceOrWarn(
    fs,
    'vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;',
    `${opts.rim === false ? '' : RIM_APPLY}\n${opts.lanterns === false ? '' : LANTERN_APPLY}\n${opts.emissive ?? ''}\nvec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;`,
    'outgoingLight',
  )
  // Opt out of the outline pass (it skips pixels with alpha < 1; nothing else reads it).
  if (opts.outline === false) {
    fs = replaceOrWarn(fs, '#include <opaque_fragment>', '#include <opaque_fragment>\ngl_FragColor.a = 0.5;', 'opaque_fragment')
  }
  fs = replaceOrWarn(fs, '#include <fog_pars_fragment>', FOG_PARS_FRAGMENT, 'fog_pars_fragment')
  fs = replaceOrWarn(fs, '#include <fog_fragment>', FOG_FRAGMENT, 'fog_fragment')
  shader.fragmentShader = fs
}

/**
 * A MeshToonMaterial wearing the world look. Extra options: { rim, vertex, normal,
 * fragmentColor, emissive, vertexPars, fragmentPars, uniforms, key } — `key` must be
 * unique per distinct shader variant so three caches programs correctly.
 */
export function createToonMaterial(params = {}, opts = {}) {
  const { flatShading, ...rest } = params
  const material = new THREE.MeshToonMaterial(rest)
  // flatShading isn't a MeshToonMaterial constructor option in r185 (the constructor
  // warned and dropped it), but the renderer honours the property.
  if (flatShading) material.flatShading = true
  material.onBeforeCompile = (shader) => patchToon(shader, opts)
  material.customProgramCacheKey = () => `toon:${opts.key ?? 'default'}:${opts.rim === false ? 'norim' : 'rim'}`
  return material
}
