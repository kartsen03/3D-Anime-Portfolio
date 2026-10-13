import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
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
const fbxLoader = new FBXLoader()

export const avatarPromise = gltfLoader.loadAsync(ASSETS.avatar.url, progressFor(ASSETS.avatar.url))

export const clipAssetsPromise = Promise.all(
  ['idle', 'walk', 'run'].map((name) => fbxLoader.loadAsync(ASSETS[name].url, progressFor(ASSETS[name].url))),
).then(([idle, walk, run]) => ({ idle, walk, run }))
