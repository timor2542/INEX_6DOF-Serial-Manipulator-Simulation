<template>
  Theme : 
  <el-select v-model="localMode" size="default" style="width: 100px" @change="onChange">
    <el-option label="Dark" value="dark" />
    <el-option label="Light" value="light" />
    <el-option label="Auto" value="auto" />
  </el-select>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useThemeStore } from '../stores/theme'

const theme = useThemeStore()
const localMode = ref(theme.mode)

function onChange(v) {
  theme.setMode(v)           // switch the theme app-wide
  // Nothing else needed — STLViewer will react via its own watch in that file
}

// If the mode was changed elsewhere (e.g., the Viewer toggled it), sync the dropdown
watch(() => theme.mode, v => { if (v !== localMode.value) localMode.value = v })
</script>
