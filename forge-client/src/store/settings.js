import { defineStore } from 'pinia'
import axios from 'axios'

const API_BASE = 'http://localhost:5888/api'

export const useSettingsStore = defineStore('settings', {
  state: () => ({
    password: '',
    bgPath: '',
    lockBgPath: '',
    bgMode: 'cover',
    lockShortcut: 'CommandOrControl+L',
    userName: 'Forge',
    userAvatar: '',
    isDark: false
  }),
  actions: {
    async loadSettings() {
      try {
        const { data } = await axios.get(`${API_BASE}/settings`)
        if (data.success) {
          const s = data.data
          this.password = s.password || ''
          this.bgPath = s.background_path || ''
          this.lockBgPath = s.lock_bg_path || ''
          this.bgMode = s.bg_mode || 'cover'
          this.userName = s.user_name || 'Forge'
          this.userAvatar = s.user_avatar || ''
          this.isDark = s.is_dark === 'true'
          
          if (this.isDark) {
            document.documentElement.classList.add('dark')
          } else {
            document.documentElement.classList.remove('dark')
          }
          
          if (s.lock_shortcut && s.lock_shortcut !== this.lockShortcut) {
            // Update shortcut via IPC if it changed
            if (window.electronAPI) {
              await window.electronAPI.updateLockShortcut(this.lockShortcut, s.lock_shortcut)
            }
            this.lockShortcut = s.lock_shortcut
          }
        }
      } catch (err) {
        console.error('Failed to load settings', err)
      }
    },
    async updateSetting(key, value) {
      try {
        const { data } = await axios.put(`${API_BASE}/settings`, { key, value })
        if (data.success) {
          if (key === 'background_path') this.bgPath = value
          if (key === 'lock_bg_path') this.lockBgPath = value
          if (key === 'bg_mode') this.bgMode = value
          if (key === 'password') this.password = value
          if (key === 'user_name') this.userName = value
          if (key === 'user_avatar') this.userAvatar = value
          if (key === 'is_dark') {
            this.isDark = value === 'true'
            if (this.isDark) {
              document.documentElement.classList.add('dark')
            } else {
              document.documentElement.classList.remove('dark')
            }
          }
          if (key === 'lock_shortcut') {
            if (window.electronAPI) {
              await window.electronAPI.updateLockShortcut(this.lockShortcut, value)
            }
            this.lockShortcut = value
          }
          return true
        }
        return false
      } catch (err) {
        console.error('Failed to update setting', err)
        return false
      }
    }
  }
})
