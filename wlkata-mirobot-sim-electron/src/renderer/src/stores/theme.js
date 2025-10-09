// src/stores/theme.js
import { defineStore } from 'pinia'

/**
 * Theme store
 * mode: 'auto' | 'dark' | 'light'
 * - auto: ตามเวลา (กลางวัน=light, กลางคืน=dark) — คุณจะเปลี่ยนเป็นตาม OS ก็ได้
 * การสลับธีม:
 * - เพิ่ม/ลบ class 'dark' บน <html> เพื่อให้ Element Plus เปลี่ยนพาเล็ต
 * - เพิ่ม/ลบ class 'light' บน <body> เพื่อคุมสี custom ของเรา
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
      document.documentElement.classList.toggle('dark', isDark) // ให้ EP ไป dark
      document.body.classList.toggle('light', !isDark)          // ใช้ตัวแปรสี custom
    }
  }
})
