<template>
  <div class="flex-col" style="height:100%;">
    <!-- ONE ROW: mode + input + actions -->
    <div class="flex serial-controls compact">
      <div class="serial-actions">
        <el-button @click="clear">Clear Console</el-button>
      </div>
    </div>

    <!-- Console area -->
    <div ref="view" class="console" style="flex:1; overflow:auto;">
      <div v-for="(l, i) in logs" :key="i">
        <span>[{{ formatTime(new Date(l.ts)) }}]</span>
        <span v-if="l.dir === 'out'">&nbsp;&gt;&gt;&nbsp;</span>
        <span v-else-if="l.dir === 'in'">&nbsp;&lt;&lt;&nbsp;</span>
        <span v-else>&nbsp;</span>
        <span>{{ l.text }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useSerialStore } from '../stores/serial'
import { encodeOutgoing } from '../utils/serialHelper'
import { formatTime } from '../utils/formatTime'

const serial = useSerialStore()
const { connected, logs } = storeToRefs(serial)

const outgoing = ref('')
const mode = ref('string')

function send() {
  if (!outgoing.value) return
  const data = encodeOutgoing(outgoing.value, mode.value)
  serial.send(data)
  outgoing.value = ''
}
function clear() { serial.clearLogs() }

const view = ref(null)

// autoscroll ทุกครั้งที่มี log ใหม่
watch(
  () => logs.value.length,
  async () => {
    await nextTick()
    if (view.value) {
      view.value.scrollTop = view.value.scrollHeight
    }
  }
)

onMounted(async () => {
  serial.appendLog({ dir: 'sys', text: 'Console ready.', ts: Date.now() })
  await nextTick()
  if (view.value) view.value.scrollTop = view.value.scrollHeight
})
</script>
