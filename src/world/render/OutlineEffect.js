import { Effect, EffectAttribute } from 'postprocessing'
import { Uniform, Color, Vector2 } from 'three'

// Global cel outline: one screen-space edge pass inks the whole scene (character,
// landmarks, trees) with a single consistent line, instead of per-object inverted hulls.
//
// Two edge signals, both read from buffers the composer already has:
//  • DEPTH   → silhouettes, where a neighbour pixel is much farther away than this one.
//  • NORMALS → interior creases (folds, roof edges), where neighbour normals disagree.
//
// Changes from v1, each fixing something visible:
//  • The depth edge is RELATIVE (difference ÷ distance). An absolute threshold in metres
//    misses lines up close and turns distant ground at grazing angles into black noise.
//  • Only neighbours FARTHER than the centre count, so the line sits on the near object's
//    edge pixels instead of doubling up on the background side.
//  • Line width is set in CSS pixels and scaled by the device pixel ratio, so it looks the
//    same on a 1× laptop and a 3× phone.
//  • The ink takes a darkened tint of the colour underneath ("coloured line art"), which
//    reads far more refined than pure black, and fades out with distance.
const fragmentShader = /* glsl */ `
uniform sampler2D uNormalBuffer;
uniform vec3 uInkColor;
uniform float uInkTint;
uniform vec2 uThickness;        // neighbour offset in UV units (texel size × width px × DPR)
uniform float uDepthThreshold;  // relative depth jump that starts a line (e.g. 0.04 = 4%)
uniform float uNormalThreshold; // 1 - dot(nA, nB) that starts a crease line
uniform float uStrength;
uniform vec2 uFade;             // line fades out between these distances (metres)

// Distance from the camera in metres. Raw depth is very non-linear (most of its
// precision sits near the camera), so edges are compared in linear depth instead.
// getViewZ() comes from postprocessing and handles the camera type for us.
float linearizeDepth(const in float d) {
  return -getViewZ(d);
}

vec3 readNormal(const in vec2 uv) {
  return texture(uNormalBuffer, uv).xyz * 2.0 - 1.0;
}

void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
  // Empty sky writes no depth (the dome has depthWrite off), so it never gets inked.
  if (depth >= 0.99999) {
    outputColor = inputColor;
    return;
  }

  float dC = linearizeDepth(depth);
  vec2 ox = vec2(uThickness.x, 0.0);
  vec2 oy = vec2(0.0, uThickness.y);

  float dMax = max(
    max(linearizeDepth(readDepth(uv - ox)), linearizeDepth(readDepth(uv + ox))),
    max(linearizeDepth(readDepth(uv - oy)), linearizeDepth(readDepth(uv + oy)))
  );
  float depthEdge = smoothstep(uDepthThreshold, uDepthThreshold * 1.8, (dMax - dC) / dC);

  float normalEdge = 0.0;
  #ifdef USE_NORMALS
    vec3 nC = readNormal(uv);
    float crease = max(
      max(1.0 - dot(nC, readNormal(uv - ox)), 1.0 - dot(nC, readNormal(uv + ox))),
      max(1.0 - dot(nC, readNormal(uv - oy)), 1.0 - dot(nC, readNormal(uv + oy)))
    );
    // Creases fade sooner than silhouettes: at a distance they turn into noise.
    float creaseFade = 1.0 - smoothstep(uFade.x * 0.5, uFade.y * 0.6, dC);
    normalEdge = smoothstep(uNormalThreshold, uNormalThreshold * 1.6, crease) * creaseFade;
  #endif

  float fade = 1.0 - smoothstep(uFade.x, uFade.y, dC);
  float edge = clamp(max(depthEdge, normalEdge) * fade * uStrength, 0.0, 1.0);

  vec3 ink = mix(uInkColor, inputColor.rgb * 0.28, uInkTint);
  outputColor = vec4(mix(inputColor.rgb, ink, edge), inputColor.a);
}
`

export class OutlineEffect extends Effect {
  constructor({
    normalBuffer = null,
    inkColor = '#1a1420',
    inkTint = 0.55,
    width = 1.25,
    depthThreshold = 0.045,
    normalThreshold = 0.35,
    strength = 1,
    fadeStart = 40,
    fadeEnd = 120,
  } = {}) {
    super('ToonOutlineEffect', fragmentShader, {
      attributes: EffectAttribute.CONVOLUTION | EffectAttribute.DEPTH,
      defines: normalBuffer ? new Map([['USE_NORMALS', '1']]) : new Map(),
      uniforms: new Map([
        ['uNormalBuffer', new Uniform(normalBuffer)],
        ['uInkColor', new Uniform(new Color(inkColor))],
        ['uInkTint', new Uniform(inkTint)],
        ['uThickness', new Uniform(new Vector2())],
        ['uDepthThreshold', new Uniform(depthThreshold)],
        ['uNormalThreshold', new Uniform(normalThreshold)],
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
    if (params.normalThreshold !== undefined) u.get('uNormalThreshold').value = params.normalThreshold
    if (params.strength !== undefined) u.get('uStrength').value = params.strength
    if (params.fadeStart !== undefined) u.get('uFade').value.x = params.fadeStart
    if (params.fadeEnd !== undefined) u.get('uFade').value.y = params.fadeEnd
  }
}
