<script setup>
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useSerialStore } from '../stores/serial'
import { GCODE_CMD } from '../utils/gcode'
import ThemeToggle from './ThemeToggle.vue'

const serial = useSerialStore()
const { connected } = storeToRefs(serial)

const port = ref(''); const baud = ref(115200)
const ports = ref([{ path: 'COM3', friendlyName: 'CH340 (COM3)' }])
const baudRates = [9600, 19200, 57600, 115200, 250000]

function toggleConnect() { connected.value ? serial.disconnect() : serial.connect(port.value, baud.value) }
function fitCam() { window.dispatchEvent(new Event('viewer-fit-camera')) }

/* ใช้คำสั่งจากโปรไฟล์ */
function homing() { if (connected.value) serial.sendString(GCODE_CMD.homing()) }
function zeroPos() { if (connected.value) serial.sendString(GCODE_CMD.zeroAll()) }
function estop() { if (connected.value) serial.sendString(GCODE_CMD.stop()) }
</script>

<template>
  <div class="toolbar-wrap">
    <!-- <el-select v-model="port" class="ctrl-w-lg" placeholder="Select CH340 Port">
      <el-option v-for="p in ports" :key="p.path" :label="p.friendlyName || p.path" :value="p.path" />
    </el-select> -->

    <!-- <el-select v-model="baud" class="ctrl-w-md">
      <el-option v-for="b in baudRates" :key="b" :label="`${b} bps`" :value="b" />
    </el-select> -->

    <!-- <el-button type="primary" @click="toggleConnect">{{ connected ? 'Disconnect' : 'Connect' }}</el-button>

    <el-divider direction="vertical" /> -->

    <el-button type="primary" plain :disabled="!connected" @click="homing">Homing</el-button>
    <el-button type="warning" plain :disabled="!connected" @click="zeroPos">Zero Pos</el-button>
    <!-- <el-button type="danger" :disabled="!connected" @click="estop">Stop</el-button> -->

    <el-button @click="fitCam">Fit Camera</el-button>

    <div class="flex-1"></div>
    <ThemeToggle />
  </div>
</template>
