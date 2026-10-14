import * as THREE from 'three'
import { damp } from './locomotion'

// Small signs of life layered on top of the animation clips.
//
// Look-at: while the character stands still and the camera is in front of them, the neck
// and head turn toward the camera (40% / 60% of the turn, within the range a real neck
// allows) and the VRM's eye look-at follows it too. Walking, or with the camera behind,
// the turn eases back to whatever the clip is doing.
//
// The turn is built in the character's own frame (yaw about its up axis, then pitch about
// its turned side axis) and converted into each bone's parent space, so it doesn't depend
// on how a model's bones happen to be oriented.
//
// Blink: every few seconds, with the odd double blink, through the model's blink
// expression.

const MAX_YAW = 1.0 // radians, neck and head together
const MAX_PITCH_UP = 0.4
const MAX_PITCH_DOWN = 0.35
const LOOK_LAMBDA = 4 // 1/s: slow enough to read as attention, not tracking

const UP = new THREE.Vector3(0, 1, 0)
const SIDE = new THREE.Vector3(1, 0, 0)
const _headPos = new THREE.Vector3()
const _dir = new THREE.Vector3()
const _rootQ = new THREE.Quaternion()
const _rootQInv = new THREE.Quaternion()
const _qYaw = new THREE.Quaternion()
const _qPitch = new THREE.Quaternion()
const _qWorld = new THREE.Quaternion()
const _qParent = new THREE.Quaternion()
const _qLocal = new THREE.Quaternion()

export function createLifeLayer(vrm) {
  const neck = vrm.humanoid.getNormalizedBoneNode('neck')
  const head = vrm.humanoid.getNormalizedBoneNode('head')
  const rawHead = vrm.humanoid.getRawBoneNode('head')
  const look = { yaw: 0, pitch: 0 }
  const blink = { wait: 1.5 + Math.random() * 2, t: -1, again: false }

  // Rotate `bone` by this share of the current look, expressed in the root's frame.
  const turn = (bone, share) => {
    if (!bone?.parent) return
    _qYaw.setFromAxisAngle(UP, look.yaw * share)
    _qPitch.setFromAxisAngle(SIDE, -look.pitch * share) // +X pitch tips a +Z face downward
    // Root-frame rotation → world (conjugate by the root), then into the bone's parent
    // space: local' = parent⁻¹ · R · parent · local.
    _qWorld.copy(_rootQ).multiply(_qYaw).multiply(_qPitch).multiply(_rootQInv)
    bone.parent.updateWorldMatrix(true, false)
    bone.parent.getWorldQuaternion(_qParent)
    _qLocal.copy(_qParent).invert().multiply(_qWorld).multiply(_qParent)
    bone.quaternion.premultiply(_qLocal)
  }

  if (vrm.lookAt) vrm.lookAt.autoUpdate = true

  return {
    /** Call after the animation mixer and before vrm.update(). */
    update(root, camera, speed, dt) {
      if (vrm.lookAt && vrm.lookAt.target !== camera) vrm.lookAt.target = camera

      // Where the camera is, seen from the head, in the character's own frame (+Z ahead).
      rawHead.getWorldPosition(_headPos)
      root.getWorldQuaternion(_rootQ)
      _rootQInv.copy(_rootQ).invert()
      _dir.copy(camera.position).sub(_headPos).applyQuaternion(_rootQInv)
      const yaw = Math.atan2(_dir.x, _dir.z)
      const pitch = Math.atan2(_dir.y, Math.hypot(_dir.x, _dir.z))
      const weight = THREE.MathUtils.smoothstep(0.45 - speed, 0, 0.37) * THREE.MathUtils.smoothstep(2.1 - Math.abs(yaw), 0, 0.6)
      look.yaw = damp(look.yaw, THREE.MathUtils.clamp(yaw, -MAX_YAW, MAX_YAW) * weight, LOOK_LAMBDA, dt)
      look.pitch = damp(look.pitch, THREE.MathUtils.clamp(pitch, -MAX_PITCH_DOWN, MAX_PITCH_UP) * weight, LOOK_LAMBDA, dt)
      if (Math.abs(look.yaw) + Math.abs(look.pitch) > 1e-4) {
        turn(neck, 0.4)
        turn(head, 0.6)
      }

      // Blink: close in 70 ms, hold 40 ms, open in 110 ms.
      const expressions = vrm.expressionManager
      if (!expressions) return
      if (blink.t < 0) {
        blink.wait -= dt
        if (blink.wait <= 0) blink.t = 0
        return
      }
      blink.t += dt
      const t = blink.t
      expressions.setValue('blink', t < 0.07 ? t / 0.07 : t < 0.11 ? 1 : Math.max(0, 1 - (t - 0.11) / 0.11))
      if (t >= 0.22) {
        blink.t = -1
        // One blink in five is a quick double.
        blink.again = !blink.again && Math.random() < 0.2
        blink.wait = blink.again ? 0.12 : 2.2 + Math.random() * 3.8
      }
    },
  }
}
