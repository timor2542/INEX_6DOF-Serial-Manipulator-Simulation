<template>
  <div ref="wrap" style="width:100%;height:100%;position:relative;">
    <div ref="canvasHost" style="width:100%;height:100%;"></div>

    <!-- Overlay controls -->
    <div class="viewer-overlay"
      style="position:absolute; top:10px; left:10px; display:flex; gap:6px; align-items:center; flex-wrap:wrap;">


      <el-checkbox v-model="ui.showGrid" @change="applyVisibility">Grid</el-checkbox>
      <el-checkbox v-model="ui.showWorldFrame" @change="applyVisibility">World Frame</el-checkbox>
      <el-checkbox v-model="ui.showLinkFrames" @change="applyVisibility">Link Frames</el-checkbox>
      <el-checkbox v-model="ui.showTcpFrame" @change="applyVisibility">TCP</el-checkbox>
      <el-checkbox v-model="ui.showLabels" @change="applyVisibility">Labels</el-checkbox>

      <span style="opacity:.8;">X</span>
      <el-color-picker v-model="ui.colors.x" size="small" @change="rebuildFrames" />
      <span style="opacity:.8;">Y</span>
      <el-color-picker v-model="ui.colors.y" size="small" @change="rebuildFrames" />
      <span style="opacity:.8;">Z</span>
      <el-color-picker v-model="ui.colors.z" size="small" @change="rebuildFrames" />
      <span style="opacity:.8; margin-left:6px;">Link Len</span>
      <el-input-number v-model="ui.linkLen" :min="0.02" :max="0.4" :step="0.01" size="small" @change="rebuildFrames" />
      <span style="opacity:.8;">TCP Len</span>
      <el-input-number v-model="ui.tcpZLen" :min="0.04" :max="0.6" :step="0.01" size="small" @change="rebuildFrames" />

      <el-divider direction="horizontal" />

      <el-button size="small" @click="fit">Fit</el-button>
      <el-button size="small" @click="reset">Reset</el-button>
      <el-button size="small" @click="zoomIn">+</el-button>
      <el-button size="small" @click="zoomOut">-</el-button>
    </div>

    <!-- Jog sliders -->
    <div class="jog-overlay"
      style="position:absolute; bottom:10px; left:10px; width:50%; background:rgba(0,0,0,0.3); border-radius:8px; padding:10px;">
      <div v-for="(q, i) in robot.joints || []" :key="i"
        style="display:flex; align-items:center; gap:6px; margin:4px 0;">
        <span style="color:white; width:40px;">q{{ i + 1 }}</span>

        <el-slider v-model="robot.joints[i]" :min="jointLimits[i]?.min ?? -180" :max="jointLimits[i]?.max ?? 180"
          :step="1" style="flex:1;" />

        <el-input-number v-model="robot.joints[i]" :min="jointLimits[i]?.min ?? -180" :max="jointLimits[i]?.max ?? 180"
          :step="1" size="small" style="width:7rem" />


        <span style="color:#ccc; font-size:0.8rem; width:5.5rem; text-align:right;">
          [{{ jointLimits[i]?.min ?? -180 }}°, {{ jointLimits[i]?.max ?? 180 }}°]
        </span>
      </div>
    </div>
  </div>
</template>

<script setup>
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { onMounted, onBeforeUnmount, ref, reactive, watch } from 'vue'
import { useRobotStore } from '../stores/robot'
import { useThemeStore } from '../stores/theme'
import { fitCameraToObject } from '../utils/stlLoader'

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
  camera = new THREE.PerspectiveCamera(35, w / h, 0.01, 2000)
  camera.position.set(0, -1, 1)
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
function loadSTLs() {
  const loader = new STLLoader()
  const names = ['base', ...linkNames]
  toLoad = names.length
  loaded = 0

  names.forEach((n, i) => {
    loader.load(`/src/assets/stl/${n}.stl`,
      geo => {
        geo.computeVertexNormals()
        const mat = new THREE.MeshStandardMaterial({
          color: i === 0 ? 0x616161 : (i === 2 || i === 4) ? 0xf57c00 : 0xbdbdbd, metalness: 0.2, roughness: 0.7
        })
        const mesh = new THREE.Mesh(geo, mat)
        mesh.name = n
        group.add(mesh)
        afterOneLoaded()
      },
      undefined,
      () => {
        const g = new THREE.CylinderGeometry(0.01, 0.01, 0.01, 0.01)
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
function reset() { camera.position.set(0.45, -0.55, 0.55); controls.target.set(0, 0, 0); controls.update() }
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
canvas {
  display: block;
  width: 100% !important;
  height: 100% !important;
}

.viewer-overlay .el-button {
  padding: clamp(2px, 0.25vw, 6px) clamp(6px, 0.5vw, 10px);
}

.jog-overlay {
  backdrop-filter: blur(6px);
}
</style>
