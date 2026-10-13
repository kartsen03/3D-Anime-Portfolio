import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { CameraControls } from '@react-three/drei'
import CameraControlsImpl from 'camera-controls'
import * as THREE from 'three'
import { runtime, FRAME } from '../systems/runtime'
import { damp } from '../character/locomotion'
import { landmarkById } from '../layout'
import { useStore } from '../../state/store'
import { sheetCoverage } from '../../ui/layoutMetrics'

const { ACTION } = CameraControlsImpl

const TARGET_HEIGHT = 1.2 // look at roughly chest height
const FOLLOW_LAMBDA = 8 // how tightly the camera tracks the character (1/s)
const LEAD_SECONDS = 0.3 // look slightly ahead of where the character is heading
const BASE_FOV = 40 // vertical, degrees, on landscape screens
const MIN_HORIZONTAL_FOV = 56 // keep at least this much width visible on portrait screens

// Third-person camera.
//
// Built on camera-controls (via drei) because its damping is time-based: the same feel
// at 60, 120 or 144 Hz. The old OrbitControls rig damped per *call* and was updated
// twice per frame, so it felt different on every monitor. It also enforces the limits
// the old camera lacked: no zooming into the character, no orbiting under the island.
//
// Each frame, before camera-controls updates (priority -2 < -1), the follow point is
// damped toward the character and the whole rig is translated there. Input, movement
// and camera all land in the same frame, so there's no lag between them.
export default function CameraRig() {
  const ref = useRef()
  const camera = useThree((s) => s.camera)
  const width = useThree((s) => s.size.width)
  const height = useThree((s) => s.size.height)

  const follow = useRef(new THREE.Vector3())
  const mode = useRef('follow') // 'follow' | 'focus' | 'returning'
  const viewShift = useRef({ x: 0, y: 0 })

  // Responsive lens: on tall, narrow screens widen the vertical FOV so the world doesn't
  // shrink to a sliver around the character.
  useEffect(() => {
    const aspect = width / Math.max(height, 1)
    const vForMinH = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(MIN_HORIZONTAL_FOV / 2)) / aspect))
    camera.fov = THREE.MathUtils.clamp(Math.max(BASE_FOV, vForMinH), BASE_FOV, 66)
    camera.updateProjectionMatrix()
  }, [camera, width, height])

  // Limits, input mapping and the opening pose.
  useEffect(() => {
    const cc = ref.current
    cc.minDistance = 3.4
    cc.maxDistance = 15
    cc.minPolarAngle = 0.45 // ~26° from straight down
    cc.maxPolarAngle = 1.47 // ~6° above the horizon: never under the island
    cc.smoothTime = 0.2
    cc.draggingSmoothTime = 0.09
    cc.azimuthRotateSpeed = 0.85
    cc.polarRotateSpeed = 0.7
    cc.dollySpeed = 0.45
    cc.mouseButtons.left = ACTION.ROTATE
    cc.mouseButtons.right = ACTION.ROTATE
    cc.mouseButtons.middle = ACTION.DOLLY
    cc.mouseButtons.wheel = ACTION.DOLLY
    cc.touches.one = ACTION.TOUCH_ROTATE
    cc.touches.two = ACTION.TOUCH_DOLLY
    cc.touches.three = ACTION.NONE

    const c = runtime.character
    follow.current.set(c.position.x, c.position.y + TARGET_HEIGHT, c.position.z)
    const portrait = width < height
    cc.moveTo(follow.current.x, follow.current.y, follow.current.z, false)
    // Behind the character's spawn heading, slightly above.
    cc.rotateTo(c.heading + Math.PI, 1.2, false)
    cc.dollyTo(portrait ? 9.5 : 7.2, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Section focus: frame the landmark beside the character while its sheet is open;
  // ease back behind the character when it closes.
  useEffect(
    () =>
      useStore.subscribe(
        (s) => s.activeSection,
        (id) => {
          const cc = ref.current
          if (!cc) return
          if (id) {
            const lm = landmarkById(id)
            // Frame the landmark and its approach point (where the character stands, or
            // is running to when the section was switched from inside the sheet).
            const target = new THREE.Vector3(
              lm.position[0] * 0.55 + lm.approach[0] * 0.45,
              1.7,
              lm.position[2] * 0.55 + lm.approach[2] * 0.45,
            )
            // Stand off to the side of the landmark's front, for a three-quarter view.
            const side = lm.yaw + 0.55
            const eye = new THREE.Vector3(
              target.x + Math.sin(side) * 7.5,
              target.y + 1.6,
              target.z + Math.cos(side) * 7.5,
            )
            mode.current = 'focus'
            cc.enabled = false
            cc.setLookAt(eye.x, eye.y, eye.z, target.x, target.y, target.z, true)
          } else {
            const c = runtime.character
            follow.current.set(c.position.x, c.position.y + TARGET_HEIGHT, c.position.z)
            mode.current = 'returning'
            cc.moveTo(follow.current.x, follow.current.y, follow.current.z, true).then(() => {
              if (mode.current === 'returning') {
                mode.current = 'follow'
                cc.enabled = useStore.getState().phase === 'explore'
              }
            })
          }
        },
      ),
    [],
  )

  // Camera input only while exploring (not during loading, the intro, or a sheet).
  useEffect(
    () =>
      useStore.subscribe(
        (s) => s.phase,
        (phase) => {
          if (ref.current && mode.current === 'follow') ref.current.enabled = phase === 'explore'
        },
        { fireImmediately: true },
      ),
    [],
  )

  useFrame((state, delta) => {
    const cc = ref.current
    if (!cc) return
    const dt = Math.min(delta, 1 / 20)
    const c = runtime.character

    if (mode.current === 'follow') {
      const tx = c.position.x + c.velocity.x * LEAD_SECONDS
      const tz = c.position.z + c.velocity.z * LEAD_SECONDS
      follow.current.x = damp(follow.current.x, tx, FOLLOW_LAMBDA, dt)
      follow.current.y = damp(follow.current.y, c.position.y + TARGET_HEIGHT, FOLLOW_LAMBDA, dt)
      follow.current.z = damp(follow.current.z, tz, FOLLOW_LAMBDA, dt)
      cc.moveTo(follow.current.x, follow.current.y, follow.current.z, false)
    }

    // Shift the projection so the focused landmark stays centred in the part of the
    // screen the open sheet leaves free (a lens shift — nothing in the scene moves).
    const open = useStore.getState().activeSection !== null
    const cover = sheetCoverage(width, height)
    const goalX = open && cover.side === 'right' ? cover.size / 2 : 0
    const goalY = open && cover.side === 'bottom' ? cover.size / 2 : 0
    const v = viewShift.current
    v.x = damp(v.x, goalX, 7, dt)
    v.y = damp(v.y, goalY, 7, dt)
    if (Math.abs(v.x) > 0.5 || Math.abs(v.y) > 0.5) {
      state.camera.setViewOffset(width, height, v.x, v.y, width, height)
    } else if (state.camera.view?.enabled) {
      state.camera.clearViewOffset()
    }
  }, FRAME.follow)

  return <CameraControls ref={ref} makeDefault />
}
