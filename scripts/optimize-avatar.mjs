// Shrinks the VRM avatar without changing how it looks.
//
// The VIVERSE export (assets-src/avatar.original.vrm, 8.1 MB) carries a lot the site
// never uses:
//   • 63 morph targets, of which only the ~17 behind the standard VRM expressions
//     (blink, the five vowel mouth shapes, joy/angry/sorrow/fun) are ever driven. The
//     rest are face-identity sculpts already baked into the mesh, and ARKit shapes
//     only referenced by duplicate "unknown" expression groups (the cause of the loader
//     warnings) or by blend-shape eye look-at, which this model doesn't use (its lookAt
//     type is "Bone").
//   • A 2048² clothing texture stored as a 3 MB PNG although its material is opaque,
//     so it has no alpha to preserve: JPEG holds it at a fraction of the size.
// It rewrites the GLB properly — dropping the unused data and renumbering every
// accessor and buffer view that referenced it — so the output is a clean, valid glTF.
//
// Usage: node scripts/optimize-avatar.mjs [input] [output]

import { readFileSync, writeFileSync } from 'node:fs'
import { PNG } from 'pngjs'
import jpeg from 'jpeg-js'

const input = process.argv[2] ?? 'assets-src/avatar.original.vrm'
const output = process.argv[3] ?? 'public/models/avatar.v2.vrm'
const JPEG_QUALITY = 90
// The character never covers more than ~700 px of screen height, so a 2048² texture's
// detail is never seen; halving it to 1024² quarters its memory and download.
const MAX_TEXTURE_SIZE = 1024

/** Halve an RGBA image with a 2×2 box filter (a clean, alias-free downscale by 2). */
function halve({ data, width, height }) {
  const w = width >> 1
  const h = height >> 1
  const out = Buffer.alloc(w * h * 4)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      for (let c = 0; c < 4; c++) {
        const i = (y * 2 * width + x * 2) * 4 + c
        const sum = data[i] + data[i + 4] + data[i + width * 4] + data[i + width * 4 + 4]
        out[(y * w + x) * 4 + c] = (sum + 2) >> 2
      }
    }
  }
  return { data: out, width: w, height: h }
}

// VRM 0.x expression presets the site can drive. "unknown" groups are duplicates the
// exporter added, and look* presets only apply to blend-shape look-at.
const KEEP_PRESETS = new Set(['neutral', 'a', 'i', 'u', 'e', 'o', 'blink', 'blink_l', 'blink_r', 'joy', 'angry', 'sorrow', 'fun'])

// ---------- read ----------
const src = readFileSync(input)
if (src.readUInt32LE(0) !== 0x46546c67) throw new Error('not a GLB file')
const jsonLength = src.readUInt32LE(12)
const json = JSON.parse(src.subarray(20, 20 + jsonLength).toString('utf8'))
const binStart = 20 + jsonLength + 8
const bin = src.subarray(binStart, binStart + src.readUInt32LE(20 + jsonLength))

const vrm = json.extensions?.VRM
if (!vrm) throw new Error('expected a VRM 0.x file (extensions.VRM)')

// ---------- 1. decide which morph targets survive, per mesh ----------
const groups = vrm.blendShapeMaster?.blendShapeGroups ?? []
const keptGroups = groups.filter((g) => KEEP_PRESETS.has(g.presetName))
const keepByMesh = new Map() // meshIndex -> Set(old morph index)
for (const g of keptGroups) {
  for (const b of g.binds ?? []) {
    if (!keepByMesh.has(b.mesh)) keepByMesh.set(b.mesh, new Set())
    keepByMesh.get(b.mesh).add(b.index)
  }
}

const remapByMesh = new Map() // meshIndex -> Map(old -> new)
json.meshes.forEach((mesh, mi) => {
  const keep = [...(keepByMesh.get(mi) ?? [])].sort((a, b) => a - b)
  const remap = new Map(keep.map((oldIdx, newIdx) => [oldIdx, newIdx]))
  remapByMesh.set(mi, remap)
  const filterList = (list) => (list ? keep.map((i) => list[i]) : list)
  for (const prim of mesh.primitives) {
    if (prim.targets) {
      prim.targets = filterList(prim.targets)
      if (prim.targets.length === 0) delete prim.targets
    }
    if (prim.extras?.targetNames) {
      prim.extras.targetNames = filterList(prim.extras.targetNames)
      if (prim.extras.targetNames.length === 0) delete prim.extras.targetNames
    }
  }
  if (mesh.extras?.targetNames) {
    mesh.extras.targetNames = filterList(mesh.extras.targetNames)
    if (mesh.extras.targetNames.length === 0) delete mesh.extras.targetNames
  }
  if (mesh.weights) {
    mesh.weights = filterList(mesh.weights)
    if (mesh.weights.length === 0) delete mesh.weights
  }
})

vrm.blendShapeMaster.blendShapeGroups = keptGroups.map((g) => ({
  ...g,
  binds: (g.binds ?? []).map((b) => ({ ...b, index: remapByMesh.get(b.mesh).get(b.index) })),
}))

// ---------- 2. garbage-collect accessors ----------
const usedAccessors = new Set()
for (const mesh of json.meshes) {
  for (const prim of mesh.primitives) {
    Object.values(prim.attributes).forEach((a) => usedAccessors.add(a))
    if (prim.indices !== undefined) usedAccessors.add(prim.indices)
    for (const t of prim.targets ?? []) Object.values(t).forEach((a) => usedAccessors.add(a))
  }
}
for (const skin of json.skins ?? []) if (skin.inverseBindMatrices !== undefined) usedAccessors.add(skin.inverseBindMatrices)
for (const anim of json.animations ?? []) for (const s of anim.samplers) usedAccessors.add(s.input).add(s.output)

const accessorMap = new Map()
const accessors = []
json.accessors.forEach((acc, i) => {
  if (!usedAccessors.has(i)) return
  accessorMap.set(i, accessors.length)
  accessors.push(acc)
})
const mapAcc = (i) => accessorMap.get(i)
for (const mesh of json.meshes) {
  for (const prim of mesh.primitives) {
    for (const k of Object.keys(prim.attributes)) prim.attributes[k] = mapAcc(prim.attributes[k])
    if (prim.indices !== undefined) prim.indices = mapAcc(prim.indices)
    for (const t of prim.targets ?? []) for (const k of Object.keys(t)) t[k] = mapAcc(t[k])
  }
}
for (const skin of json.skins ?? []) if (skin.inverseBindMatrices !== undefined) skin.inverseBindMatrices = mapAcc(skin.inverseBindMatrices)
for (const anim of json.animations ?? [])
  for (const s of anim.samplers) {
    s.input = mapAcc(s.input)
    s.output = mapAcc(s.output)
  }
json.accessors = accessors

// ---------- 3. re-encode opaque PNG textures as JPEG ----------
// An image can be re-encoded only if every material using it is OPAQUE (so alpha is
// never read). VRM's own thumbnail (meta.texture) is left alone.
const imageMaterials = new Map()
const addUse = (texInfo, material) => {
  if (!texInfo) return
  const image = json.textures[texInfo.index].source
  if (!imageMaterials.has(image)) imageMaterials.set(image, [])
  imageMaterials.get(image).push(material)
}
for (const m of json.materials) {
  addUse(m.pbrMetallicRoughness?.baseColorTexture, m)
  addUse(m.emissiveTexture, m)
  addUse(m.normalTexture, m)
  addUse(m.occlusionTexture, m)
}
const replacedImageData = new Map() // bufferView index -> Buffer
json.images.forEach((img, i) => {
  const users = imageMaterials.get(i) ?? []
  const opaque = users.length > 0 && users.every((m) => (m.alphaMode ?? 'OPAQUE') === 'OPAQUE')
  if (!opaque || img.mimeType !== 'image/png') return
  const view = json.bufferViews[img.bufferView]
  const pngBytes = bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength)
  const png = PNG.sync.read(Buffer.from(pngBytes))
  let image = { data: png.data, width: png.width, height: png.height }
  while (image.width > MAX_TEXTURE_SIZE || image.height > MAX_TEXTURE_SIZE) image = halve(image)
  const jpg = jpeg.encode(image, JPEG_QUALITY).data
  replacedImageData.set(img.bufferView, jpg)
  img.mimeType = 'image/jpeg'
  console.log(
    `image ${i}: ${png.width}×${png.height} PNG ${(pngBytes.length / 1e6).toFixed(2)} MB → ${image.width}×${image.height} JPEG ${(jpg.length / 1e6).toFixed(2)} MB`,
  )
})

// ---------- 4. garbage-collect buffer views and rebuild the binary chunk ----------
const usedViews = new Set()
for (const acc of json.accessors) {
  if (acc.bufferView !== undefined) usedViews.add(acc.bufferView)
  if (acc.sparse) {
    usedViews.add(acc.sparse.indices.bufferView)
    usedViews.add(acc.sparse.values.bufferView)
  }
}
for (const img of json.images ?? []) if (img.bufferView !== undefined) usedViews.add(img.bufferView)

const viewMap = new Map()
const views = []
const chunks = []
let offset = 0
json.bufferViews.forEach((view, i) => {
  if (!usedViews.has(i)) return
  const data = replacedImageData.get(i) ?? bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength)
  const pad = (4 - (offset % 4)) % 4 // keep every view 4-byte aligned for typed-array access
  if (pad) {
    chunks.push(Buffer.alloc(pad))
    offset += pad
  }
  viewMap.set(i, views.length)
  views.push({ ...view, buffer: 0, byteOffset: offset, byteLength: data.length })
  chunks.push(Buffer.from(data))
  offset += data.length
})
for (const acc of json.accessors) {
  if (acc.bufferView !== undefined) acc.bufferView = viewMap.get(acc.bufferView)
  if (acc.sparse) {
    acc.sparse.indices.bufferView = viewMap.get(acc.sparse.indices.bufferView)
    acc.sparse.values.bufferView = viewMap.get(acc.sparse.values.bufferView)
  }
}
for (const img of json.images ?? []) if (img.bufferView !== undefined) img.bufferView = viewMap.get(img.bufferView)
json.bufferViews = views
let newBin = Buffer.concat(chunks)
const binPad = (4 - (newBin.length % 4)) % 4
if (binPad) newBin = Buffer.concat([newBin, Buffer.alloc(binPad)])
json.buffers = [{ byteLength: newBin.length }]
json.asset.generator = `${json.asset.generator ?? 'unknown'} + optimize-avatar.mjs`

// ---------- 5. write the GLB ----------
let jsonBuf = Buffer.from(JSON.stringify(json), 'utf8')
const jsonPad = (4 - (jsonBuf.length % 4)) % 4
if (jsonPad) jsonBuf = Buffer.concat([jsonBuf, Buffer.alloc(jsonPad, 0x20)]) // JSON chunk pads with spaces
const header = Buffer.alloc(12)
header.writeUInt32LE(0x46546c67, 0)
header.writeUInt32LE(2, 4)
header.writeUInt32LE(12 + 8 + jsonBuf.length + 8 + newBin.length, 8)
const jsonHead = Buffer.alloc(8)
jsonHead.writeUInt32LE(jsonBuf.length, 0)
jsonHead.writeUInt32LE(0x4e4f534a, 4) // 'JSON'
const binHead = Buffer.alloc(8)
binHead.writeUInt32LE(newBin.length, 0)
binHead.writeUInt32LE(0x004e4942, 4) // 'BIN\0'
const out = Buffer.concat([header, jsonHead, jsonBuf, binHead, newBin])
writeFileSync(output, out)

const morphCounts = json.meshes.map((m) => `${m.name}: ${m.primitives[0].targets?.length ?? 0}`).join(', ')
console.log(`expression groups: ${groups.length} → ${keptGroups.length}`)
console.log(`morph targets per mesh: ${morphCounts}`)
console.log(`accessors ${accessorMap.size}, buffer views ${views.length}`)
console.log(`${input} ${(src.length / 1e6).toFixed(2)} MB → ${output} ${(out.length / 1e6).toFixed(2)} MB`)
