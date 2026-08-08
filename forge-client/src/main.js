import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { createPinia } from 'pinia'
import { useSettingsStore } from './store/settings'

import ElementPlus from 'element-plus'
import zhCn from 'element-plus/dist/locale/zh-cn.mjs'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'

import './styles.css'

const app = createApp(App)
const pinia = createPinia()

// Element Plus 中文配置
const elementConfig = {
  locale: zhCn,
  zIndex: 3000,
}

for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.use(router)
app.use(pinia)
app.use(ElementPlus, elementConfig)

const bootstrap = async () => {
  await router.isReady()
  const settingsStore = useSettingsStore(pinia)
  await settingsStore.loadSettings()
  if (!settingsStore.lockEnabled && router.currentRoute.value.path === '/') {
    await router.replace('/dashboard')
  }
  app.mount('#app')
}

bootstrap().catch(error => {
  console.error('Forge frontend bootstrap failed', error)
  app.mount('#app')
})
