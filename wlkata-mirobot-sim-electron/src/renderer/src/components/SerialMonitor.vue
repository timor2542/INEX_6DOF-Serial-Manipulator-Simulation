<template>
  <div class="flex-col" style="height:100%;">
    <!-- ONE ROW: mode + input + actions -->
    <div class="flex serial-controls compact">
      <!-- <el-select v-model="mode" style="width: 120px;">
        <el-option label="String" value="string" />
        <el-option label="HEX" value="hex" />
        <el-option label="BIN" value="bin" />
      </el-select>

      <el-input v-model="outgoing" placeholder="Type & Enter to send" class="grow" @keyup.enter="send" /> -->

      <div class="serial-actions">
        <!-- <el-button type="primary" @click="send">Send</el-button> -->
        <el-button @click="clear">Clear</el-button>
        <!-- <el-tag :type="connected ? 'success' : 'danger'">{{ connected ? 'Online' : 'Offline' }}</el-tag> -->
      </div>
    </div>

    <!-- Console area -->
    <div ref="view" class="console" style="flex:1; overflow:auto;"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useSerialStore } from '../stores/serial'
import { encodeOutgoing } from '../utils/serialHelper'
import { formatTime } from '../utils/formatTime'

const serial = useSerialStore()
const { connected, logs } = storeToRefs(serial)

const outgoing = ref('')
const mode = ref('string')
const view = ref(null)

function send() {
  if (!outgoing.value) return
  const data = encodeOutgoing(outgoing.value, mode.value)
  serial.send(data)
  outgoing.value = ''
}
function clear() { serial.clearLogs() }

watch(logs, () => {
  if (!view.value) return
  view.value.innerHTML = logs.value.map(l => {
    const t = formatTime(new Date(l.ts))
    const dir = l.dir === 'out' ? '&gt;&gt;' : (l.dir === 'in' ? '&lt;&lt;' : '--')
    return `<div>[${t}] ${dir} ${l.text}</div>`
  }).join('')
  view.value.scrollTop = view.value.scrollHeight
})

onMounted(() => {
  serial.appendLog({ dir: 'sys', text: 'Console ready.', ts: Date.now() })
})
</script>
