import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { useStore } from '../../state/store'
import { QUALITY } from '../render/quality'
import { U } from '../materials/globalUniforms'
import { mulberry32 } from './noise'

// Ambient life, fully GPU-animated: each particle's path is a closed-form function of
// time evaluated in the vertex shader, so thousands of them cost no CPU at all.
//  • Sakura petals: fall, drift downwind and tumble, wrapping inside a volume over the
//    island so the shower never ends. Shaded two-tone by how each petal faces the sun.
//  • Fireflies: at twilight, soft HDR glows wander over the grass and blink on their own
//    rhythms; bloom turns them into points of light. They fade out by day.

const BOX_MIN = new THREE.Vector3(-17, -1.5, -17)
const BOX_SIZE = new THREE.Vector3(34, 11, 34)

const petalVertex = /* glsl */ `
attribute vec3 aOrigin;
attribute vec4 aRand;
uniform float uTime;
uniform vec2 uWindDir;
uniform float uWindStrength;
uniform vec3 uSunDir;
uniform vec3 uBoxMin;
uniform vec3 uBoxSize;
varying vec2 vUv;
varying float vLit;

mat3 rotateAxis(vec3 axis, float angle) {
  float s = sin(angle);
  float c = cos(angle);
  float oc = 1.0 - c;
  return mat3(
    oc * axis.x * axis.x + c, oc * axis.x * axis.y + axis.z * s, oc * axis.z * axis.x - axis.y * s,
    oc * axis.x * axis.y - axis.z * s, oc * axis.y * axis.y + c, oc * axis.y * axis.z + axis.x * s,
    oc * axis.z * axis.x + axis.y * s, oc * axis.y * axis.z - axis.x * s, oc * axis.z * axis.z + c
  );
}

void main() {
  float t = uTime * (0.55 + aRand.x * 0.45);
  vec3 p = aOrigin;
  p.y -= t * (0.32 + aRand.y * 0.3);
  p.xz += uWindDir * t * (0.8 + aRand.z * 0.6) * uWindStrength;
  p.xz += vec2(sin(t * 1.3 + aRand.w * 6.28), cos(t * 1.1 + aRand.x * 6.28)) * 0.4;
  // Wrap into the volume: an endless shower from a finite set of petals.
  p = uBoxMin + mod(p - uBoxMin, uBoxSize);

  vec3 axis = normalize(vec3(aRand.x - 0.5, 0.7, aRand.y - 0.5));
  mat3 R = rotateAxis(axis, t * (2.2 + aRand.z * 3.0) + aRand.w * 6.28);
  vec3 local = R * vec3(position.xy * vec2(0.055, 0.075), 0.0);
  vLit = abs(dot(R * vec3(0.0, 0.0, 1.0), uSunDir));
  vUv = position.xy;
  gl_Position = projectionMatrix * viewMatrix * vec4(p + local, 1.0);
}
`

const petalFragment = /* glsl */ `
uniform vec3 uPetalLit;
uniform vec3 uPetalShade;
uniform float uPetals;
varying vec2 vUv;
varying float vLit;
void main() {
  // Petal silhouette: an ellipse with a small notch at the tip.
  vec2 q = vUv;
  if (dot(q * vec2(1.0, 0.8), q * vec2(1.0, 0.8)) > 1.0) discard;
  if (q.y > 0.55 && abs(q.x) < (q.y - 0.55) * 0.5) discard;
  if (uPetals < 0.01) discard;
  vec3 col = mix(uPetalShade, uPetalLit, smoothstep(0.25, 0.45, vLit));
  // Alpha < 1: no ink outline on petals.
  gl_FragColor = vec4(col, 0.5);
}
`

const fireflyVertex = /* glsl */ `
attribute vec3 aOrigin;
attribute vec4 aRand;
uniform float uTime;
varying vec2 vUv;
varying float vBlink;
void main() {
  float t = uTime;
  vec3 wander = vec3(
    sin(t * (0.3 + aRand.x * 0.3) + aRand.y * 6.28) * 1.4,
    sin(t * (0.5 + aRand.z * 0.4) + aRand.w * 6.28) * 0.35,
    cos(t * (0.27 + aRand.w * 0.3) + aRand.x * 6.28) * 1.4
  );
  vec4 mv = viewMatrix * vec4(aOrigin + wander, 1.0);
  mv.xy += position.xy * 0.11;
  // Slow pulse with a sharp glow: on for a moment, then fade.
  float pulse = sin(t * (0.9 + aRand.y * 1.3) + aRand.z * 6.28) * 0.5 + 0.5;
  vBlink = pow(pulse, 3.0);
  vUv = position.xy;
  gl_Position = projectionMatrix * mv;
}
`

const fireflyFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uLanterns;
varying vec2 vUv;
varying float vBlink;
void main() {
  float d = length(vUv);
  float glow = pow(clamp(1.0 - d, 0.0, 1.0), 2.4);
  float a = glow * vBlink * smoothstep(0.3, 0.9, uLanterns);
  if (a < 0.003) discard;
  gl_FragColor = vec4(uColor * a * 5.0, a);
}
`

function quad() {
  const base = new THREE.PlaneGeometry(2, 2)
  const g = new THREE.InstancedBufferGeometry()
  g.index = base.index
  g.setAttribute('position', base.attributes.position)
  return g
}

function instanced(count, place, seed) {
  const rand = mulberry32(seed)
  const g = quad()
  const origin = new Float32Array(count * 3)
  const rnd = new Float32Array(count * 4)
  for (let i = 0; i < count; i++) {
    origin.set(place(rand), i * 3)
    rnd.set([rand(), rand(), rand(), rand()], i * 4)
  }
  g.setAttribute('aOrigin', new THREE.InstancedBufferAttribute(origin, 3))
  g.setAttribute('aRand', new THREE.InstancedBufferAttribute(rnd, 4))
  g.instanceCount = count
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 3, 0), 40)
  return g
}

export default function Ambient() {
  const tier = useStore((s) => s.tier)
  const { density } = QUALITY[tier]

  const petals = useMemo(() => {
    const geo = instanced(
      Math.round(520 * density),
      (r) => [BOX_MIN.x + r() * BOX_SIZE.x, BOX_MIN.y + r() * BOX_SIZE.y, BOX_MIN.z + r() * BOX_SIZE.z],
      21,
    )
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: U.uTime,
        uWindDir: U.uWindDir,
        uWindStrength: U.uWindStrength,
        uSunDir: U.uSunDir,
        uBoxMin: { value: BOX_MIN },
        uBoxSize: { value: BOX_SIZE },
        uPetalLit: U.uPetalLit,
        uPetalShade: U.uPetalShade,
        uPetals: { value: 1 },
      },
      vertexShader: petalVertex,
      fragmentShader: petalFragment,
      side: THREE.DoubleSide,
    })
    return { geo, mat }
  }, [density])

  const fireflies = useMemo(() => {
    const geo = instanced(
      Math.round(150 * density),
      (r) => {
        const a = r() * Math.PI * 2
        const d = Math.sqrt(r()) * 12.5
        return [Math.cos(a) * d, 0.35 + r() * 1.8, Math.sin(a) * d]
      },
      37,
    )
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: U.uTime, uLanterns: U.uLanterns, uColor: { value: new THREE.Color('#e9ff9e') } },
      vertexShader: fireflyVertex,
      fragmentShader: fireflyFragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    return { geo, mat }
  }, [density])

  useEffect(
    () => () => {
      petals.geo.dispose()
      petals.mat.dispose()
      fireflies.geo.dispose()
      fireflies.mat.dispose()
    },
    [petals, fireflies],
  )

  return (
    <>
      <mesh geometry={petals.geo} material={petals.mat} frustumCulled={false} />
      <mesh geometry={fireflies.geo} material={fireflies.mat} frustumCulled={false} renderOrder={2} />
    </>
  )
}
