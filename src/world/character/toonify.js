import * as THREE from 'three'
import { MToonMaterial } from '@pixiv/three-vrm'
import { U } from '../materials/globalUniforms'

// Converts the avatar's materials to MToon, the anime toon material from the VRM
// standard (three-vrm's WebGL implementation, per CLAUDE.md).
//
// The export shipped plain PBR materials with 50% self-illumination baked in (an
// emissive equal to the albedo), which is why the old character looked flat and
// detached from the world's lighting. MToon gives real cel bands instead:
//  • shade colour = the albedo texture × the world's shadow tint, so shadows keep the
//    texture's detail and share the scene's hue (lavender by day, indigo at night);
//  • "toony" sets how hard the light/shadow edge is, "shift" moves where it falls;
//  • a parametric rim picks out the silhouette in the key light's colour.
// Skin gets a softer, lit-biased ramp so the face never turns harsh or patchy — the
// usual anime rule that faces stay mostly in light.

// lift: how far the shade tint is pulled toward white. Dark albedo (a navy suit) times a
// saturated shadow tint goes nearly black, so darker materials get a lighter tint.
const PRESETS = {
  skin: { shadingShiftFactor: 0.22, shadingToonyFactor: 0.72, giEqualizationFactor: 0.7, rim: 0.3, warm: 0.4, lift: 0.2 },
  hair: { shadingShiftFactor: 0.0, shadingToonyFactor: 0.85, giEqualizationFactor: 0.6, rim: 0.55, warm: 0.1, lift: 0.35 },
  cloth: { shadingShiftFactor: -0.02, shadingToonyFactor: 0.82, giEqualizationFactor: 0.6, rim: 0.6, warm: 0.1, lift: 0.45 },
}
const WHITE = new THREE.Color(1, 1, 1)

function kindOf(name = '') {
  if (/hair/i.test(name)) return 'hair'
  if (/head|body|eyelash|face|skin/i.test(name)) return 'skin'
  return 'cloth'
}

/** Replace every material on the VRM with a tuned MToonMaterial. Returns the new materials. */
export function toonifyVRM(vrm) {
  const created = []
  vrm.scene.traverse((obj) => {
    if (!obj.isMesh) return
    const list = Array.isArray(obj.material) ? obj.material : [obj.material]
    const converted = list.map((src) => {
      if (src.isMToonMaterial) return src
      const kind = kindOf(src.name)
      const preset = PRESETS[kind]
      const m = new MToonMaterial({
        color: src.color ? src.color.clone() : new THREE.Color(1, 1, 1),
        map: src.map ?? null,
        shadeColorFactor: new THREE.Color(1, 1, 1),
        shadeMultiplyTexture: src.map ?? null,
        shadingShiftFactor: preset.shadingShiftFactor,
        shadingToonyFactor: preset.shadingToonyFactor,
        giEqualizationFactor: preset.giEqualizationFactor,
        parametricRimColorFactor: new THREE.Color(0, 0, 0),
        parametricRimFresnelPowerFactor: 4,
        parametricRimLiftFactor: 0.02,
        rimLightingMixFactor: 1,
        transparent: src.transparent,
        alphaTest: src.alphaTest,
        side: src.side,
        depthWrite: src.depthWrite,
        fog: true,
      })
      m.name = `${src.name} (MToon)`
      m.userData.toonKind = kind
      created.push(m)
      src.dispose()
      return m
    })
    obj.material = Array.isArray(obj.material) ? converted : converted[0]
    // The character casts shadows on the world but doesn't receive them: on an animated,
    // skinned mesh one shared shadow map mostly produces self-shadow acne (dark blotches
    // on shoulders and knees), not readable shapes. Anime games usually do the same.
    obj.receiveShadow = false
  })
  return created
}

const _warm = new THREE.Color()
const _rim = new THREE.Color()

/**
 * Follow the world's current shadow and rim tints (cheap: a few colour copies). At
 * twilight, walking past a lantern warms the character's rim light: proximity to the
 * nearest lantern (`lanternNear`, 0..1) pulls the rim toward the lantern colour.
 */
export function syncToonMaterials(materials, delta, lanternNear = 0) {
  const night = U.uLanterns.value
  _rim.copy(U.uRimColor.value).lerp(U.uLanternColor.value, lanternNear * night)
  const boost = 1 + lanternNear * night * 1.6
  for (const m of materials) {
    // MToonMaterial only pushes some values into its shader inside update() — notably
    // alphaTest. three-vrm calls update() on the materials it created itself; these are
    // ours, so we must. Without it, the alpha cut-out that hides the body under the
    // clothes stays off and the hidden (black) texels show through as blotches.
    m.update(delta)
    const preset = PRESETS[m.userData.toonKind]
    // Skin shadows lean warm (a cheap stand-in for light scattering under the skin).
    _warm.copy(U.uToonShadow.value).lerp(U.uToonTerminator.value, preset.warm).lerp(WHITE, preset.lift)
    m.shadeColorFactor.copy(_warm)
    m.parametricRimColorFactor.copy(_rim).multiplyScalar(preset.rim * boost)
  }
}
