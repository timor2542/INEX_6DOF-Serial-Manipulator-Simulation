<template>
  <div ref="wrap" class="viewer-root">
    <div ref="canvasHost" class="canvas-host"></div>

    <!-- Overlay controls -->
    <div class="viewer-overlay">
      <el-checkbox v-model="ui.showGrid" @change="applyVisibility">Grid</el-checkbox>
      <el-checkbox v-model="ui.showWorldFrame" @change="applyVisibility">World Frame</el-checkbox>
      <el-checkbox v-model="ui.showLinkFrames" @change="applyVisibility">Link Frames</el-checkbox>
      <el-checkbox v-model="ui.showTcpFrame" @change="applyVisibility">TCP Frame</el-checkbox>
      <el-checkbox v-model="ui.showLabels" @change="applyVisibility">Labels</el-checkbox>

      <span style="opacity:.8;">&emsp;X</span>
      <el-color-picker v-model="ui.colors.x" size="small" @change="rebuildFrames" />
      <span style="opacity:.8;">&ensp;Y</span>
      <el-color-picker v-model="ui.colors.y" size="small" @change="rebuildFrames" />
      <span style="opacity:.8;">&ensp;Z</span>
      <el-color-picker v-model="ui.colors.z" size="small" @change="rebuildFrames" />

      <el-divider direction="horizontal" />
      <span style="opacity:.8; margin-left:6px;">Link Frame Length</span>
      <el-input-number v-model="ui.linkLen" :min="0.02" :max="0.4" :step="0.01" size="small" @change="rebuildFrames" />
      <span style="opacity:.8;">mm&emsp;TCP Frame Length</span>
      <el-input-number v-model="ui.tcpZLen" :min="0.04" :max="0.6" :step="0.01" size="small" @change="rebuildFrames" />
      <span style="opacity:.8;">mm</span>

      <el-divider direction="horizontal" />
      <el-button style="width:7%" size="large" @click="zoomIn">Zoom In</el-button>
      <el-button style="width:7%" size="large" @click="zoomOut">Zoom Out</el-button>
      <el-button style="width:10%;" size="large" @click="reset">Reset Camera</el-button>
      <el-button type="primary" style="width:10%;" size="large" @click="home">Set Home Config</el-button>
    </div>
    <!-- TCP Pose (ขวาบน) -->
    <div class="jog-overlay">
      <div v-for="(q, i) in robot.joints || []" :key="i"
        style="display:flex; align-items:center; gap:6px; margin:4px 0;">
        <span style="color:white; width:40px;">q{{ i + 1 }}</span>

        <el-slider :model-value="robot.joints[i]" @update:modelValue="val => clampToLimit(i, val)"
          @input="val => clampToLimit(i, val)" :min="jointLimits[i]?.min ?? -180" :max="jointLimits[i]?.max ?? 180"
          :step="1" style="flex:1;" />

        <div style="display:flex; align-items:center; gap:6px;">
          <el-button @click="stepJoint(i, -1)" size="small" circle>-</el-button>

          <el-input :model-value="jointTexts[i]" @input="val => onInputJoint(i, val)"
            @change="val => onInputJoint(i, val)" size="small" style="width:3.5rem; text-align:center;"
            inputmode="numeric" />

          <el-button @click="stepJoint(i, +1)" size="small" circle>+</el-button>
        </div>
        <span class="limit-chip" style="font-size:0.8rem; width:5.5rem; text-align:right;">
          [{{ jointLimits[i]?.min ?? -180 }}°, {{ jointLimits[i]?.max ?? 180 }}°]
        </span>

      </div>
    </div>
    <!-- Jog sliders -->
    <div class="pose-overlay">
      <div>TCP Pose</div>
      <div style="display:grid; grid-template-columns: 18x 1fr; gap:6px;">
        <span style="opacity:.8; grid-column:1 / -1; margin-top:4px;">— Position (X, Y, Z) —</span>
        <span>({{ fmt(eePose.x) }}, {{ fmt(eePose.y) }}, {{ fmt(eePose.z) }}) mm</span>
        <span style="opacity:.8; grid-column:1 / -1; margin-top:4px;">— Orientation (Rx, Ry, Rz) —</span>
        <span>({{ fmt(eePose.rx) }}, {{ fmt(eePose.ry) }}, {{ fmt(eePose.rz) }}) °</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import * as THREE from 'three'
import { storeToRefs } from 'pinia'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { onMounted, onBeforeUnmount, ref, reactive, watch } from 'vue'
import { useRobotStore } from '../stores/robot'
import { useThemeStore } from '../stores/theme'
import { fitCameraToObject } from '../utils/stlLoader'
import { useSerialStore } from '../stores/serial'

const eePose = reactive({ x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0 })
function fmt(n, d = 2) { return Number(n).toFixed(d) }

const serial = useSerialStore()
const { connected, logs } = storeToRefs(serial)

const canvasHost = ref(null)
let renderer, scene, camera, controls, animId, ro
const robot = useRobotStore()
const theme = useThemeStore()
const group = new THREE.Group()
if (!robot.joints || !Array.isArray(robot.joints)) {
  robot.joints = [0, 0, 0, 0, 0, 0]
}
const jointLimits = [
  { min: -100, max: 160 }, // J1 base
  { min: -40, max: 70 }, // J2 shoulder
  { min: -170, max: 60 }, // J3 elbow
  { min: -170, max: 170 }, // J4 wrist pitch
  { min: -180, max: 36 }, // J5 wrist roll
  { min: -180, max: 180 }  // J6 tool rotation
]
/* =========================================
   MDH Parameters (Craig Form) for WLKATA 6DOF
   ========================================= */
const MDH = [
  { i: 1, alpha: 0, a: 0.0, d: 127.00, thetaOffset: 0 },
  { i: 2, alpha: -Math.PI / 2, a: 29.69, d: 0.0, thetaOffset: -Math.PI / 2 },
  { i: 3, alpha: 0, a: 108.00, d: 0.0, thetaOffset: 0 },
  { i: 4, alpha: -Math.PI / 2, a: 20.00, d: 168.98, thetaOffset: 0 },
  { i: 5, alpha: Math.PI / 2, a: 0.0, d: 0.0, thetaOffset: Math.PI / 2 },
  { i: 6, alpha: Math.PI / 2, a: 0.0, d: -24.28, thetaOffset: 0 }
]
// ---- Jog logging: ทนลากเร็ว, log ไม่หาย และ log ค่าท้ายเมื่อปล่อย ----
const JOG_THROTTLE_MS = 50 // ปรับได้
const jogState = {
  prevLogged: robot.joints.slice(),     // ค่าสุดท้ายที่เรา "log" ไปแล้ว (ต่อข้อ)
  lastTs: Array(6).fill(0),             // เวลาที่ log ไปล่าสุด (ต่อข้อ)
  pending: Array(6).fill(null),         // ค่าที่รอ log (ต่อข้อ)
  raf: null
}
// Clamp a joint value to its [min, max] and write it back immediately.
// This keeps the input/slider in-range even while typing.
function clampToLimit(i, v) {
  const { min, max } = jointLimits[i] ?? { min: -180, max: 180 }
  let nv = Number(v)
  if (!Number.isFinite(nv)) nv = 0
  if (nv < min) nv = min
  if (nv > max) nv = max
  robot.joints[i] = nv
  return nv
}

// text shown in the input for each joint (keeps UI and model in sync)
const jointTexts = ref(robot.joints.map(v => String(Math.round(v))))

// keep text in sync when robot.joints is changed elsewhere (e.g., Home)
watch(() => robot.joints.slice(), now => {
  jointTexts.value = now.map(v => String(Math.round(v)))
}, { deep: false })

function clampDeg(i, vNum) {
  const { min, max } = jointLimits[i] ?? { min: -180, max: 180 }
  const n = Math.round(Number(vNum))
  return Math.min(max, Math.max(min, n))
}

// called on typing/commit in the input
function onInputJoint(i, raw) {
  // allow transient blanks while typing
  if (raw === '' || raw === '-' || raw === '+') {
    jointTexts.value[i] = raw
    return
  }
  const n = Number(raw)
  if (!Number.isFinite(n)) {
    // revert to current model if non-numeric junk
    jointTexts.value[i] = String(robot.joints[i])
    return
  }
  const clamped = clampDeg(i, n)
  jointTexts.value[i] = String(clamped)   // update visible text immediately
  robot.joints[i] = clamped               // update model (FK runs, sliders move)
}

// step buttons (– / +)
function stepJoint(i, delta) {
  const clamped = clampDeg(i, Number(robot.joints[i]) + delta)
  robot.joints[i] = clamped
  jointTexts.value[i] = String(clamped)
}

function logJog(i, fromDeg, toDeg) {
  serial.appendLog({
    dir: 'sys',
    text: `Jog q${i + 1}: ${fromDeg}° -> ${toDeg}°`,
    ts: Date.now()
  })
}

function onJog(i, val) {
  const now = performance.now()
  const last = jogState.prevLogged[i]
  // ถ้าค่าไม่เปลี่ยนจริง ๆ ก็ข้าม
  if (val === last) return

  // ถ้าเกินคูลดาวน์ -> log ทันที
  if (now - jogState.lastTs[i] >= JOG_THROTTLE_MS) {
    logJog(i, last, val)
    jogState.prevLogged[i] = val
    jogState.lastTs[i] = now
  } else {
    // ยังไม่ถึงคูลดาวน์ -> เก็บ pending ไว้ แล้วนัด rAF มาระบายทีหลัง
    jogState.pending[i] = val
    if (!jogState.raf) {
      jogState.raf = requestAnimationFrame(() => {
        const t = performance.now()
        for (let k = 0; k < jogState.pending.length; k++) {
          const pend = jogState.pending[k]
          if (pend == null) continue
          if (t - jogState.lastTs[k] >= JOG_THROTTLE_MS) {
            logJog(k, jogState.prevLogged[k], pend)
            jogState.prevLogged[k] = pend
            jogState.lastTs[k] = t
            jogState.pending[k] = null
          }
        }
        jogState.raf = null
      })
    }
  }
}

/* =========================================
   Transform: Tx·Rx·Tz·Rz
   ========================================= */
// === Correct MDH for WLKATA: Rx(alpha) * Tx(a) * Rz(theta) * Tz(b) ===
function mdhWlkata(alpha, a, b, theta) {
  const ca = Math.cos(alpha), sa = Math.sin(alpha)
  const ct = Math.cos(theta), st = Math.sin(theta)

  const T = new THREE.Matrix4()
  T.set(
    ct, -st, 0, a,
    st * ca, ct * ca, -sa, -b * sa,
    st * sa, ct * sa, ca, b * ca,
    0, 0, 0, 1
  )
  return T
}

function forwardTxRxTzRz(joints) {
  const q = joints.map(qd => qd * Math.PI / 180)
  const Ts = []
  let Tprev = new THREE.Matrix4().identity()

  for (let i = 0; i < MDH.length; i++) {
    const { alpha, a, d, thetaOffset } = MDH[i]
    const theta = q[i] + thetaOffset
    const A = mdhWlkata(alpha, a / 1000, d / 1000, theta)
    const T = Tprev.clone().multiply(A)
    Ts.push(T.clone())
    Tprev.copy(T)
  }
  return Ts
}


/* =========================================
   UI state
   ========================================= */
// --- Jog logging (diff per joint) ---
let _prevQ = robot.joints.slice()

// ป้องกันสแปมขณะลากสไลเดอร์: จำกัดความถี่ต่อข้อ
const _lastLogAt = Array(6).fill(0)
const JOG_LOG_COOLDOWN_MS = 60 // ปรับได้

watch(
  () => robot.joints.map(v => Math.round(v * 100) / 100), // ปัดทศนิยม 2 ตำแหน่ง
  (now) => {
    const t = Date.now()
    for (let i = 0; i < now.length; i++) {
      const oldVal = _prevQ[i]
      const newVal = now[i]
      if (newVal !== oldVal && t - _lastLogAt[i] >= JOG_LOG_COOLDOWN_MS) {
        serial.appendLog({
          dir: 'sys',
          text: `Jog q${i + 1}: ${oldVal}° -> ${newVal}°`,
          ts: t
        })
        _lastLogAt[i] = t
      }
    }
    _prevQ = now.slice()
  },
  { deep: false }
)

// --- ปุ่ม Home configuration ---
function home() {
  robot.joints = [0, 0, 0, 0, 0, 0]
  // ถ้าอยากฟิตกล้องให้เห็นทั้งแขนด้วย:
  // fit()
  serial.appendLog({
    dir: 'sys',
    text: 'Set Home configuration (q=[0,0,0,0,0,0])',
    ts: Date.now()
  })
}

const ui = reactive({
  showGrid: true,
  showWorldFrame: true,
  showLinkFrames: true,
  showTcpFrame: true,
  showLabels: true,
  colors: { x: '#ff4d4d', y: '#37d67a', z: '#4ea1ff' },
  linkLen: 0.08,
  tcpZLen: 0.14
})

let gridHelper
let worldFrame = null // ✅ world frame object
const linkNames = ['link1', 'link2', 'link3', 'link4', 'link5', 'link6']
const linkFrames = new Map()
let tcpFrame
const labels = new Map()
let toLoad = 0, loaded = 0

/* =========================================
   Init Scene
   ========================================= */
function init() {
  THREE.Object3D.DEFAULT_UP.set(0, 0, 1)
  scene = new THREE.Scene()
  scene.up.set(0, 0, 1)

  const w = canvasHost.value.clientWidth
  const h = canvasHost.value.clientHeight
  camera = new THREE.PerspectiveCamera(1, w / h, 0.1, 2000)
  camera.position.set(0, 0, 50)
  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(0, 0, false)
  canvasHost.value.appendChild(renderer.domElement)
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true

  const key = new THREE.DirectionalLight(0xffffff, 0.9)
  key.position.set(1.5, 1.8, 1.2)
  scene.add(key)
  scene.add(new THREE.AmbientLight(0xffffff, 0.25))

  gridHelper = new THREE.GridHelper(1.2, 24, 0x333a40, 0x2a2f34)
  gridHelper.rotation.x = Math.PI / 2
  scene.add(gridHelper)

  scene.add(group)
  loadSTLs()
  applyThemeToViewer()
  watch(() => theme.mode, applyThemeToViewer)
  watch(
    () => [ui.colors.x, ui.colors.y, ui.colors.z, ui.linkLen],
    () => buildWorldFrame(ui.linkLen, ui.colors)
  )
  anim()
}

/* =========================================
   Load STL
   ========================================= */
// ให้ Vite สร้างแผนที่ไฟล์เป็น URL
/** @type {Record<string, string>} */
const stlMap = import.meta.glob('/src/assets/stl/*.stl', { eager: true, query: '?url', import: 'default' })

function loadSTLs() {
  const loader = new STLLoader()
  const names = ['base', ...linkNames]
  toLoad = names.length
  loaded = 0

  names.forEach((n, i) => {
    const key = `/src/assets/stl/${n}.stl`
    const url = stlMap[key] // เป็น string ตาม JSDoc ด้านบน

    if (!url) {
      console.warn('STL not found:', key)
      afterOneLoaded()
      return
    }

    loader.load(
      url,
      (geo) => {
        geo.computeVertexNormals()
        const mat = new THREE.MeshStandardMaterial({
          color: i === 0 ? 0x616161 : (i === 2 || i === 4) ? 0xf57c00 : 0xbdbdbd,
          metalness: 0.2, roughness: 0.7
        })
        const mesh = new THREE.Mesh(geo, mat)
        mesh.name = n
        group.add(mesh)
        afterOneLoaded()
      },
      undefined,
      () => {
        const g = new THREE.CylinderGeometry(0.01, 0.01, 0.01, 1)
        const m = new THREE.MeshStandardMaterial({ color: 0x777777 })
        const mesh = new THREE.Mesh(g, m)
        mesh.name = n
        group.add(mesh)
        afterOneLoaded()
      }
    )
  })
}

function afterOneLoaded() {
  loaded++
  if (loaded === toLoad) {
    const base = group.getObjectByName('base')
    linkNames.forEach(n => {
      const link = group.getObjectByName(n)
      if (link) base.add(link)
    })
    rebuildFrames()
    fit()
  }

}

function rebuildFrames() {
  buildAllFramesOnce()
  buildWorldFrame(ui.linkLen, ui.colors)
  applyVisibility()
}

/* =========================================
   Build Frames
   ========================================= */
function buildAllFramesOnce() {
  linkFrames.forEach((grp) => grp.parent?.remove(grp))
  linkFrames.clear()
  if (tcpFrame?.parent) tcpFrame.parent.remove(tcpFrame)
  tcpFrame = null
  labels.forEach(sp => sp.parent?.remove(sp))
  labels.clear()

  const offsetStep = 0.018
  linkNames.forEach((n, idx) => {
    const mesh = group.getObjectByName(n)
    if (!mesh) return
    const frame = buildFrameGroup(ui.linkLen, ui.colors)
    mesh.add(frame)
    linkFrames.set(n, frame)
    const sp = createLabelSprite(n.toUpperCase())
    sp.position.set(0.08 + idx * 0.004, 0.02, 0.02 + idx * offsetStep)
    mesh.add(sp)
    labels.set(n, sp)
  })

  const l6 = group.getObjectByName('link6')
  if (l6) {
    tcpFrame = buildFrameGroup(ui.linkLen, ui.colors, ui.tcpZLen)
    l6.add(tcpFrame)
    const sp = createLabelSprite('TCP')
    sp.position.set(0.1, 0.03, 0.02 + linkNames.length * 0.018)
    l6.add(sp)
    labels.set('tcp', sp)
  }
}
// ✅ World Frame (axes at scene origin)
function buildWorldFrame(len, colors) {
  if (worldFrame) scene.remove(worldFrame)

  const grp = new THREE.Group()
  const headLen = Math.max(0.25 * len, 0.01)
  const headRadius = 0.5 * headLen

  grp.add(new THREE.ArrowHelper(
    new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 0),
    len, new THREE.Color(colors.x).getHex(), headLen, headRadius))
  grp.add(new THREE.ArrowHelper(
    new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 0),
    len, new THREE.Color(colors.y).getHex(), headLen, headRadius))
  grp.add(new THREE.ArrowHelper(
    new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, 0),
    len, new THREE.Color(colors.z).getHex(), headLen, headRadius))

  scene.add(grp)
  worldFrame = grp
}
function buildFrameGroup(len, colors, tcpZLen = null) {
  const grp = new THREE.Group()
  const headLen = Math.max(0.25 * len, 0.01)
  const headRadius = 0.5 * headLen
  grp.add(new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 0),
    len, new THREE.Color(colors.x).getHex(), headLen, headRadius))
  grp.add(new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 0),
    len, new THREE.Color(colors.y).getHex(), headLen, headRadius))
  const zLen = tcpZLen ?? len
  grp.add(new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, 0),
    zLen, new THREE.Color(colors.z).getHex(), headLen, headRadius))
  return grp
}

/* =========================================
   Labels
   ========================================= */
function createLabelSprite(text) {
  const canvas = document.createElement('canvas')
  const scale = 2
  canvas.width = 128 * scale
  canvas.height = 64 * scale
  const ctx = canvas.getContext('2d')
  ctx.scale(scale, scale)
  ctx.fillStyle = 'rgba(0,0,0,0.55)'
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'
  roundRect(ctx, 4, 8, 120, 28, 6, true, true)
  ctx.fillStyle = 'white'
  ctx.font = '16px ui-sans-serif'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, 12, 22)
  const tex = new THREE.CanvasTexture(canvas)
  tex.minFilter = THREE.LinearFilter
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false })
  const sp = new THREE.Sprite(mat)
  sp.scale.set(0.12, 0.06, 1)
  sp.renderOrder = 999
  return sp
}
function roundRect(ctx, x, y, w, h, r, fill, stroke) {
  if (w < 2 * r) r = w / 2
  if (h < 2 * r) r = h / 2
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
  if (fill) ctx.fill()
  if (stroke) ctx.stroke()
}

/* =========================================
   Theme
   ========================================= */
function applyThemeToViewer() {
  const isDark = document.documentElement.classList.contains('dark')
  const bg = isDark ? '#121417' : '#f5f7fb'
  const grid1 = isDark ? 0x333a40 : 0xbfc6d3
  const grid2 = isDark ? 0x2a2f34 : 0xd7dbe4
  if (scene) {
    scene.background = new THREE.Color(bg)
    if (gridHelper) scene.remove(gridHelper)
    gridHelper = new THREE.GridHelper(1.2, 24, grid1, grid2)
    gridHelper.rotation.x = Math.PI / 2
    scene.add(gridHelper)
    buildWorldFrame(ui.linkLen, ui.colors)
    applyVisibility()
  }
}

/* =========================================
   Visibility
   ========================================= */
function applyVisibility() {
  if (gridHelper) gridHelper.visible = ui.showGrid
  linkFrames.forEach((obj) => { obj.visible = ui.showLinkFrames })
  if (tcpFrame) tcpFrame.visible = ui.showTcpFrame
  labels.forEach((sp, key) => {
    if (key === 'tcp') sp.visible = ui.showLabels && ui.showTcpFrame
    else sp.visible = ui.showLabels && ui.showLinkFrames
  })
  if (worldFrame) worldFrame.visible = ui.showWorldFrame
}

/* =========================================
   Animation Loop
   ========================================= */
function anim() {
  controls.update()
  const Ts = forwardTxRxTzRz(robot.joints)

  linkNames.forEach((n, idx) => {
    const mesh = group.getObjectByName(n)
    if (!mesh || !Ts[idx]) return

    const pos = new THREE.Vector3()
    const quat = new THREE.Quaternion()
    const scale = new THREE.Vector3()
    Ts[idx].decompose(pos, quat, scale)

    // ✅ ตั้งค่าตรงๆ จาก matrix (ไม่ซ้อนจาก parent)
    mesh.position.copy(pos)
    mesh.quaternion.copy(quat)
  })

  // === Update TCP pose (use last transform Ts[5]) ===
  if (Ts.length > 0) {
    const T = Ts[Ts.length - 1]           // T_0_6 (สมมติ MDH 6 joint)
    const p = new THREE.Vector3()
    const q = new THREE.Quaternion()
    const s = new THREE.Vector3()
    T.decompose(p, q, s)
    // ตำแหน่งใน "เมตร" -> แปลงเป็น "มิลลิเมตร"
    eePose.x = p.x * 1000
    eePose.y = p.y * 1000
    eePose.z = p.z * 1000
    // มุม RPY (XYZ) หน่วย "องศา"
    const e = new THREE.Euler().setFromQuaternion(q, 'XYZ')
    eePose.rx = e.x * 180 / Math.PI
    eePose.ry = e.y * 180 / Math.PI
    eePose.rz = e.z * 180 / Math.PI
  }



  renderer.render(scene, camera)
  animId = requestAnimationFrame(anim)
}

/* =========================================
   Camera
   ========================================= */
function onResize() {
  if (!canvasHost.value) return
  const w = canvasHost.value.clientWidth
  const h = canvasHost.value.clientHeight
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  renderer.setSize(w, h, false)
}
function fit() { fitCameraToObject(camera, group, controls) }
function reset() { camera.position.set(0, 0, 50); controls.target.set(0, 0, 0); controls.update() }
function zoomIn() { camera.position.multiplyScalar(0.9) }
function zoomOut() { camera.position.multiplyScalar(1.1) }

/* =========================================
   Lifecycle
   ========================================= */

onMounted(() => {
  init()
  ro = new ResizeObserver(onResize)
  ro.observe(canvasHost.value)
  window.addEventListener('viewer-fit-camera', fit)
})
onBeforeUnmount(() => {
  cancelAnimationFrame(animId)
  ro?.disconnect()
  window.removeEventListener('viewer-fit-camera', fit)
})
</script>

<style scoped>
[ref="wrap"] {
  position: relative;
  /* มีอยู่แล้วก็ข้าม */
  overflow: hidden;
}

/* แคนวาสอยู่ล่างสุด */
:deep(canvas) {
  display: block;
  width: 100% !important;
  height: 100% !important;
  z-index: 0;
}

/* style scoped */
.viewer-root {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  /* กันเกิดสกรอลล์บาร์ */
}

.canvas-host {
  position: absolute;
  inset: 0;
  /* top/right/bottom/left = 0 */
}

/* แถบซ้ายบน */
.viewer-overlay {
  position: absolute;
  top: 10px;
  left: 10px;
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
  z-index: 20;
  pointer-events: auto;
}

/* TCP Pose — ขวาบนจริง ๆ */
.jog-overlay {
  position: absolute;
  bottom: 10px;
  right: 10px;
  z-index: 30;
  /* สูงกว่า overlay อื่นๆ */
  background: rgba(0, 0, 0, 0.7);
  color: #fff;
  padding: 10px 10px;
  border-radius: 8px;
  font-size: 0.95vw;
  line-height: 1.2;
  backdrop-filter: blur(6px);
  min-width: 300px;
  width: 30%;
  pointer-events: auto;
  /* คลิกได้เอง */
}

/* แผง jog ซ้ายล่าง */
.pose-overlay {
  position: absolute;
  left: 10px;
  bottom: 10px;
  /* width: 40%; */
  background: rgba(0, 0, 0, 0);
  border-radius: 8px;
  padding: 10px;
  font-size: 0.7vw;
  /* backdrop-filter: blur(6px); */
  z-index: 20;
  pointer-events: auto;
}
</style>
