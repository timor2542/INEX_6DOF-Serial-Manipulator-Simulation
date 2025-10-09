<template>
  <div class="flex statusbar" style="font-size:0.95vw; height:100%; align-items:center;">
    <!-- <div>Theme: <b>{{ themeText }}</b></div> -->
    INSTRUCTION: <div>Hold <b>LEFT-MOUSE</b> to <b>ROTATE</b> and <b>RIGHT-MOUSE</b> to <b>PAN</b>.</div>
    <el-divider direction="vertical" />
    Credits: WLKATA Studio • Produced by Innovative Experiment Co, Ltd., Thailand.
    <div class="flex-1"></div>
    <el-divider direction="vertical" />
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
