// src/stores/theme.js
import { defineStore } from 'pinia'
/**
 * Theme store
 * mode: 'auto' | 'dark' | 'light'
 * - auto: follows time (day = light, night = dark) — you can also change it to follow the OS setting
 * Theme switching:
 * - Add or remove the 'dark' class on <html> to let Element Plus switch its palette
 * - Add or remove the 'light' class on <body> to control our custom colors
 */
export const useThemeStore = defineStore('theme', {
  state: () => ({
    mode: localStorage.getItem('themeMode') || 'auto',
  }),
  actions: {
    init() { this.apply() },
    setMode(next) {
      this.mode = next
      localStorage.setItem('themeMode', next)
      this.apply()
    },
    apply() {
      let isDark = this.mode === 'dark'
      if (this.mode === 'auto') {
        const h = new Date().getHours()
        isDark = !(h >= 7 && h < 18)
      }
      document.documentElement.classList.toggle('dark', isDark) // make Element Plus use dark palette
      document.body.classList.toggle('light', !isDark)          // use our custom color variables
    }
  }
})
