import { useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  BloomEffect,
  EdgeDetectionMode,
  EffectComposer,
  EffectPass,
  FXAAEffect,
  RenderPass,
  SMAAEffect,
  SMAAPreset,
  ToneMappingEffect,
  ToneMappingMode,
  VignetteEffect,
} from 'postprocessing'
import { HalfFloatType } from 'three'
import { useStore } from '../../state/store'
import { FRAME } from '../systems/runtime'
import { QUALITY } from './quality'
import { OutlineEffect } from './OutlineEffect'
import { GradeEffect } from './GradeEffect'
import { THEMES } from '../themes'

// The post-processing chain, built directly on the `postprocessing` library rather than
// through a React wrapper, for two reasons:
//  1. Resizing: changing the pixel ratio at runtime (adaptive quality) must also resize
//     every buffer. The wrapper only resized on window-size changes — a real bug found
//     while measuring — so quality changes silently did nothing for post-processing.
//  2. Control over pass layout. Each full-screen pass costs memory bandwidth, the scarce
//     resource on integrated GPUs, so the chain is as short as the look allows:
//       scene → outline (depth only) → bloom + tone map + grade + vignette (one merged
//       pass) → anti-aliasing.
//
// No MSAA: on the old pipeline 8× MSAA on both half-float buffers cost more than
// everything else combined. SMAA (or FXAA on the low tier) runs once, on the final
// tone-mapped image, which is also where anti-aliasing looks best.
export default function Pipeline() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const width = useThree((s) => s.size.width)
  const height = useThree((s) => s.size.height)
  const dpr = useThree((s) => s.viewport.dpr)
  const tier = useStore((s) => s.tier)
  const themeId = useStore((s) => s.theme)
  const preset = QUALITY[tier]

  const { composer, effects } = useMemo(() => {
    const composer = new EffectComposer(gl, {
      frameBufferType: HalfFloatType, // HDR: keeps values > 1 so bloom can find them
      multisampling: preset.msaa,
      stencilBuffer: false,
    })
    composer.addPass(new RenderPass(scene, camera))

    const outline = new OutlineEffect()
    composer.addPass(new EffectPass(camera, outline))

    const bloom = new BloomEffect({ mipmapBlur: true, levels: preset.bloomLevels })
    // Khronos PBR Neutral: keeps hue and saturation as authored (A/B-tested against AgX,
    // which greys anime colours out, and ACES, which washes out highlights).
    const tone = new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL })
    const grade = new GradeEffect()
    const vignette = new VignetteEffect()
    // Merged into one shader: bloom's composite, tone mapping, grade and vignette all
    // happen in a single full-screen pass. Dithering hides banding in the sky gradient.
    const finalPass = new EffectPass(camera, bloom, tone, grade, vignette)
    finalPass.dithering = true
    composer.addPass(finalPass)

    if (preset.aa === 'smaa') {
      composer.addPass(
        new EffectPass(camera, new SMAAEffect({ preset: SMAAPreset.MEDIUM, edgeDetectionMode: EdgeDetectionMode.COLOR })),
      )
    } else if (preset.aa === 'fxaa') {
      composer.addPass(new EffectPass(camera, new FXAAEffect()))
    }

    return { composer, effects: { outline, bloom, tone, grade, vignette } }
  }, [gl, scene, camera, preset.msaa, preset.bloomLevels, preset.aa])

  useEffect(() => () => composer.dispose(), [composer])

  // Development handle for look-dev (tone-mapping A/B tests, grade tuning).
  useEffect(() => {
    if (import.meta.env.DEV) window.__pipeline = { composer, effects }
  }, [composer, effects])

  // Resize on window size AND pixel-ratio changes. setSize() with no arguments reads the
  // renderer's current drawing-buffer size, so every pass follows the new DPR.
  useEffect(() => {
    effects.outline.pixelRatio = dpr
    composer.setSize(width, height)
  }, [composer, effects, width, height, dpr])

  // Theme → effect parameters (uniform writes only; no shader recompiles).
  useEffect(() => {
    const t = THEMES[themeId]
    effects.bloom.luminanceMaterial.threshold = t.bloom.threshold
    effects.bloom.luminanceMaterial.smoothing = t.bloom.smoothing
    effects.bloom.intensity = t.bloom.intensity
    effects.bloom.mipmapBlurPass.radius = t.bloom.radius
    effects.grade.set(t.grade)
    effects.vignette.darkness = t.vignette.darkness
    effects.vignette.offset = t.vignette.offset
    effects.outline.set(t.outline)
    gl.toneMappingExposure = t.exposure
  }, [effects, themeId, gl])

  useFrame((_, delta) => composer.render(delta), FRAME.render)

  return null
}
