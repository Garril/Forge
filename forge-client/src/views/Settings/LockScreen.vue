<template>
  <div class="lock-screen" :style="bgStyle">
    <div 
      class="lock-box"
      :style="lockBoxStyle"
      @mousedown="startDrag"
    >
      <el-avatar :size="80" :src="settingsStore.userAvatar || defaultAvatar" />
      <h2 class="title">{{ settingsStore.userName || 'Forge 安全锁定' }}</h2>
      <el-input 
        v-model="inputPassword" 
        type="password" 
        placeholder="请输入解锁密码"
        @keyup.enter="handleUnlock"
        class="pwd-input"
        show-password
      >
        <template #prefix>
          <el-icon><Lock /></el-icon>
        </template>
      </el-input>
      <el-button type="primary" class="unlock-btn" @click="handleUnlock" :loading="loading">
        解锁进入
      </el-button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useSettingsStore } from '../../store/settings'
import { Lock } from '@element-plus/icons-vue'
import axios from 'axios'

const router = useRouter()
const settingsStore = useSettingsStore()
const inputPassword = ref('')
const loading = ref(false)

const defaultAvatar = 'https://cube.elemecdn.com/3/7c/3ea6beec64369c2642b92c6726f1epng.png'

const LOCK_BOX_POS_KEY = 'forge_lock_box_position'

const lockBoxPos = ref({ x: 0, y: 0 })
const isDragging = ref(false)
const dragStart = ref({ x: 0, y: 0 })
const dragOffset = ref({ x: 0, y: 0 })

onMounted(() => {
  const saved = localStorage.getItem(LOCK_BOX_POS_KEY)
  if (saved) {
    try {
      lockBoxPos.value = JSON.parse(saved)
    } catch (e) {
      console.error('解析锁屏位置失败', e)
    }
  }
})

const lockBoxStyle = computed(() => {
  return {
    transform: `translate(${lockBoxPos.value.x}px, ${lockBoxPos.value.y}px)`,
    cursor: isDragging.value ? 'grabbing' : 'grab'
  }
})

const startDrag = (e) => {
  if (e.target.closest('input') || e.target.closest('button')) return
  isDragging.value = true
  dragStart.value = { x: e.clientX, y: e.clientY }
  dragOffset.value = { ...lockBoxPos.value }
  
  const onMouseMove = (evt) => {
    if (!isDragging.value) return
    const dx = evt.clientX - dragStart.value.x
    const dy = evt.clientY - dragStart.value.y
    lockBoxPos.value = {
      x: dragOffset.value.x + dx,
      y: dragOffset.value.y + dy
    }
  }
  
  const onMouseUp = () => {
    isDragging.value = false
    localStorage.setItem(LOCK_BOX_POS_KEY, JSON.stringify(lockBoxPos.value))
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  }
  
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

const bgStyle = computed(() => {
  if (settingsStore.lockBgPath) {
    let url = settingsStore.lockBgPath;
    if (url.startsWith('file://')) {
      // Keep it as is
    } else if (url.match(/^[a-zA-Z]:\\/)) {
      url = `file:///${url.replace(/\\/g, '/')}`; // Convert Windows absolute path to file URI
    }
    
    let repeat = 'no-repeat';
    let size = settingsStore.bgMode;
    if (size === 'repeat') {
      repeat = 'repeat';
      size = 'auto';
    } else if (size === '100% 100%') {
      // Keep as is for stretch
    }

    return {
      backgroundImage: `url('${url}')`,
      backgroundSize: size,
      backgroundRepeat: repeat,
      backgroundPosition: 'center center'
    }
  }
  return {
    background: 'linear-gradient(135deg, #1f1c2c, #928DAB)'
  }
})

const handleUnlock = async () => {
  if (!inputPassword.value) {
    ElMessage.warning('请输入密码')
    return
  }
  loading.value = true
  try {
    const { data } = await axios.post('http://127.0.0.1:5888/api/settings/unlock', {
      password: inputPassword.value
    })
    
    if (data.success) {
      ElMessage.success('解锁成功')
      const redirect = router.currentRoute.value.query.redirect || '/dashboard'
      await router.replace(redirect)
    } else {
      ElMessage.error(data.message || '密码错误')
    }
  } catch (error) {
    console.error('[Unlock] request failed', {
      url: error.config?.url,
      code: error.code,
      status: error.response?.status,
      message: error.message
    })
    ElMessage.error('服务未启动或连接异常')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.lock-screen {
  width: 100vw;
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background-size: cover;
}

.lock-box {
  background: var(--el-bg-color-overlay, rgba(255, 255, 255, 0.85));
  backdrop-filter: blur(10px);
  padding: 40px;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  text-align: center;
  width: 320px;
  user-select: none;
  transition: transform 0.1s;
}

.title {
  margin: 20px 0;
  color: var(--el-text-color-primary, #333);
  font-weight: 500;
}

.pwd-input {
  margin-bottom: 20px;
}

.unlock-btn {
  width: 100%;
}
</style>
