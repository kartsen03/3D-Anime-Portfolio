import { EffectComposer, Bloom, Vignette, ToneMapping } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { HalfFloatType } from 'three'
import { useControls } from 'leva'

// The post-processing stack. It runs AFTER the scene renders each frame.
//
// HDR / colour pipeline rules (see App.jsx for the renderer side):
//  - frameBufferType = HalfFloatType gives the composer a floating-point (HDR)
//    buffer, so bright pixels can exceed 1.0 for Bloom to detect. A normal LDR
//    buffer would clip everything to white first and Bloom would have nothing
//    to select.
//  - No normal pass: in @react-three/postprocessing v3 the normal pass is
//    OPT-IN (`enableNormalPass`), off by default — nothing here reads normals,
//    so we simply don't enable it.
//  - <ToneMapping> is LAST. The renderer's own tone mapping is disabled
//    (NoToneMapping), so this effect is what maps the HDR result down to a
//    displayable range — and it must happen after Bloom has used the HDR values.
export default function PostFX() {
  const bloom = useControls('Bloom', {
    intensity: { value: 1.2, min: 0, max: 5, step: 0.05 },
    // Only pixels brighter than this bloom. ~1.0 means "selective": the flat
    // cel bands (all < 1.0) stay crisp and only the HDR rim light glows.
    luminanceThreshold: { value: 1.0, min: 0, max: 2, step: 0.01 },
    // Blur spread of the glow (used by mipmapBlur).
    radius: { value: 0.6, min: 0, max: 1, step: 0.01 },
  })
  const vignette = useControls('Vignette', {
    darkness: { value: 0.5, min: 0, max: 1, step: 0.01 },
    offset: { value: 0.3, min: 0, max: 1, step: 0.01 },
  })

  return (
    <EffectComposer frameBufferType={HalfFloatType}>
      <Bloom
        intensity={bloom.intensity}
        luminanceThreshold={bloom.luminanceThreshold}
        luminanceSmoothing={0.05}
        radius={bloom.radius}
        mipmapBlur
      />
      <Vignette darkness={vignette.darkness} offset={vignette.offset} />
      {/* MUST be the last effect in the composer. */}
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  )
}
