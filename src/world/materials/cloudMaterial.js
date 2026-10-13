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
attribute vec4 aBank; // centre and radius of the bank (cloud heap) this puff belongs to
uniform float uTime;
uniform float uDrift;
varying vec2 vUv;
varying vec3 vCenterView;
varying vec3 vCenterWorld;
varying vec3 vBankWorld;
varying float vBankRadius;
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
  vBankWorld = (modelMatrix * vec4(aBank.xyz, 1.0)).xyz;
  vBankRadius = aBank.w;
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
uniform float uBankWeight;
uniform float uBankFlatten;
uniform float uBumpAmount;
varying vec2 vUv;
varying vec3 vCenterView;
varying vec3 vCenterWorld;
varying vec3 vBankWorld;
varying float vBankRadius;
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

  // Light each puff mostly as part of its bank: blend the puff's own sphere normal toward
  // the normal of the bank's overall mound (a flattened ellipsoid). The light then sweeps
  // across the whole heap, and neighbouring puffs share one gradient, instead of every
  // puff getting its own lit cap and dark crescent (the "field of balloons" look).
  vec3 toBank = surfaceWorld - vBankWorld;
  vec3 bankN = normalize(vec3(toBank.x, toBank.y * uBankFlatten + 1e-3, toBank.z));
  vec3 puffN = n;
  n = normalize(mix(n, bankN, uBankWeight));
  vec3 viewDirWorld = normalize(vCenterWorld - cameraPosition);
  // Rim from the puff's own outline, but only along its upper edge: light catching the
  // thin tops of a cloud (a silver lining), never a ring around every puff.
  float fresnel = pow(1.0 - clamp(dot(puffN, -viewDirWorld), 0.0, 1.0), 3.0) * smoothstep(0.05, 0.75, puffN.y);

  // Cauliflower bumps: perturb the normal with world-space noise so the light/shadow
  // boundary wanders like a painted cloud instead of tracing a perfect sphere. Fainter
  // with distance, where the noise would only add speckle.
  float dist = length(surfaceView);
  float far = smoothstep(120.0, 520.0, dist);
  // The coarse octave is triplanar (projected along each axis, blended by the normal):
  // a single top-down projection smears into vertical streaks down the sides of a heap.
  vec3 q = surfaceWorld * uBumpScale;
  vec3 tw = abs(puffN);
  tw /= tw.x + tw.y + tw.z;
  vec3 bump = texture2D(uNoise, q.yz).rgb * tw.x + texture2D(uNoise, q.xz).rgb * tw.y + texture2D(uNoise, q.xy).rgb * tw.z - 0.5;
  bump += (texture2D(uNoise, (q.xz + q.y * 0.7) * 2.7 + 0.37).rgb - 0.5) * 0.5;
  n = normalize(n + bump * uBumpAmount * (1.0 - far * 0.6));
  float ndl = dot(n, uSunDir);
  // Most of each bank is lit; only the undersides fall into shadow. Far away the bands
  // soften and lose contrast (aerial perspective flattens distant shading; crisp bands on
  // small distant puffs read as beads).
  float aa = fwidth(ndl) * 1.5 + far * 0.22;
  float body = smoothstep(-0.32 - aa, -0.32 + aa, ndl);
  float high = smoothstep(0.42 - aa, 0.42 + aa, ndl);
  vec3 col = mix(uCloudShadow, uCloudMid, body);
  col = mix(col, uCloudLit, high);
  col = mix(col, mix(uCloudShadow, uCloudMid, 0.75), far * 0.3);

  // Silhouette rim, mostly when the sun is behind the cloud (backlit edges glow). It uses
  // the bank-blended normal, so it outlines each heap rather than every puff.
  float backlit = max(dot(viewDirWorld, uSunDir), 0.0);
  col += uSunColor * fresnel * (0.06 + backlit * 0.8) * 0.5;

  // Whole-bank shading by height above the cloud base, scaled to the bank's size: the low
  // parts of a heap sit in its own shadow, so neighbouring puffs share one gradient.
  float bankHeight = clamp((surfaceWorld.y - uBaseY) / max(vBankRadius * 0.45, 4.0), 0.0, 1.0);
  col *= mix(0.78, 1.04, bankHeight);
  // Where a heap meets the cloud layer it rises from, blend into the layer's own tone, so
  // it grows out of the layer instead of sitting on it with a dark seam.
  col = mix(mix(uCloudShadow, uCloudMid, 0.5), col, smoothstep(0.0, 0.3, bankHeight));

  // Aerial perspective: far puffs melt into the sky behind them.
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
  bankWeight = 0, // 0 = each puff shades as its own sphere; toward 1 = as part of its bank
  bankFlatten = 2.5, // >1 flattens the bank's mound (sea banks), <1 makes it tall (towers)
  bumpAmount = 0.95,
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
      uBankWeight: { value: bankWeight },
      uBankFlatten: { value: bankFlatten },
      uBumpAmount: { value: bumpAmount },
    },
    defines: sphereDepth ? { SPHERE_DEPTH: '' } : {},
    vertexShader,
    fragmentShader,
  })
}

/**
 * Instanced quad geometry, one instance per puff: { center, radius, seed, bank? }, where
 * `bank` is [x, y, z, radius] of the heap the puff belongs to (defaults to the puff itself).
 */
export function createPuffGeometry(puffs) {
  const base = new THREE.PlaneGeometry(2, 2)
  const geo = new THREE.InstancedBufferGeometry()
  geo.index = base.index
  geo.setAttribute('position', base.attributes.position)
  const centers = new Float32Array(puffs.length * 3)
  const radii = new Float32Array(puffs.length)
  const seeds = new Float32Array(puffs.length)
  const banks = new Float32Array(puffs.length * 4)
  puffs.forEach((p, i) => {
    centers.set(p.center, i * 3)
    radii[i] = p.radius
    seeds[i] = p.seed
    banks.set(p.bank ?? [...p.center, p.radius], i * 4)
  })
  geo.setAttribute('aCenter', new THREE.InstancedBufferAttribute(centers, 3))
  geo.setAttribute('aRadius', new THREE.InstancedBufferAttribute(radii, 1))
  geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1))
  geo.setAttribute('aBank', new THREE.InstancedBufferAttribute(banks, 4))
  geo.instanceCount = puffs.length
  // Bounds for frustum culling: the whole spread of puffs.
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5)
  return geo
}
