import { Effect } from 'postprocessing'
import { Uniform, Vector3 } from 'three'

// Colour grade, applied after tone mapping. This is the "film look" of each art
// direction: golden hour wants warm highlights and slightly lifted lavender shadows;
// twilight wants deep indigo shadows and lantern-gold highlights.
//
// It works in display space (roughly gamma 2.2) because lift/gamma/gain and contrast are
// defined there — that's how colourists think about them and how the controls behave
// intuitively. postprocessing hands effects linear colour, so we convert in and back out.
//
// It also adds a whisper of animated film grain. Besides texture, grain breaks up the
// 8-bit banding that smooth sky gradients otherwise show on many screens.
const fragmentShader = /* glsl */ `
uniform vec3 uLift;
uniform vec3 uGamma;
uniform vec3 uGain;
uniform float uSaturation;
uniform float uContrast;
uniform vec3 uShadowTint;
uniform vec3 uHighlightTint;
uniform float uSplit;
uniform float uGrain;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 c = pow(max(inputColor.rgb, 0.0), vec3(1.0 / 2.2));

  // Lift raises the blacks, gain scales the whites, gamma bends the mids.
  c = c * uGain + uLift * (1.0 - c);
  c = pow(max(c, 0.0), 1.0 / uGamma);

  // Contrast pivots around mid-grey.
  c = (c - 0.5) * uContrast + 0.5;

  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, uSaturation);

  // Split toning: push shadows toward one hue and highlights toward another, weighted by
  // brightness. Tints are colours around 0.5 grey (0.5 = no shift).
  float t = clamp(l, 0.0, 1.0);
  c += ((uShadowTint - 0.5) * (1.0 - t) + (uHighlightTint - 0.5) * t) * uSplit;

  c += (hash12(uv * resolution + fract(time) * 517.0) - 0.5) * uGrain;

  outputColor = vec4(pow(clamp(c, 0.0, 1.0), vec3(2.2)), inputColor.a);
}
`

const v3 = (a) => new Vector3(...a)

export class GradeEffect extends Effect {
  constructor() {
    super('GradeEffect', fragmentShader, {
      uniforms: new Map([
        ['uLift', new Uniform(new Vector3(0, 0, 0))],
        ['uGamma', new Uniform(new Vector3(1, 1, 1))],
        ['uGain', new Uniform(new Vector3(1, 1, 1))],
        ['uSaturation', new Uniform(1)],
        ['uContrast', new Uniform(1)],
        ['uShadowTint', new Uniform(new Vector3(0.5, 0.5, 0.5))],
        ['uHighlightTint', new Uniform(new Vector3(0.5, 0.5, 0.5))],
        ['uSplit', new Uniform(0)],
        ['uGrain', new Uniform(0)],
      ]),
    })
  }

  /** Apply a grade preset ({ lift:[r,g,b], gamma, gain, saturation, contrast, shadowTint, highlightTint, split, grain }). */
  set(p) {
    const u = this.uniforms
    if (p.lift) u.get('uLift').value.copy(v3(p.lift))
    if (p.gamma) u.get('uGamma').value.copy(v3(p.gamma))
    if (p.gain) u.get('uGain').value.copy(v3(p.gain))
    if (p.saturation !== undefined) u.get('uSaturation').value = p.saturation
    if (p.contrast !== undefined) u.get('uContrast').value = p.contrast
    if (p.shadowTint) u.get('uShadowTint').value.copy(v3(p.shadowTint))
    if (p.highlightTint) u.get('uHighlightTint').value.copy(v3(p.highlightTint))
    if (p.split !== undefined) u.get('uSplit').value = p.split
    if (p.grain !== undefined) u.get('uGrain').value = p.grain
  }
}
