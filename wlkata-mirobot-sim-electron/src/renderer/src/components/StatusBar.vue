<template>
  <div class="flex statusbar" style="height:100%; align-items:center;">
    <!-- <div>Port: <b>{{ portLabel }}</b></div> -->
    <!-- <el-divider direction="vertical" /> -->
    <!-- <div>Baud: <b>{{ baud }}</b></div> -->
    <!-- <el-divider direction="vertical" /> -->
    <!-- <div>Connection: -->
      <!-- <el-tag :type="connected ? 'success' : 'danger'">{{ connected ? 'Connected' : 'Disconnected' }}</el-tag> -->
    <!-- </div> -->
    <!-- <el-divider direction="vertical" /> -->
    <div>Theme: <b>{{ themeText }}</b></div>

    <div class="flex-1"></div>

    <div>{{ nowText }}</div>
  </div>
</template>

<script setup>
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useSerialStore } from '../stores/serial'
import { useThemeStore } from '../stores/theme'
import { formatTime } from '../utils/formatTime'

const serial = useSerialStore()
const theme = useThemeStore()
const { connected, baud, portInfo } = storeToRefs(serial)
const { mode } = storeToRefs(theme)

const portLabel = computed(() => portInfo.value?.label || '-')
const themeText = computed(() => mode.value === 'auto' ? 'Auto' : (mode.value === 'dark' ? 'Dark' : 'Light'))

const nowText = ref('')
let timer
function tick() { nowText.value = formatTime(new Date()) }
onMounted(() => { tick(); timer = setInterval(tick, 1000) })
onBeforeUnmount(() => clearInterval(timer))
</script>
