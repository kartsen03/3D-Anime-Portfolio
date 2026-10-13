import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { createToonMaterial } from '../materials/shaderLib'
import { U } from '../materials/globalUniforms'
import { registerLantern } from '../systems/lanterns'

// A Kasuga-style stone lantern (tōrō), turned on a lathe the way the real ones are
// carved: hexagonal footing, pole, platform, light box with glowing paper windows, a
// flared hexagonal roof and a jewel finial. Six lathe segments give the hexagonal facets.
//
// The windows' glow is driven by the shared uLanterns uniform: barely there in daylight,
// bright HDR at twilight so the bloom pass turns each one into a soft glowing light. A
// soft additive pool on the ground sells the light falling around the lantern.

const HEX = 6
const STONE = '#9b958b'

const lathe = (pts, segments = HEX) =>
  new THREE.LatheGeometry(
    pts.map(([r, y]) => new THREE.Vector2(r, y)),
    segments,
    Math.PI / HEX, // rotate so a flat face points forward
  )

function lanternGeometries() {
  return {
    base: lathe([
      [0, 0],
      [0.36, 0],
      [0.36, 0.1],
      [0.27, 0.18],
      [0.2, 0.24],
      [0, 0.24],
    ]),
    pole: lathe(
      [
        [0, 0.24],
        [0.11, 0.24],
        [0.1, 0.62],
        [0.11, 0.86],
        [0, 0.86],
      ],
      12,
    ),
    platform: lathe([
      [0, 0.86],
      [0.15, 0.86],
      [0.3, 0.95],
      [0.31, 1.02],
      [0, 1.02],
    ]),
    lightBox: lathe([
      [0, 1.02],
      [0.2, 1.02],
      [0.2, 1.3],
      [0, 1.3],
    ]),
    roof: lathe([
      [0, 1.3],
      [0.44, 1.3],
      [0.46, 1.34],
      [0.3, 1.42],
      [0.17, 1.52],
      [0.08, 1.58],
      [0, 1.58],
    ]),
    finial: lathe(
      [
        [0, 1.58],
        [0.07, 1.6],
        [0.09, 1.66],
        [0.06, 1.72],
        [0.0, 1.78],
      ],
      12,
    ),
  }
}

// Additive pool of light on the ground: a radial gradient that fades in with uLanterns.
function lightPoolMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uLanterns: U.uLanterns, uColor: { value: new THREE.Color('#ffb35c') } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform float uLanterns;
      uniform vec3 uColor;
      varying vec2 vUv;
      void main() {
        float d = length(vUv - 0.5) * 2.0;
        float a = pow(clamp(1.0 - d, 0.0, 1.0), 2.2) * uLanterns * 0.55;
        gl_FragColor = vec4(uColor * a, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
}

let shared = null
function getShared() {
  if (shared) return shared
  // The window panes are emissive: a warm base colour scaled into HDR by uLanterns.
  const glow = createToonMaterial(
    { color: '#f4d9a6', side: THREE.DoubleSide },
    {
      key: 'lantern-window',
      rim: false,
      emissive: 'totalEmissiveRadiance += vec3(1.0, 0.62, 0.26) * (0.06 + uLanterns * 3.2);',
    },
  )
  shared = {
    geo: lanternGeometries(),
    stone: createToonMaterial({ color: STONE, flatShading: true }, { key: 'stone' }),
    glow,
    pool: lightPoolMaterial(),
    poolGeo: new THREE.PlaneGeometry(3.4, 3.4),
  }
  return shared
}

const _world = new THREE.Vector3()

export default function StoneLantern(props) {
  const s = useMemo(getShared, [])
  const g = s.geo
  const light = useRef()

  // Register the light box's world position so the toon shader can light the
  // surroundings with it (systems/lanterns.js).
  useLayoutEffect(() => {
    light.current.updateWorldMatrix(true, false)
    return registerLantern(light.current.getWorldPosition(_world))
  }, [])

  return (
    <group {...props}>
      <object3D ref={light} position={[0, 1.16, 0]} />
      <mesh geometry={g.base} material={s.stone} castShadow receiveShadow />
      <mesh geometry={g.pole} material={s.stone} castShadow receiveShadow />
      <mesh geometry={g.platform} material={s.stone} castShadow receiveShadow />
      <mesh geometry={g.lightBox} material={s.glow} />
      <mesh geometry={g.roof} material={s.stone} castShadow receiveShadow />
      <mesh geometry={g.finial} material={s.stone} castShadow />
      <mesh geometry={s.poolGeo} material={s.pool} rotation-x={-Math.PI / 2} position-y={0.03} renderOrder={1} />
    </group>
  )
}
