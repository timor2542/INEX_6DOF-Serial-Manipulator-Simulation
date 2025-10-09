<template>
  <div>
    <div class="app-grid">
      <!-- Toolbar -->
      <div class="panel">
        <Toolbar />
      </div>

      <!-- Main: Viewer + Jog -->
      <div class="panel viewer-panel">
        <div class="flex">
          <div class="flex-1 minw-0">
            <STLViewer />
          </div>
        </div>
      </div>

      <!-- Serial Monitor -->
      <div class="panel">
        <SerialMonitor />
      </div>

      <!-- StatusBar -->
      <div class="panel" style="padding:0 10px;">
        <StatusBar />
      </div>
    </div>
  </div>
</template>

<script setup>
import Toolbar from './components/Toolbar.vue'
import STLViewer from './components/STLViewer.vue'
import SerialMonitor from './components/SerialMonitor.vue'
import JogControl from './components/JogControl.vue'
import StatusBar from './components/StatusBar.vue'
import { storeToRefs } from 'pinia'
import { useThemeStore } from './stores/theme'

const theme = useThemeStore()
const { themeClass } = storeToRefs(theme)
theme.init()
</script>
