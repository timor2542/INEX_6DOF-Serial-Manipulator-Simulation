<template>
  <el-select v-model="localMode" size="default" style="width: 180px" @change="onChange">
    <el-option label="Dark Theme" value="dark" />
    <el-option label="Light Theme" value="light" />
    <el-option label="Auto Theme" value="auto" />
  </el-select>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useThemeStore } from '../stores/theme'

const theme = useThemeStore()
const localMode = ref(theme.mode)

function onChange(v) {
  theme.setMode(v)           // เปลี่ยนทั้งแอป
  // ไม่ต้องทำอย่างอื่น—STLViewer จะเชื่อมโยงเองด้วย watch ที่ไฟล์นั้น
}

// ถ้า mode ถูกเปลี่ยนจากที่อื่น (เช่น Viewer เคยสลับ) ให้ sync dropdown ด้วย
watch(() => theme.mode, v => { if (v !== localMode.value) localMode.value = v })
</script>
