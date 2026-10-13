import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm'
import { retargetMixamoAnimation } from '../character/retarget'
import { ASSETS } from '../assets'

// DEVELOPMENT TOOL — open the dev site with ?bake=clips.
//
// Retargets the Mixamo FBX clips onto the avatar with the site's own retargeting code,
// thins out keyframes that interpolation reproduces anyway, and saves the result as one
// compact JSON file (public/animations/clips.vN.json). Visitors then download a small
// file and skip FBX parsing entirely (FBXLoader blocked the main thread ~350 ms for the
// idle clip alone, and it was the largest download after the avatar).
//
// Re-run it whenever the avatar or a source clip in assets-src/animations changes.

const SOURCES = {
  idle: '/assets-src/animations/idle.fbx',
  walk: '/assets-src/animations/walk.fbx',
  run: '/assets-src/animations/run.fbx',
}
const OUTPUT = 'animations/clips.v1.json'

// Below these errors a removed keyframe is invisible: ~0.06° of joint rotation, 0.3 mm
// of hip travel.
const ROT_TOLERANCE = 0.001 // radians
const POS_TOLERANCE = 0.0003 // metres

const _a = new THREE.Quaternion()
const _b = new THREE.Quaternion()
const _q = new THREE.Quaternion()
const _k = new THREE.Quaternion()

function quatError(values, i, a, b, t) {
  _a.fromArray(values, a * 4)
  _b.fromArray(values, b * 4)
  _q.slerpQuaternions(_a, _b, t)
  _k.fromArray(values, i * 4)
  return 2 * Math.acos(Math.min(1, Math.abs(_q.dot(_k))))
}

function vecError(values, i, a, b, t, size) {
  let err = 0
  for (let c = 0; c < size; c++) {
    const v = values[a * size + c] + (values[b * size + c] - values[a * size + c]) * t
    err = Math.max(err, Math.abs(v - values[i * size + c]))
  }
  return err
}

/**
 * Keep only the keyframes interpolation can't reproduce. For each candidate span from
 * the last kept key to a later key, every skipped key in between must be within
 * tolerance — so error can't accumulate across many removed keys.
 */
function reduceTrack(track) {
  const times = track.times
  const values = track.values
  const n = times.length
  if (n <= 2) return track
  const isQuat = track instanceof THREE.QuaternionKeyframeTrack
  const size = values.length / n
  const tolerance = isQuat ? ROT_TOLERANCE : POS_TOLERANCE
  const keep = [0]
  let anchor = 0
  for (let end = 2; end < n; end++) {
    let ok = true
    for (let i = anchor + 1; i < end && ok; i++) {
      const t = (times[i] - times[anchor]) / (times[end] - times[anchor])
      const err = isQuat ? quatError(values, i, anchor, end, t) : vecError(values, i, anchor, end, t, size)
      if (err > tolerance) ok = false
    }
    if (!ok) {
      anchor = end - 1
      keep.push(anchor)
    }
  }
  keep.push(n - 1)
  const newTimes = keep.map((i) => times[i])
  const newValues = keep.flatMap((i) => Array.from(values.subarray(i * size, i * size + size)))
  return new track.constructor(track.name, newTimes, newValues)
}

const round = (x, digits) => Number(x.toFixed(digits))

function serialize(clip) {
  const json = THREE.AnimationClip.toJSON(clip)
  for (const t of json.tracks) {
    t.times = t.times.map((x) => round(x, 4))
    t.values = t.values.map((x) => round(x, t.type === 'quaternion' ? 5 : 5))
  }
  return json
}

export async function run() {
  const log = (msg) => {
    console.log(`[bake] ${msg}`)
    document.title = `bake: ${msg}`
  }
  const gltfLoader = new GLTFLoader()
  gltfLoader.register((parser) => new VRMLoaderPlugin(parser))
  const gltf = await gltfLoader.loadAsync(ASSETS.avatar.url)
  const vrm = gltf.userData.vrm
  VRMUtils.removeUnnecessaryVertices(gltf.scene)
  VRMUtils.combineSkeletons(gltf.scene)
  VRMUtils.rotateVRM0(vrm)
  vrm.scene.updateMatrixWorld(true)

  const fbx = new FBXLoader()
  const out = { version: 1, avatar: ASSETS.avatar.url, clips: {} }
  for (const [name, url] of Object.entries(SOURCES)) {
    const asset = await fbx.loadAsync(url)
    const clip = retargetMixamoAnimation(asset, vrm)
    const before = clip.tracks.reduce((s, t) => s + t.times.length, 0)
    clip.tracks = clip.tracks.map(reduceTrack)
    clip.name = name
    const after = clip.tracks.reduce((s, t) => s + t.times.length, 0)
    out.clips[name] = serialize(clip)
    log(`${name}: ${clip.tracks.length} tracks, keyframes ${before} → ${after}`)
  }

  const body = JSON.stringify(out)
  const res = await fetch(`/__dev/write?file=${encodeURIComponent(OUTPUT)}`, { method: 'POST', body })
  log(`${await res.text()} (${(body.length / 1024).toFixed(0)} KB)`)
  return { bytes: body.length, clips: Object.keys(out.clips) }
}
