import * as THREE from 'three'
import { U } from './globalUniforms'
import { SKY_GLSL } from './shaderLib'

// Cel-shaded cloud puffs, drawn as camera-facing quads that shade themselves as spheres.
//
// Each puff is one instance of a 2×2 quad. The fragment shader treats the quad as the
// silhouette of a sphere: it rebuilds the sphere's normal from the pixel's position in
// the quad, lights it with three flat bands (shadowed underside → warm body → highlight)
// plus a rim toward the sun, and writes the sphere's true depth. Writing real depth is
// what makes overlapping puffs merge into one lumpy cumulus instead of a stack of flat
// discs. The edge is broken up with noise so the outline reads painterly, not perfect.
//
// A quad costs 2 triangles, so thousands of puffs are one cheap draw call. On the low
// tier SPHERE_DEPTH is left off (writing gl_FragDepth disables early depth rejection).

const vertexShader = /* glsl */ `
attribute vec3 aCenter;
attribute float aRadius;
attribute float aSeed;
uniform float uTime;
uniform float uDrift;
varying vec2 vUv;
varying vec3 vCenterView;
varying vec3 vCenterWorld;
varying float vRadius;
varying float vSeed;

void main() {
  // Slow drift and a gentle "breathing" swell, each puff on its own phase.
  vec3 center = aCenter + vec3(
    sin(uTime * 0.045 + aSeed * 6.28) * 0.8,
    sin(uTime * 0.07 + aSeed * 3.1) * 0.3,
    cos(uTime * 0.04 + aSeed * 5.0) * 0.8
  ) * uDrift;
  float radius = aRadius * (1.0 + sin(uTime * 0.25 + aSeed * 12.0) * 0.03 * uDrift);

  vec4 centerView = modelViewMatrix * vec4(center, 1.0);
  vUv = position.xy;
  vCenterView = centerView.xyz;
  vCenterWorld = (modelMatrix * vec4(center, 1.0)).xyz;
  vRadius = radius;
  vSeed = aSeed;
  gl_Position = projectionMatrix * vec4(centerView.xyz + vec3(position.xy * radius, 0.0), 1.0);
}
`

const fragmentShader = /* glsl */ `
${SKY_GLSL}
// three only declares projectionMatrix in vertex shaders; redeclaring it here binds the
// same program-wide uniform, needed to compute the sphere's depth per pixel.
uniform mat4 projectionMatrix;
uniform sampler2D uNoise;
uniform vec3 uCloudShadow;
uniform vec3 uCloudMid;
uniform vec3 uCloudLit;
uniform float uFogNear;
uniform float uFogFar;
uniform float uFogScale;
uniform float uEmissive;
uniform float uBaseY;
uniform float uBumpScale;
varying vec2 vUv;
varying vec3 vCenterView;
varying vec3 vCenterWorld;
varying float vRadius;
varying float vSeed;

void main() {
  // Lumpy silhouette: the sphere's radius varies with angle around its centre.
  float angle = atan(vUv.y, vUv.x);
  float lump = texture2D(uNoise, vec2(angle * 0.159 + vSeed * 7.3, vSeed * 3.7)).r;
  float edge = 0.8 + lump * 0.2;
  float r2 = dot(vUv, vUv);
  if (r2 > edge * edge) discard;

  vec3 nView = normalize(vec3(vUv, sqrt(max(edge * edge - r2, 0.0))));
  vec3 surfaceView = vCenterView + nView * vRadius * edge;

  #ifdef SPHERE_DEPTH
    vec4 clip = projectionMatrix * vec4(surfaceView, 1.0);
    gl_FragDepth = clip.z / clip.w * 0.5 + 0.5;
  #endif

  // View-space normal back to world space (viewMatrix is a pure rotation + translation,
  // so multiplying by it on the left is the inverse rotation).
  vec3 n = normalize((vec4(nView, 0.0) * viewMatrix).xyz);
  vec3 surfaceWorld = vCenterWorld + n * vRadius * edge;

  // Flat cloud base: real cumulus sit on a level condensation line, so cut the puffs off
  // below it. From above you see the lumpy tops; from the side, the classic flat bottom.
  if (surfaceWorld.y < uBaseY) discard;

  // Cauliflower bumps: perturb the normal with world-space noise so the light/shadow
  // boundary wanders like a painted cloud instead of tracing a perfect sphere.
  vec2 bumpUv = surfaceWorld.xz * uBumpScale + surfaceWorld.y * uBumpScale * 0.7;
  vec3 bump = texture2D(uNoise, bumpUv).rgb - 0.5;
  bump += (texture2D(uNoise, bumpUv * 2.7 + 0.37).rgb - 0.5) * 0.5;
  n = normalize(n + bump * 0.95);
  float ndl = dot(n, uSunDir);
  float aa = fwidth(ndl) * 1.5;
  float body = smoothstep(-0.12 - aa, -0.12 + aa, ndl);
  float high = smoothstep(0.5 - aa, 0.5 + aa, ndl);
  vec3 col = mix(uCloudShadow, uCloudMid, body);
  col = mix(col, uCloudLit, high);

  // Silhouette rim, strongest when the sun is behind the cloud (backlit edges glow).
  vec3 viewDirWorld = normalize(vCenterWorld - cameraPosition);
  float fresnel = pow(1.0 - nView.z, 3.0);
  float backlit = max(dot(viewDirWorld, uSunDir), 0.0);
  col += uSunColor * fresnel * (0.18 + backlit * 0.85) * 0.55;

  // Cooler, darker undersides.
  col *= mix(0.86, 1.04, n.y * 0.5 + 0.5);

  // Aerial perspective: far puffs melt into the sky behind them.
  float dist = length(surfaceView);
  float fogAmount = smoothstep(uFogNear, uFogFar * uFogScale, dist);
  col = mix(col, skyGradient(viewDirWorld), fogAmount * 0.9);

  col += uSunColor * uEmissive;
  // Alpha < 1 tells the outline pass to leave clouds un-inked (soft masses, not bubbles).
  gl_FragColor = vec4(col, 0.5);
}
`

export function createCloudMaterial({
  sphereDepth = true,
  fogScale = 2.4,
  drift = 1,
  emissive = 0,
  baseY = -1e4,
  bumpScale = 0.06,
} = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: U.uTime,
      uNoise: U.uNoise,
      uSkyZenith: U.uSkyZenith,
      uSkyUpper: U.uSkyUpper,
      uSkyHorizon: U.uSkyHorizon,
      uSkyBelow: U.uSkyBelow,
      uSunDir: U.uSunDir,
      uSunColor: U.uSunColor,
      uSunSize: U.uSunSize,
      uSunGlow: U.uSunGlow,
      uCloudShadow: U.uCloudShadow,
      uCloudMid: U.uCloudMid,
      uCloudLit: U.uCloudLit,
      uFogNear: U.uFogNear,
      uFogFar: U.uFogFar,
      uFogScale: { value: fogScale },
      uDrift: { value: drift },
      uEmissive: { value: emissive },
      uBaseY: { value: baseY },
      uBumpScale: { value: bumpScale },
    },
    defines: sphereDepth ? { SPHERE_DEPTH: '' } : {},
    vertexShader,
    fragmentShader,
  })
}

/** Instanced quad geometry for `count` puffs: fill aCenter/aRadius/aSeed after creating. */
export function createPuffGeometry(puffs) {
  const base = new THREE.PlaneGeometry(2, 2)
  const geo = new THREE.InstancedBufferGeometry()
  geo.index = base.index
  geo.setAttribute('position', base.attributes.position)
  const centers = new Float32Array(puffs.length * 3)
  const radii = new Float32Array(puffs.length)
  const seeds = new Float32Array(puffs.length)
  puffs.forEach((p, i) => {
    centers.set(p.center, i * 3)
    radii[i] = p.radius
    seeds[i] = p.seed
  })
  geo.setAttribute('aCenter', new THREE.InstancedBufferAttribute(centers, 3))
  geo.setAttribute('aRadius', new THREE.InstancedBufferAttribute(radii, 1))
  geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1))
  geo.instanceCount = puffs.length
  // Bounds for frustum culling: the whole spread of puffs.
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5)
  return geo
}
