import { forwardRef, useContext, useEffect, useMemo } from 'react'
import { Effect, EffectAttribute } from 'postprocessing'
import { EffectComposerContext } from '@react-three/postprocessing'
import { Uniform, Color } from 'three'

// A GLOBAL cel outline: a screen-space edge-detection pass that inks the whole
// scene (character + island + props + torii) with ONE cohesive line, instead of
// per-object inverted-hull outlines. It's a custom postprocessing Effect (NOT
// drei's <Outline>, which is a selective highlight for chosen objects).
//
// It detects edges from two buffers the composer already produces:
//   • DEPTH   → silhouettes (big linear-depth jumps between neighbours)
//   • NORMALS → interior creases (normal-buffer neighbours that disagree)
// Attributes = CONVOLUTION | DEPTH: it samples neighbouring texels and needs the
// depth buffer. CONVOLUTION also makes @react-three/postprocessing give it its
// own EffectPass (it can't merge with others) — which is exactly what we want.
//
// GLSL3 (WebGL2): use texture(), not texture2D(). postprocessing supplies
// readDepth(), texelSize, cameraNear, cameraFar to depth effects; we only add
// our own uniforms.
const fragmentShader = /* glsl */ `
uniform sampler2D uNormalBuffer;
uniform vec3 uColor;
uniform float uThickness;
uniform float uDepthThreshold;
uniform float uNormalThreshold;
uniform float uStrength;

// Perspective window-depth [0,1] -> linear eye depth [near, far]. Linearizing
// makes one threshold behave consistently near AND far (raw depth is very
// non-linear), so silhouettes read the same across the scene.
float linearizeDepth(const in float d) {
  float ndc = 2.0 * d - 1.0;
  return (2.0 * cameraNear * cameraFar) / (cameraFar + cameraNear - ndc * (cameraFar - cameraNear));
}

float linDepth(const in vec2 uv) {
  return linearizeDepth(readDepth(uv));
}

void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
  // Neighbour sample offset, in texels, scaled by the line thickness.
  vec2 o = texelSize * uThickness;

  // --- Depth edges (silhouettes) — 4-neighbour cross of linear depth ---
  float dC = linearizeDepth(depth);
  float dL = linDepth(uv - vec2(o.x, 0.0));
  float dR = linDepth(uv + vec2(o.x, 0.0));
  float dU = linDepth(uv + vec2(0.0, o.y));
  float dD = linDepth(uv - vec2(0.0, o.y));
  float depthEdge = abs(dL - dC) + abs(dR - dC) + abs(dU - dC) + abs(dD - dC);

  // --- Normal edges (interior creases) — raw normal-buffer neighbours ---
  vec3 nC = texture(uNormalBuffer, uv).rgb;
  vec3 nL = texture(uNormalBuffer, uv - vec2(o.x, 0.0)).rgb;
  vec3 nR = texture(uNormalBuffer, uv + vec2(o.x, 0.0)).rgb;
  vec3 nU = texture(uNormalBuffer, uv + vec2(0.0, o.y)).rgb;
  vec3 nD = texture(uNormalBuffer, uv - vec2(0.0, o.y)).rgb;
  float normalEdge = distance(nL, nC) + distance(nR, nC) + distance(nU, nC) + distance(nD, nC);

  // Threshold each (smoothstep = softly anti-aliased line), take the stronger.
  float dE = smoothstep(uDepthThreshold, uDepthThreshold * 2.0, depthEdge);
  float nE = smoothstep(uNormalThreshold, uNormalThreshold * 2.0, normalEdge);
  float edge = clamp(max(dE, nE) * uStrength, 0.0, 1.0);

  outputColor = vec4(mix(inputColor.rgb, uColor, edge), inputColor.a);
}
`

class OutlineEffectImpl extends Effect {
  constructor({
    normalBuffer = null,
    color = 0x181018,
    thickness = 1.2,
    depthThreshold = 0.7,
    normalThreshold = 0.5,
    strength = 1.0,
  } = {}) {
    super('ToonOutlineEffect', fragmentShader, {
      attributes: EffectAttribute.CONVOLUTION | EffectAttribute.DEPTH,
      uniforms: new Map([
        ['uNormalBuffer', new Uniform(normalBuffer)],
        ['uColor', new Uniform(new Color(color))],
        ['uThickness', new Uniform(thickness)],
        ['uDepthThreshold', new Uniform(depthThreshold)],
        ['uNormalThreshold', new Uniform(normalThreshold)],
        ['uStrength', new Uniform(strength)],
      ]),
    })
  }
}

// R3F wrapper (standard custom-effect pattern): grab the composer's normal pass
// from context, build the effect once, and push live Leva values into its
// uniforms. <primitive> drops the effect object into the <EffectComposer> tree.
const Outline = forwardRef(function Outline(
  {
    color = '#181018',
    thickness = 1.2,
    depthThreshold = 0.7,
    normalThreshold = 0.5,
    strength = 1.0,
  },
  ref,
) {
  const { normalPass } = useContext(EffectComposerContext)

  const effect = useMemo(
    () =>
      new OutlineEffectImpl({
        normalBuffer: normalPass ? normalPass.texture : null,
        color,
        thickness,
        depthThreshold,
        normalThreshold,
        strength,
      }),
    // Rebuild only if the normal pass (its texture) changes; slider values are
    // pushed via the effect below without recreating the shader.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [normalPass],
  )

  useEffect(() => {
    effect.uniforms.get('uColor').value.set(color)
    effect.uniforms.get('uThickness').value = thickness
    effect.uniforms.get('uDepthThreshold').value = depthThreshold
    effect.uniforms.get('uNormalThreshold').value = normalThreshold
    effect.uniforms.get('uStrength').value = strength
  }, [effect, color, thickness, depthThreshold, normalThreshold, strength])

  return <primitive ref={ref} object={effect} dispose={null} />
})

export default Outline
