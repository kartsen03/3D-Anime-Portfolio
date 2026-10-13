import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { VRMLoaderPlugin } from '@pixiv/three-vrm'
import { ASSETS } from '../assets'
import { progressFor } from '../systems/progress'

// The character's assets start downloading and parsing the moment the 3D chunk is
// imported — not when the <Canvas> mounts.
//
// WHY: R3F creates its renderer only after it has measured the canvas, which browsers
// postpone for tabs that aren't being drawn (a link opened in a background tab). Loading
// from inside the canvas would leave the downloads waiting on that measurement, too.
// Starting here also overlaps parsing with React and renderer start-up on every visit.
// Components read the results with React 19's use(), which suspends until they resolve.

const gltfLoader = new GLTFLoader()
gltfLoader.register((parser) => new VRMLoaderPlugin(parser))

export const avatarPromise = gltfLoader.loadAsync(ASSETS.avatar.url, progressFor(ASSETS.avatar.url))

// Animation clips arrive already retargeted onto this avatar's humanoid (see
// src/world/dev/bakeClips.js), so they parse straight into AnimationClips: no FBX
// loader, no retargeting maths at runtime.
export const clipsPromise = new THREE.FileLoader()
  .setResponseType('json')
  .loadAsync(ASSETS.clips.url, progressFor(ASSETS.clips.url))
  .then((data) => {
    const clips = {}
    for (const [name, json] of Object.entries(data.clips)) clips[name] = THREE.AnimationClip.parse(json)
    return clips
  })
