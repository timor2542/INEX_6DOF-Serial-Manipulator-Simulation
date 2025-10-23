<template>
  <div class="flex-col">
    <!-- Main mode switch: Joint / Coord -->
    <el-segmented v-model="bigMode" :options="['Joint', 'Coord']" class="w-full" />

    <!-- ===== JOINT ===== -->
    <div v-if="bigMode === 'Joint'" class="flex-col">
      <div v-for="i in 6" :key="'J' + i" class="axis-row">
        <div class="axis-label">J{{ i }}</div>
        <el-slider v-model="joints[i - 1]" :min="-180" :max="180" :step="1" class="flex-1" @change="onJointSlider" />
        <div class="axis-value">{{ fmt(joints[i - 1]) }}°</div>
      </div>
    </div>

    <!-- ===== COORD (XYZ + RX/RY/RZ) ===== -->
    <div v-else class="flex-col">
      <div v-for="ax in ['X', 'Y', 'Z']" :key="'lin' + ax" class="axis-row">
        <div class="axis-label">{{ ax }}</div>
        <el-slider v-model="cart[ax]" :min="-500" :max="500" :step="1" class="flex-1" @change="onCartSlider(ax)" />
        <div class="axis-value">{{ fmt(cart[ax]) }} mm</div>
      </div>
      <div v-for="ax in ['Rx', 'Ry', 'Rz']" :key="'ang' + ax" class="axis-row">
        <div class="axis-label">{{ ax }}</div>
        <el-slider v-model="ang[ax]" :min="-180" :max="180" :step="1" class="flex-1" @change="onAngSlider(ax)" />
        <div class="axis-value">{{ fmt(ang[ax]) }}°</div>
      </div>
    </div>

    <!-- ===== Controls: Step / Speed / Gripper ===== -->
    <div class="flex" style="align-items: center; gap: var(--gap)">
      <div class="axis-footer">
        <div class="axis-footer-label">Step</div>
        <el-input-number v-model="step" :min="0.1" :max="50" :step="0.1" controls-position="both"
          class="compact-numeric" />
      </div>

      <div class="axis-footer">
        <div class="axis-footer-label">Speed</div>
        <el-input-number v-model="speed" :min="50" :max="4000" :step="10" controls-position="both"
          class="compact-numeric" />
      </div>

      <div class="flex-1"></div>

      <span style="opacity: 0.7; margin-right: 6px">Gripper</span>
      <el-switch v-model="gripper" active-text="ON" inactive-text="OFF" @change="toggleGripper" />
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useRobotStore } from '../stores/robot'
import { useSerialStore } from '../stores/serial'

const robot = useRobotStore()
const serial = useSerialStore()
const { joints } = storeToRefs(robot)

const bigMode = ref('Joint')
const step = ref(5) // Jog distance per move (mm or deg) — used by footer buttons
const speed = ref(2000) // Feedrate
const gripper = ref(false)
const cart = ref({ X: 0, Y: 0, Z: 0 })
const ang = ref({ Rx: 0, Ry: 0, Rz: 0 })

const fmt = (v) => Number(v || 0).toFixed(1)

/* ===== JOINT ===== */
function onJointSlider() {
  robot.updateJoints([...joints.value])
  if (!serial.connected) return
  const [j1, j2, j3, j4, j5, j6] = robot.joints
  serial.sendString(
    `G0 J1=${j1.toFixed(2)} J2=${j2.toFixed(2)} J3=${j3.toFixed(2)} J4=${j4.toFixed(2)} J5=${j5.toFixed(2)} J6=${j6.toFixed(2)}\n`
  )
}

/* ===== COORD ===== */
function onCartSlider(ax) {
  if (!serial.connected) return
  const X = cart.value.X ?? 0,
    Y = cart.value.Y ?? 0,
    Z = cart.value.Z ?? 0
  serial.sendString(`G1 X=${X.toFixed(2)} Y=${Y.toFixed(2)} Z=${Z.toFixed(2)} F=${speed.value}\n`)
}
function onAngSlider(ax) {
  if (!serial.connected) return
  const A = ang.value.Rx ?? 0,
    B = ang.value.Ry ?? 0,
    C = ang.value.Rz ?? 0
  serial.sendString(`G1 A=${A.toFixed(2)} B=${B.toFixed(2)} C=${C.toFixed(2)} F=${speed.value}\n`)
}

/* ===== Gripper ===== */
function toggleGripper(on) {
  robot.setGripper(on)
  if (serial.connected) serial.sendString(on ? 'M3\n' : 'M5\n')
}
</script>

<style scoped>
.axis-row {
  display: flex;
  align-items: center;
  gap: var(--gap);
}

.axis-label {
  width: clamp(42px, 4vw, 64px);
  opacity: 0.9;
}

.axis-value {
  width: clamp(74px, 6vw, 96px);
  text-align: right;
  opacity: 0.9;
}

/* Footer block (Step/Speed) compact style */
.axis-footer {
  display: flex;
  align-items: center;
  gap: 10px;
}

.axis-footer-label {
  opacity: 0.9;
}

/* Make input-number compact: only show +/- buttons */
.compact-numeric .el-input__wrapper {
  width: 90px;
}

.compact-numeric .el-input__inner {
  padding: 0;
  text-align: center;
  opacity: 0.85;
}
</style>
