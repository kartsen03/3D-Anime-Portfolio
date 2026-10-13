import * as THREE from 'three'
import { WALK_SPEED, RUN_SPEED } from './locomotion'

// Idle / walk / run as a 1-D blend space driven by speed, the way game engines do it.
//
// The old version switched between three discrete states with 0.2 s crossfades. That
// pops when you tap a key, and while walk and run crossfade the feet disagree (one clip
// has the left foot down while the other has it up), which reads as a stumble.
//
// Here:
//  • Weights come straight from the (smoothed) speed, so the blend is continuous.
//  • Walk and run share ONE locomotion phase. Each clip's time is derived from it, with a
//    per-clip offset measured at load so that both clips plant the left foot at phase 0.
//    Blending two foot-synchronised cycles looks like one gait speeding up.
//  • The phase advances by distance travelled ÷ stride length, so stride matches speed
//    and the feet don't slide at in-between speeds.

const _pos = new THREE.Vector3()

/**
 * Find the clip time at which the left foot is lowest (planted), by posing a scratch
 * mixer at sample times. Runs once per clip at load.
 */
function leftFootPlantTime(vrm, clip, samples = 48) {
  const mixer = new THREE.AnimationMixer(vrm.scene)
  const action = mixer.clipAction(clip)
  action.play()
  const foot = vrm.humanoid.getNormalizedBoneNode('leftFoot')
  let bestT = 0
  let bestY = Infinity
  for (let i = 0; i < samples; i++) {
    const t = (i / samples) * clip.duration
    action.time = t
    mixer.update(0)
    foot.updateWorldMatrix(true, false)
    const y = foot.getWorldPosition(_pos).y
    if (y < bestY) {
      bestY = y
      bestT = t
    }
  }
  action.stop()
  mixer.uncacheRoot(vrm.scene)
  return bestT
}

export function createLocomotionAnimator(vrm, clips) {
  const mixer = new THREE.AnimationMixer(vrm.scene)
  const idle = mixer.clipAction(clips.idle)
  const walk = mixer.clipAction(clips.walk)
  const run = mixer.clipAction(clips.run)

  const walkDur = clips.walk.duration
  const runDur = clips.run.duration
  const walkOffset = leftFootPlantTime(vrm, clips.walk) / walkDur
  const runOffset = leftFootPlantTime(vrm, clips.run) / runDur
  // Metres covered per full gait cycle at each clip's own pace.
  const walkStride = WALK_SPEED * walkDur
  const runStride = RUN_SPEED * runDur

  let phase = 0

  function start() {
    for (const a of [idle, walk, run]) {
      a.reset()
      a.enabled = true
      a.play()
    }
    // Walk and run are posed manually from the shared phase, so the mixer must not
    // advance their clocks itself.
    walk.paused = true
    run.paused = true
    idle.setEffectiveWeight(1)
    walk.setEffectiveWeight(0)
    run.setEffectiveWeight(0)
  }

  function stop() {
    for (const a of [idle, walk, run]) a.stop()
  }

  function update(speed, dt) {
    let wIdle, wWalk, wRun
    if (speed <= WALK_SPEED) {
      const t = speed / WALK_SPEED
      // Ease the idle↔walk blend so the first step reads as a deliberate start.
      const e = t * t * (3 - 2 * t)
      wIdle = 1 - e
      wWalk = e
      wRun = 0
    } else {
      const t = Math.min((speed - WALK_SPEED) / (RUN_SPEED - WALK_SPEED), 1)
      wIdle = 0
      wWalk = 1 - t
      wRun = t
    }

    const stride = walkStride + (runStride - walkStride) * wRun
    phase = (phase + (speed * dt) / stride) % 1

    walk.time = ((phase + walkOffset) % 1) * walkDur
    run.time = ((phase + runOffset) % 1) * runDur

    idle.setEffectiveWeight(wIdle)
    walk.setEffectiveWeight(wWalk)
    run.setEffectiveWeight(wRun)

    mixer.update(dt)
  }

  function dispose() {
    stop()
    mixer.uncacheRoot(vrm.scene)
  }

  return { mixer, start, stop, update, dispose }
}
