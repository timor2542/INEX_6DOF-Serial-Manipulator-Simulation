<template>
  <div class="flex statusbar" style="height:100%; align-items:center;">
    <!-- <div>Theme: <b>{{ themeText }}</b></div> -->
    <div>INSTRUCTION: Hold and drag the <b>LEFT MOUSE BUTTON</b> to <b>ROTATE</b>; <b>RIGHT MOUSE BUTTON</b> to <b>PAN</b>.</div>
    <div class="flex-1"></div>
    <el-divider direction="vertical" />
    <div class="credits">
      Credits:
      <a href="https://www.wlkata.com/" target="_blank" rel="noopener noreferrer">WLKATA Robotics</a>
      • Produced by
      <a href="https://www.inex.co.th/" target="_blank" rel="noopener noreferrer">Innovative Experiment Co., Ltd.</a>, Thailand.
    </div>
    <div class="flex-1"></div>
    <el-divider direction="vertical" />
    <div>DateTime ({{ utcText }}) : {{ nowText }}</div>
  </div>
</template>

<script setup>
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useSerialStore } from '../stores/serial'
import { useThemeStore } from '../stores/theme'
import { formatTime } from '../utils/formatTime'
import { getUTCOffsetString } from '../utils/getUTCOffsetString'

const serial = useSerialStore()
const theme = useThemeStore()
const { connected, baud, portInfo } = storeToRefs(serial)
const { mode } = storeToRefs(theme)

const portLabel = computed(() => portInfo.value?.label || '-')
const themeText = computed(() => mode.value === 'auto' ? 'Auto' : (mode.value === 'dark' ? 'Dark' : 'Light'))

const nowText = ref('')
const utcText = ref('')
let timer
function tick() { nowText.value = formatTime(new Date()) }
onMounted(() => { tick(); timer = setInterval(tick, 1000); utcText.value = getUTCOffsetString(new Date()); })
onBeforeUnmount(() => clearInterval(timer))
</script>
