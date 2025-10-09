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
    <h1>MIROBOT SIMULATOR</h1><p>V1.0-R251010</p>
    <div class="flex-1"></div>
    <ThemeToggle />
  </div>
</template>
