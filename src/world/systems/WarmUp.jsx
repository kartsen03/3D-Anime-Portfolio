import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { useStore } from '../../state/store'

// Compile every shader and upload every texture BEFORE the visitor sees the world.
//
// Without this, the first frame that shows the character compiles ~20 shader programs
// and uploads all textures in one go: a measured ~0.8 s freeze on an Iris Xe laptop,
// right at the moment of first impression. compileAsync uses the browser's parallel
// shader compilation (KHR_parallel_shader_compile) where available, so the splash keeps
// animating while it works. A couple of rendered frames then warm up the
// post-processing passes, which only compile when first drawn.
//
// This component sits inside the same Suspense boundary as the asset loaders, so it
// mounts only once every critical asset has arrived. It warms up again after every
// quality-tier change, which rebuilds grass, clouds and post-processing with new shaders
// (the frame pacer may change tier behind the splash, just before the opening shot).

const TEXTURE_SLOTS = ['map', 'emissiveMap', 'normalMap', 'alphaMap', 'gradientMap', 'shadeMultiplyTexture', 'matcapTexture', 'rimMultiplyTexture']

// Resolves on the next animation frame, or after 250 ms if frames are paused (a tab
// opened in the background), so readiness never hangs waiting for a frame.
const nextFrame = () =>
  new Promise((resolve) => {
    const timer = setTimeout(() => {
      cancelAnimationFrame(raf)
      resolve()
    }, 250)
    const raf = requestAnimationFrame(() => {
      clearTimeout(timer)
      resolve()
    })
  })

export default function WarmUp() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)

  useEffect(() => {
    let cancelled = false
    const warm = async () => {
      try {
        await gl.compileAsync(scene, camera)
      } catch {
        // Older browsers: shaders compile on first draw instead (behind the splash).
      }
      const seen = new Set()
      scene.traverse((o) => {
        const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []
        for (const m of mats) {
          for (const slot of TEXTURE_SLOTS) {
            const tex = m[slot] ?? m.uniforms?.[slot]?.value
            if (tex?.isTexture && !seen.has(tex)) {
              seen.add(tex)
              gl.initTexture(tex)
            }
          }
        }
      })
    }
    const run = async () => {
      await warm()
      await nextFrame()
      await nextFrame()
      if (cancelled) return
      const store = useStore.getState()
      store.setProgress(1)
      if (store.phase === 'loading') store.setPhase('ready')
    }
    run()
    // After a tier change, wait one frame for React to mount the rebuilt objects.
    const unsubTier = useStore.subscribe(
      (s) => s.tier,
      () => nextFrame().then(() => !cancelled && warm()),
    )
    return () => {
      cancelled = true
      unsubTier()
    }
  }, [gl, scene, camera])

  return null
}
