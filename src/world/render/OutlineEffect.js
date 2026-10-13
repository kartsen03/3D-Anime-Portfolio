import { Effect, EffectAttribute } from 'postprocessing'
import { Uniform, Color, Vector2 } from 'three'

// Global cel outline: one screen-space pass inks the whole scene (character, gates,
// trees) with a single consistent line, instead of per-object inverted hulls.
//
// It reads ONLY the main depth buffer, so lines always match what is actually visible:
//  • Silhouettes — a neighbour much farther away than this pixel (relative jump, so the
//    same threshold works up close and far away).
//  • Creases — a kink in the surface, found with the second derivative of 1/depth.
//    1/depth is linear across any flat plane in screen space, so its second derivative
//    is exactly zero on floors and walls (no false lines on the ground at grazing angles)
//    and spikes only where two surfaces meet at an angle.
//
// An earlier version took creases from a normal pre-pass. That pass re-renders the scene
// with a stand-in material, which cannot reproduce the cloud billboards' sphere depth or
// the grass's wind motion — so it drew ghost lines of hidden objects through clouds and
// noisy patches on the character. Depth-only also saves that whole extra scene render.
//
// Materials can opt out (clouds, grass, particles) by writing alpha < 1 into the HDR
// colour buffer, which nothing else reads: those pixels get no ink.
//
// Line width is in CSS pixels scaled by the device pixel ratio, and the ink takes a
// darkened tint of the colour underneath ("coloured line art"), fading with distance.
const fragmentShader = /* glsl */ `
uniform vec3 uInkColor;
uniform float uInkTint;
uniform vec2 uThickness;        // neighbour offset in UV units (texel size × width px × DPR)
uniform float uDepthThreshold;  // relative depth jump that starts a silhouette line
uniform float uCreaseThreshold; // relative curvature that starts a crease line
uniform float uStrength;
uniform vec2 uFade;             // lines fade out between these distances (metres)

float linearDepth(const in float d) {
  return -getViewZ(d);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
  // Empty sky (no depth written) and opted-out materials get no ink.
  if (depth >= 0.99999 || inputColor.a < 0.75) {
    outputColor = vec4(inputColor.rgb, 1.0);
    return;
  }

  vec2 ox = vec2(uThickness.x, 0.0);
  vec2 oy = vec2(0.0, uThickness.y);
  float zC = linearDepth(depth);
  float zL = linearDepth(readDepth(uv - ox));
  float zR = linearDepth(readDepth(uv + ox));
  float zD = linearDepth(readDepth(uv - oy));
  float zU = linearDepth(readDepth(uv + oy));

  // Silhouette: only neighbours FARTHER than this pixel count, so the line lands on the
  // near object's edge instead of doubling onto the background.
  float far = max(max(zL, zR), max(zD, zU));
  float silhouette = smoothstep(uDepthThreshold, uDepthThreshold * 1.8, (far - zC) / zC);

  // Crease: second difference of inverse depth, relative to this pixel's inverse depth.
  // Only on a continuous surface: next to an occluder (a grass blade in front of the
  // ground, a hand in front of the chest) the second difference spikes too, and inking
  // that would fringe every foreground object with a dark halo.
  float iC = 1.0 / zC;
  float lapX = abs(1.0 / zL + 1.0 / zR - 2.0 * iC) / iC;
  float lapY = abs(1.0 / zD + 1.0 / zU - 2.0 * iC) / iC;
  float near = min(min(zL, zR), min(zD, zU));
  float continuous = step(max(far - zC, zC - near) / zC, uDepthThreshold);
  float crease = smoothstep(uCreaseThreshold, uCreaseThreshold * 2.0, max(lapX, lapY)) * continuous;
  // Creases fade sooner than silhouettes: at a distance they turn into noise.
  crease *= 1.0 - smoothstep(uFade.x * 0.4, uFade.y * 0.5, zC);

  float fade = 1.0 - smoothstep(uFade.x, uFade.y, zC);
  float edge = clamp(max(silhouette, crease) * fade * uStrength, 0.0, 1.0);

  vec3 ink = mix(uInkColor, inputColor.rgb * 0.28, uInkTint);
  outputColor = vec4(mix(inputColor.rgb, ink, edge), 1.0);
}
`

export class OutlineEffect extends Effect {
  constructor({
    inkColor = '#1a1420',
    inkTint = 0.55,
    width = 1.2,
    depthThreshold = 0.04,
    creaseThreshold = 0.012,
    strength = 1,
    fadeStart = 40,
    fadeEnd = 130,
  } = {}) {
    super('ToonOutlineEffect', fragmentShader, {
      attributes: EffectAttribute.CONVOLUTION | EffectAttribute.DEPTH,
      uniforms: new Map([
        ['uInkColor', new Uniform(new Color(inkColor))],
        ['uInkTint', new Uniform(inkTint)],
        ['uThickness', new Uniform(new Vector2())],
        ['uDepthThreshold', new Uniform(depthThreshold)],
        ['uCreaseThreshold', new Uniform(creaseThreshold)],
        ['uStrength', new Uniform(strength)],
        ['uFade', new Uniform(new Vector2(fadeStart, fadeEnd))],
      ]),
    })
    this.width = width // CSS pixels
    this.pixelRatio = 1
  }

  // postprocessing calls setSize with the drawing-buffer size; convert the CSS-pixel
  // width into a UV offset for this resolution.
  setSize(width, height) {
    this.uniforms.get('uThickness').value.set(
      (this.width * this.pixelRatio) / Math.max(width, 1),
      (this.width * this.pixelRatio) / Math.max(height, 1),
    )
  }

  set(params) {
    const u = this.uniforms
    if (params.inkColor !== undefined) u.get('uInkColor').value.set(params.inkColor)
    if (params.inkTint !== undefined) u.get('uInkTint').value = params.inkTint
    if (params.depthThreshold !== undefined) u.get('uDepthThreshold').value = params.depthThreshold
    if (params.creaseThreshold !== undefined) u.get('uCreaseThreshold').value = params.creaseThreshold
    if (params.strength !== undefined) u.get('uStrength').value = params.strength
    if (params.fadeStart !== undefined) u.get('uFade').value.x = params.fadeStart
    if (params.fadeEnd !== undefined) u.get('uFade').value.y = params.fadeEnd
  }
}
