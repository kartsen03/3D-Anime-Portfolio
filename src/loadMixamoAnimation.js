import * as THREE from 'three'

// Mixamo rigs every downloaded clip with the same skeleton, whose bones are
// named "mixamorigHips", "mixamorigSpine", etc. A VRM humanoid uses the
// standardized VRM bone names ("hips", "spine", ...). Retargeting is, at its
// core, this name remap plus a per-bone rotation reconciliation (the two rigs
// have different rest poses / axis conventions).
export const mixamoVRMRigMap = {
  mixamorigHips: 'hips',
  mixamorigSpine: 'spine',
  mixamorigSpine1: 'chest',
  mixamorigSpine2: 'upperChest',
  mixamorigNeck: 'neck',
  mixamorigHead: 'head',
  mixamorigLeftShoulder: 'leftShoulder',
  mixamorigLeftArm: 'leftUpperArm',
  mixamorigLeftForeArm: 'leftLowerArm',
  mixamorigLeftHand: 'leftHand',
  mixamorigLeftHandThumb1: 'leftThumbMetacarpal',
  mixamorigLeftHandThumb2: 'leftThumbProximal',
  mixamorigLeftHandThumb3: 'leftThumbDistal',
  mixamorigLeftHandIndex1: 'leftIndexProximal',
  mixamorigLeftHandIndex2: 'leftIndexIntermediate',
  mixamorigLeftHandIndex3: 'leftIndexDistal',
  mixamorigLeftHandMiddle1: 'leftMiddleProximal',
  mixamorigLeftHandMiddle2: 'leftMiddleIntermediate',
  mixamorigLeftHandMiddle3: 'leftMiddleDistal',
  mixamorigLeftHandRing1: 'leftRingProximal',
  mixamorigLeftHandRing2: 'leftRingIntermediate',
  mixamorigLeftHandRing3: 'leftRingDistal',
  mixamorigLeftHandPinky1: 'leftLittleProximal',
  mixamorigLeftHandPinky2: 'leftLittleIntermediate',
  mixamorigLeftHandPinky3: 'leftLittleDistal',
  mixamorigRightShoulder: 'rightShoulder',
  mixamorigRightArm: 'rightUpperArm',
  mixamorigRightForeArm: 'rightLowerArm',
  mixamorigRightHand: 'rightHand',
  mixamorigRightHandThumb1: 'rightThumbMetacarpal',
  mixamorigRightHandThumb2: 'rightThumbProximal',
  mixamorigRightHandThumb3: 'rightThumbDistal',
  mixamorigRightHandIndex1: 'rightIndexProximal',
  mixamorigRightHandIndex2: 'rightIndexIntermediate',
  mixamorigRightHandIndex3: 'rightIndexDistal',
  mixamorigRightHandMiddle1: 'rightMiddleProximal',
  mixamorigRightHandMiddle2: 'rightMiddleIntermediate',
  mixamorigRightHandMiddle3: 'rightMiddleDistal',
  mixamorigRightHandRing1: 'rightRingProximal',
  mixamorigRightHandRing2: 'rightRingIntermediate',
  mixamorigRightHandRing3: 'rightRingDistal',
  mixamorigRightHandPinky1: 'rightLittleProximal',
  mixamorigRightHandPinky2: 'rightLittleIntermediate',
  mixamorigRightHandPinky3: 'rightLittleDistal',
  mixamorigLeftUpLeg: 'leftUpperLeg',
  mixamorigLeftLeg: 'leftLowerLeg',
  mixamorigLeftFoot: 'leftFoot',
  mixamorigLeftToeBase: 'leftToes',
  mixamorigRightUpLeg: 'rightUpperLeg',
  mixamorigRightLeg: 'rightLowerLeg',
  mixamorigRightFoot: 'rightFoot',
  mixamorigRightToeBase: 'rightToes',
}

// Retarget an already-loaded Mixamo FBX `asset` onto `vrm`'s humanoid and
// return a THREE.AnimationClip that plays correctly on the VRM.
//
// Adapted from the official three-vrm "humanoidAnimation" example
// (loadMixamoAnimation.js), with two deliberate changes:
//   1. It takes the pre-loaded FBX `asset` instead of a URL, so R3F's useLoader
//      can own the async load + Suspense + caching.
//   2. It never mutates the source tracks — it builds fresh keyframe arrays.
//      useLoader caches the asset and React StrictMode renders twice in dev, so
//      mutating `track.values` in place would double-apply and corrupt the motion.
export function retargetMixamoAnimation(asset, vrm) {
  // Mixamo names its clip "mixamo.com"; fall back to the first clip just in case.
  const clip =
    THREE.AnimationClip.findByName(asset.animations, 'mixamo.com') ??
    asset.animations[0]

  const tracks = [] // VRM-compatible KeyframeTracks accumulate here

  const restRotationInverse = new THREE.Quaternion()
  const parentRestWorldRotation = new THREE.Quaternion()
  const _quatA = new THREE.Quaternion()
  const _vec3 = new THREE.Vector3()

  // --- Hips-height scaling (the #1 retargeting bug if skipped) ---
  // Mixamo positions are authored in the source rig's scale (centimetre-ish),
  // but only the hips carry a position track (everything else is rotation).
  // We scale that position track by the ratio of THIS model's hip height to the
  // motion's hip height, so the character's feet stay planted on the ground
  // instead of sinking in or floating above it.
  const motionHipsHeight = asset.getObjectByName('mixamorigHips').position.y
  const vrmHipsY = vrm.humanoid
    .getNormalizedBoneNode('hips')
    .getWorldPosition(_vec3).y
  const vrmRootY = vrm.scene.getWorldPosition(_vec3).y
  const vrmHipsHeight = Math.abs(vrmHipsY - vrmRootY)
  const hipsPositionScale = vrmHipsHeight / motionHipsHeight

  // VRM 0.x uses a mirrored coordinate convention vs. VRM 1.0; we flip the
  // relevant axes when the model is a 0.x VRM.
  const isVRM0 = vrm.meta?.metaVersion === '0'

  clip.tracks.forEach((track) => {
    // Track names look like "mixamorigLeftArm.quaternion" — split off the bone.
    const [mixamoRigName, propertyName] = track.name.split('.')
    const vrmBoneName = mixamoVRMRigMap[mixamoRigName]
    const vrmNodeName = vrm.humanoid.getNormalizedBoneNode(vrmBoneName)?.name
    const mixamoRigNode = asset.getObjectByName(mixamoRigName)

    // Skip Mixamo bones with no VRM humanoid equivalent.
    if (vrmNodeName == null || mixamoRigNode == null) return

    // Capture the source bone's rest orientation and its parent's, so we can
    // express each keyframe as a rotation relative to the VRM's rest pose:
    // newRotation = parentRestWorld * mixamoRotation * restWorldInverse.
    mixamoRigNode.getWorldQuaternion(restRotationInverse).invert()
    mixamoRigNode.parent.getWorldQuaternion(parentRestWorldRotation)

    if (track instanceof THREE.QuaternionKeyframeTrack) {
      // Copy first, then reconcile each quaternion into VRM rest space.
      const values = Float32Array.from(track.values)
      for (let i = 0; i < values.length; i += 4) {
        _quatA.fromArray(values, i)
        _quatA.premultiply(parentRestWorldRotation).multiply(restRotationInverse)
        _quatA.toArray(values, i)
      }
      // VRM0 mirror: negate x and z of every quaternion (even flat indices).
      if (isVRM0) {
        for (let i = 0; i < values.length; i++) {
          if (i % 2 === 0) values[i] = -values[i]
        }
      }
      tracks.push(
        new THREE.QuaternionKeyframeTrack(
          `${vrmNodeName}.${propertyName}`,
          Array.from(track.times),
          Array.from(values),
        ),
      )
    } else if (track instanceof THREE.VectorKeyframeTrack) {
      // Position track (hips only). We keep ONLY the vertical (Y) component — the
      // up/down bob — scaled to this model's hip height, and ZERO the horizontal
      // (X/Z) components.
      //
      // Why: Mixamo clips (even "in place" ones) can bake forward root motion
      // into the hips position track — this walk drifts the hips ~1.7 m forward
      // over one cycle, then snaps back at the loop. Our controller owns
      // horizontal movement (it translates the root group), so letting the
      // animation ALSO translate the hips means the body races ahead of the root
      // and pops back every cycle. Stripping X/Z leaves the hips centered over
      // the root; the legs + arms + vertical bob carry the walk's feel.
      const values = Array.from(track.values, (v, i) =>
        i % 3 === 1 ? v * hipsPositionScale : 0,
      )
      tracks.push(
        new THREE.VectorKeyframeTrack(
          `${vrmNodeName}.${propertyName}`,
          Array.from(track.times),
          values,
        ),
      )
    }
  })

  return new THREE.AnimationClip('vrmAnimation', clip.duration, tracks)
}
