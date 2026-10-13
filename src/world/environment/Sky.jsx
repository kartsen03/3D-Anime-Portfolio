import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { U } from '../materials/globalUniforms'
import { SKY_GLSL } from '../materials/shaderLib'

// The sky: one shader on an inward-facing sphere that follows the camera, so it is
// effectively infinitely far away. The gradient comes from the same skyGradient() that
// colours the fog, which is why distant geometry dissolves into it seamlessly.
// The sun (or moon) disc is pushed into HDR so the bloom pass gives it a soft glow;
// at twilight a hashed star field fades in, each star twinkling on its own phase.

const vertexShader = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  // z ≈ w puts every sky pixel on the far plane: always behind the world. (Exactly w can
  // round past the far plane and get clipped, hence the hair under 1.)
  gl_Position = vec4(p.xy, p.w * 0.99999, p.w);
}
`

const fragmentShader = /* glsl */ `
${SKY_GLSL}
uniform float uStars;
uniform float uTime;
varying vec3 vDir;

float hash13(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  vec3 dir = normalize(vDir);
  vec3 col = skyGradient(dir);

  // Sun / moon disc with a soft edge, in HDR for bloom.
  float d = dot(dir, uSunDir);
  float disc = smoothstep(cos(uSunSize * 1.25), cos(uSunSize), d);
  col += uSunColor * disc * 5.0;

  // Stars: one candidate per cell of a 3D grid around the sky sphere.
  if (uStars > 0.001 && dir.y > -0.05) {
    vec3 p = dir * 220.0;
    vec3 cell = floor(p);
    float r = hash13(cell);
    if (r > 0.985) {
      vec3 f = fract(p) - 0.5 + (vec3(hash13(cell + 7.1), hash13(cell + 3.7), hash13(cell + 1.3)) - 0.5) * 0.5;
      float star = smoothstep(0.16, 0.0, length(f));
      float twinkle = 0.65 + 0.35 * sin(uTime * (1.5 + r * 3.0) + r * 60.0);
      float altitude = smoothstep(-0.02, 0.25, dir.y); // fade into the horizon glow
      col += vec3(1.0, 0.94, 0.86) * star * twinkle * altitude * uStars * (1.5 + 2.5 * fract(r * 97.0));
    }
  }

  gl_FragColor = vec4(col, 1.0);
}
`

export default function Sky() {
  const mesh = useRef()
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uSkyZenith: U.uSkyZenith,
          uSkyUpper: U.uSkyUpper,
          uSkyHorizon: U.uSkyHorizon,
          uSkyBelow: U.uSkyBelow,
          uSunDir: U.uSunDir,
          uSunColor: U.uSunColor,
          uSunSize: U.uSunSize,
          uSunGlow: U.uSunGlow,
          uStars: U.uStars,
          uTime: U.uTime,
        },
        vertexShader,
        fragmentShader,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
      }),
    [],
  )

  useFrame(({ camera }) => mesh.current.position.copy(camera.position))

  return (
    <mesh ref={mesh} material={material} scale={800} renderOrder={-100} frustumCulled={false}>
      <sphereGeometry args={[1, 48, 24]} />
    </mesh>
  )
}
