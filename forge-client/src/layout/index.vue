<template>
  <el-container class="layout-container" :style="bgStyle">
    <el-aside 
      class="aside-wrapper" 
      :width="isFixed ? '200px' : '64px'"
    >
      <div 
        class="aside"
        :class="{ 'is-floating': !isFixed && isHover }"
        :style="{ width: isCollapse ? '64px' : '200px' }"
        @mouseenter="isHover = true"
        @mouseleave="isHover = false"
      >
        <!-- 侧边栏顶部区域 -->
        <div class="aside-header">
        <div class="header-spacer"></div>
        <div 
          v-show="!isCollapse" 
          class="pin-btn" 
          :class="{ 'is-fixed': isFixed }"
          @click="toggleFixed"
        >
          <el-icon><CopyDocument v-if="!isFixed"/><Lock v-else/></el-icon>
        </div>
      </div>
      
      <el-menu
        ref="menuRef"
        :collapse="isCollapse"
        :collapse-transition="false"
        :default-active="activeMenu"
        class="el-menu-vertical"
        background-color="transparent"
        text-color="#c0c4cc"
        active-text-color="#ffffff"
        @select="handleSelect"
      >
        <el-menu-item 
          v-for="item in menuItems" 
          :key="item.index" 
          :index="item.index"
        >
          <el-icon><component :is="item.icon" /></el-icon>
          <template #title><span>{{ item.title }}</span></template>
        </el-menu-item>
      </el-menu>

      <!-- 底部锁屏按钮 -->
      <div v-if="settingsStore.lockEnabled && !isCollapse" class="aside-footer" @click="lockApp">
        <el-icon><Lock /></el-icon>
        <span>锁定系统</span>
      </div>
      <div v-if="settingsStore.lockEnabled && isCollapse" class="aside-footer center" @click="lockApp" title="锁定系统">
        <el-icon><Lock /></el-icon>
      </div>

      <!-- 用户信息区 (底部) -->
      <div class="aside-user" :class="{ 'is-collapsed': isCollapse }" @click="openProfileEdit">
        <el-avatar 
          :size="36" 
          :src="settingsStore.userAvatar || defaultAvatar"
          class="user-avatar"
        />
        <span v-show="!isCollapse" class="user-name">{{ settingsStore.userName || 'Forge' }}</span>
      </div>
      </div>
    </el-aside>
    
    <el-container style="flex-direction: column; background-color: transparent;">
      <!-- 顶部自定义拖拽栏，留给右侧 titleBarOverlay -->
      <div class="app-drag-bar"></div>
      
      <TagsView />
      <el-main class="main-content">
        <router-view v-slot="{ Component }">
          <transition name="fade-transform" mode="out-in">
            <keep-alive>
              <component :is="Component" :key="route.fullPath" />
            </keep-alive>
          </transition>
        </router-view>
      </el-main>
    </el-container>

    <!-- 编辑用户信息弹窗 -->
    <el-dialog 
      v-model="profileDialogVisible" 
      title="修改用户信息" 
      width="400px"
      :close-on-click-modal="false"
    >
      <el-form :model="profileForm" label-width="80px">
        <el-form-item label="头像">
          <div style="display: flex; gap: 10px; align-items: center;">
            <el-avatar :size="50" :src="profileForm.avatar || defaultAvatar" />
            <el-upload
              class="avatar-uploader"
              action="http://127.0.0.1:5888/api/settings/upload-avatar"
              name="avatar"
              :show-file-list="false"
              :on-success="handleAvatarSuccess"
              :before-upload="beforeAvatarUpload"
            >
              <el-button size="small" type="primary">点击上传</el-button>
            </el-upload>
          </div>
          <!-- <el-input v-model="profileForm.avatar" placeholder="或输入头像图片URL" clearable style="margin-top: 10px;" /> -->
        </el-form-item>
        <el-form-item label="用户名">
          <el-input v-model="profileForm.name" placeholder="输入用户名" clearable />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="profileDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="saveProfile">确认</el-button>
        </span>
      </template>
    </el-dialog>
  </el-container>
</template>

<script setup>
import { ref, computed, reactive, onMounted, onUnmounted, markRaw } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSettingsStore } from '../store/settings'
import TagsView from './TagsView.vue'
import { CopyDocument, Lock, Finished, Calendar, Setting, VideoPlay, TrendCharts } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

const route = useRoute()
const router = useRouter()
const settingsStore = useSettingsStore()

const defaultAvatar = 'https://cube.elemecdn.com/3/7c/3ea6beec64369c2642b92c6726f1epng.png'

const isFixed = ref(false)
const isHover = ref(false)
const tabExpanded = ref(false) // Tab 键临时展开状态

// 菜单列表
const menuItems = ref([
  { index: '/dashboard/plan', icon: markRaw(Calendar), title: '日常规划' },
  { index: '/dashboard/video-notes', icon: markRaw(VideoPlay), title: '视频笔记' },
  { index: '/dashboard/board-analysis', icon: markRaw(TrendCharts), title: '盘面分析' },
  { index: '/dashboard/settings', icon: markRaw(Setting), title: '系统设置' },
])

// 从本地存储加载排序
const loadMenuOrder = () => {
  const savedOrder = localStorage.getItem('menuOrder')
  if (savedOrder) {
    try {
      const orderMap = JSON.parse(savedOrder)
      const sortedItems = [...menuItems.value].sort((a, b) => {
        const aIndex = orderMap[a.index] ?? menuItems.value.indexOf(a)
        const bIndex = orderMap[b.index] ?? menuItems.value.indexOf(b)
        return aIndex - bIndex
      })
      menuItems.value = sortedItems
    } catch (e) {
      console.error('加载菜单排序失败', e)
    }
  }
}

const handleSelect = (index) => {
  router.push(index)
}

const menuRef = ref(null)

const isCollapse = computed(() => !isFixed.value && !isHover.value && !tabExpanded.value)

const toggleFixed = () => {
  isFixed.value = !isFixed.value
}

// Tab 键切换侧边栏展开/收起
const handleKeyDown = (e) => {
  if (e.key === 'Tab' && !e.repeat) {
    // 如果当前聚焦的元素是输入框，不触发
    const activeElement = document.activeElement
    const isInput = activeElement && (
      activeElement.tagName === 'INPUT' ||
      activeElement.tagName === 'TEXTAREA' ||
      activeElement.contentEditable === 'true'
    )
    if (isInput) return

    e.preventDefault()
    tabExpanded.value = !tabExpanded.value
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeyDown)
  loadMenuOrder()
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown)
})

const activeMenu = computed(() => route.path)

const bgStyle = computed(() => {
  if (settingsStore.bgPath) {
    let url = settingsStore.bgPath;
    if (url.startsWith('file://')) {
      // Keep it as is
    } else if (url.match(/^[a-zA-Z]:\\/)) {
      url = `file:///${url.replace(/\\/g, '/')}`;
    }
    
    let repeat = 'no-repeat';
    let size = settingsStore.bgMode;
    if (size === 'repeat') {
      repeat = 'repeat';
      size = 'auto';
    }
    return {
      backgroundImage: `url('${url}')`,
      backgroundSize: size,
      backgroundRepeat: repeat,
      backgroundPosition: 'center center'
    }
  }
  return {
    background: 'var(--el-bg-color-page, #f0f2f5)'
  }
})

const lockApp = () => {
  if (!settingsStore.lockEnabled) return
  router.push({
    path: '/',
    query: { redirect: route.fullPath }
  })
}

// User Profile Editing
const profileDialogVisible = ref(false)
const profileForm = reactive({
  avatar: '',
  name: ''
})

const openProfileEdit = () => {
  profileForm.avatar = settingsStore.userAvatar || ''
  profileForm.name = settingsStore.userName || 'Forge'
  profileDialogVisible.value = true
}

const saveProfile = async () => {
  if (!profileForm.name.trim()) {
    ElMessage.warning('用户名不能为空')
    return
  }
  
  const p1 = settingsStore.updateSetting('user_name', profileForm.name)
  const p2 = settingsStore.updateSetting('user_avatar', profileForm.avatar)
  
  await Promise.all([p1, p2])
  ElMessage.success('更新成功')
  profileDialogVisible.value = false
}

const handleAvatarSuccess = (response) => {
  if (response.success) {
    profileForm.avatar = response.url
    ElMessage.success('头像上传成功')
  } else {
    ElMessage.error(response.message || '头像上传失败')
  }
}

const beforeAvatarUpload = (file) => {
  const isImage = file.type.startsWith('image/')
  const isLt10M = file.size / 1024 / 1024 < 10

  if (!isImage) {
    ElMessage.error('上传头像图片只能是图片格式!')
  }
  if (!isLt10M) {
    ElMessage.error('上传头像图片大小不能超过 10MB!')
  }
  return isImage && isLt10M
}
</script>

<style scoped>
.layout-container {
  height: 100vh;
}

.aside-wrapper {
  transition: width 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  overflow: visible;
  position: relative;
  z-index: 2000;
  flex-shrink: 0;
  background-color: #1e222d;
}

.aside {
  background-color: #1e222d; /* 暗色深蓝/灰背景 */
  display: flex;
  flex-direction: column;
  transition: width 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  overflow: hidden;
  border-right: 1px solid rgba(255, 255, 255, 0.05);
  height: 100%;
  will-change: width;
}

.aside.is-floating {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  z-index: 2001;
  box-shadow: 4px 0 15px rgba(0, 0, 0, 0.3);
  border-right: 1px solid rgba(255, 255, 255, 0.1);
}

.aside-header {
  height: 60px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 20px;
  -webkit-app-region: no-drag;
}

.header-spacer {
  flex: 1;
}

.pin-btn {
  color: #909399;
  cursor: pointer;
  -webkit-app-region: no-drag;
  transition: color 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
}

/* 菜单项统一 cursor */
:deep(.el-menu-item) {
  cursor: pointer;
}

:deep(.el-sub-menu__title) {
  cursor: pointer;
}
.pin-btn:hover {
  color: #ffffff;
}
.pin-btn.is-fixed {
  color: #409EFF;
}

.el-menu-vertical {
  border-right: none;
  flex: 1;
  -webkit-app-region: no-drag;
}
.el-menu-vertical:not(.el-menu--collapse) {
  width: 200px;
}

/* 覆盖菜单选中样式，模仿飞书/Notion等侧边栏高亮效果 */
:deep(.el-menu-item) {
  margin: 4px 8px;
  border-radius: 6px;
  height: 40px;
  line-height: 40px;
}
:deep(.el-menu-item.is-active) {
  background-color: rgba(64, 158, 255, 0.15) !important;
}
:deep(.el-menu-item:hover) {
  background-color: rgba(255, 255, 255, 0.05) !important;
}

.aside-footer {
  height: 40px;
  display: flex;
  align-items: center;
  padding: 0 20px;
  color: #909399;
  cursor: pointer;
  -webkit-app-region: no-drag;
  transition: background-color 0.2s, color 0.2s;
  margin: 5px 8px;
  border-radius: 6px;
}
.aside-footer.center {
  justify-content: center;
  padding: 0;
}
.aside-footer:hover {
  background-color: rgba(255, 255, 255, 0.05);
  color: #F56C6C;
}
.aside-footer span {
  margin-left: 10px;
  font-size: 14px;
}

.aside-user {
  height: 60px;
  display: flex;
  align-items: center;
  padding: 0 14px;
  color: #fff;
  cursor: pointer;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  transition: background-color 0.2s;
  overflow: hidden;
  white-space: nowrap;
}
.aside-user.is-collapsed {
  justify-content: center;
  padding: 0;
}
.aside-user:hover {
  background-color: rgba(255, 255, 255, 0.05);
}
.aside-user .user-avatar {
  flex-shrink: 0;
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-radius: 50%; /* 圆圈边框 */
  transition: border-color 0.2s, transform 0.2s;
}
.aside-user:hover .user-avatar {
  border-color: rgba(64, 158, 255, 0.8);
  transform: scale(1.05);
}
.aside-user .user-name {
  margin-left: 12px;
  font-size: 15px;
  font-weight: 500;
  text-overflow: ellipsis;
  overflow: hidden;
}

.app-drag-bar {
  height: 30px;
  width: 100%;
  -webkit-app-region: drag;
  flex-shrink: 0;
  background-color: #1e222d; /* 匹配 titleBarOverlay 的背景色 */
}

.main-content {
  padding: 10px 20px;
  overflow-y: auto;
  flex: 1;
  -webkit-app-region: no-drag;
}

/* 页面切换动画 */
.fade-transform-leave-active,
.fade-transform-enter-active {
  transition: opacity 0.3s, transform 0.3s;
}

.fade-transform-enter-from {
  opacity: 0;
  transform: translateX(-30px);
}

.fade-transform-leave-to {
  opacity: 0;
  transform: translateX(30px);
}
</style>
