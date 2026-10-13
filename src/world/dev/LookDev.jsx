import { useEffect } from 'react'
import { advance, useThree } from '@react-three/fiber'
import { runtime } from '../systems/runtime'
import { useStore } from '../../state/store'

// DEVELOPMENT TOOL — mounted only with ?lookdev on the dev server.
// Exposes window.__lookdev for art reviews from scripts:
//   drive(seconds)            advance the world that many seconds at 60 fps (works even
//                             when the tab isn't drawing frames itself)
//   view(px,py,pz, tx,ty,tz)  frame a shot (freezes the follow camera)
//   shot(name)                render one frame and save the canvas to .shots/<name>.jpg
//   theme(id)                 switch theme and let the cross-fade settle
export default function LookDev() {
  const get = useThree((s) => s.get)

  useEffect(() => {
    let t = performance.now()
    const drive = async (seconds) => {
      const frames = Math.max(1, Math.round(seconds * 60))
      for (let i = 0; i < frames; i++) {
        t += 1000 / 60
        advance(t, true)
        if (i % 30 === 29) await new Promise((r) => setTimeout(r, 0))
      }
    }
    const view = async (px, py, pz, tx, ty, tz) => {
      runtime.freeCamera = true
      const cc = get().controls
      cc.minDistance = 0.1
      cc.maxDistance = 900
      cc.minPolarAngle = 0
      cc.maxPolarAngle = Math.PI
      cc.setLookAt(px, py, pz, tx, ty, tz, false)
      await drive(0.25)
    }
    const shot = async (name) => {
      t += 1000 / 60
      advance(t, true)
      // Read the canvas in the same task as the render, before the browser presents it.
      const url = get().gl.domElement.toDataURL('image/jpeg', 0.9)
      const blob = await (await fetch(url)).blob()
      const res = await fetch(`/__dev/shot?name=${name}`, { method: 'POST', body: blob })
      return res.text()
    }
    const theme = async (id) => {
      useStore.getState().setTheme(id)
      await drive(4)
    }
    const follow = () => {
      runtime.freeCamera = false
    }
    window.__lookdev = { drive, view, shot, theme, follow, get, runtime, store: useStore }
    return () => {
      delete window.__lookdev
    }
  }, [get])

  return null
}
