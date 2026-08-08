<template>
  <div class="settings-page" :class="{ 'is-previewing': isPreviewing }">
    <el-card class="box-card">
      <template #header>
        <div class="card-header">
          <span>应用设置</span>
        </div>
      </template>

      <el-form label-width="120px" class="settings-form">
        <el-divider content-position="left">安全设置</el-divider>
        <el-form-item label="锁屏密码">
          <el-input 
            v-model="password" 
            type="password" 
            show-password
            :placeholder="hasPassword ? '已设置密码' : '留空表示未设置密码'"
            class="input-box"
            disabled
          />
          <el-button type="primary" class="ml-2" @click="showPasswordDialog">修改密码</el-button>
        </el-form-item>

        <el-form-item label="启动时锁屏">
          <el-switch
            v-model="lockEnabled"
            @change="saveSetting('lock_enabled', lockEnabled ? 'true' : 'false')"
            active-text="开启"
            inactive-text="关闭"
          />
          <div class="form-tip">关闭后启动应用直接进入主页面；手动锁屏和快捷键也会停用。</div>
        </el-form-item>

        <el-form-item label="全局锁屏快捷键">
          <el-input 
            v-model="lockShortcut" 
            placeholder="如 CommandOrControl+L"
            class="input-box"
          />
          <el-button type="primary" class="ml-2" @click="saveSetting('lock_shortcut', lockShortcut)">保存</el-button>
          <div class="form-tip">支持的格式: CommandOrControl+L, Alt+Q 等。</div>
        </el-form-item>

        <el-divider content-position="left" class="appearance-divider">
          <span>外观与个性化</span>
          <span 
            class="preview-eye"
            @mousedown="startPreview"
            @mouseup="stopPreview"
            @mouseleave="stopPreview"
            @touchstart="startPreview"
            @touchend="stopPreview"
            title="按住查看背景效果"
          >
            <el-icon><View /></el-icon>
          </span>
        </el-divider>
        <el-form-item label="背景设置">
          <div class="bg-setting-tabs">
            <el-radio-group v-model="bgSettingType" size="small">
              <el-radio-button label="global">全局背景图</el-radio-button>
              <el-radio-button label="lock">锁屏壁纸</el-radio-button>
            </el-radio-group>
            <div class="bg-current-info">
              <span v-if="bgSettingType === 'global' && bgPath">当前: 已设置</span>
              <span v-if="bgSettingType === 'global' && !bgPath">当前: 使用纯色</span>
              <span v-if="bgSettingType === 'lock' && lockBgPath">当前: 已设置</span>
              <span v-if="bgSettingType === 'lock' && !lockBgPath">当前: 默认渐变</span>
            </div>
          </div>
          
          <div class="bg-upload-container">
            <el-upload
              class="bg-uploader"
              action="http://127.0.0.1:5888/api/settings/upload-bg-multi"
              name="files"
              multiple
              :show-file-list="false"
              :on-success="handleMultiBgSuccess"
              :before-upload="beforeBgUpload"
            >
              <el-button type="primary">点击上传背景图（支持多选）</el-button>
            </el-upload>
            
            <div class="bg-gallery mt-3">
              <div
                v-for="img in allBgs"
                :key="img.name"
                class="bg-item"
                :class="{
                  'is-active': bgSettingType === 'global' ? bgPath === img.originUrl : lockBgPath === img.originUrl
                }"
                @click="selectBg(img.originUrl)"
              >
                <img :src="img.url" class="bg-thumb" loading="lazy" decoding="async" />
                <div class="bg-close" @click.stop="deleteBg(img.name)">×</div>
                <div class="bg-active-mark" v-if="(bgSettingType === 'global' && bgPath === img.originUrl) || (bgSettingType === 'lock' && lockBgPath === img.originUrl)">✓</div>
                <div class="bg-type-mark global" v-if="bgPath === img.originUrl">桌面</div>
                <div class="bg-type-mark lock" v-if="lockBgPath === img.originUrl">锁屏</div>
              </div>
            </div>
            
            <el-button 
              v-if="(bgSettingType === 'global' && bgPath) || (bgSettingType === 'lock' && lockBgPath)" 
              type="danger" 
              link 
              @click="clearCurrentBg" 
              class="mt-2"
            >
              {{ bgSettingType === 'global' ? '清除背景图 (使用纯色)' : '清除锁屏壁纸 (使用默认渐变色)' }}
            </el-button>
          </div>
        </el-form-item>

        <el-form-item label="背景适配模式">
          <el-select v-model="bgMode" class="input-box" @change="saveSetting('bg_mode', bgMode)">
            <el-option label="等比覆盖 (cover)" value="cover" />
            <el-option label="等比包含 (contain)" value="contain" />
            <el-option label="铺满拉伸 (100% 100%)" value="100% 100%" />
            <el-option label="平铺重复 (repeat)" value="repeat" />
          </el-select>
        </el-form-item>

        <el-divider content-position="left">系统设置</el-divider>
        <el-form-item label="夜间模式">
          <el-switch
            v-model="isDark"
            @change="saveSetting('is_dark', isDark ? 'true' : 'false')"
            active-text="开启"
            inactive-text="关闭"
          />
        </el-form-item>

        <el-divider content-position="left">导航栏菜单排序</el-divider>
        <el-form-item label="自定义排序" class="sort-menu-item">
          <div class="form-tip mb-2">拖动左侧图标调整顺序，保存后会重新加载应用生效。</div>
          <div class="menu-sort-list" ref="menuSortListRef">
            <div 
              v-for="item in menuItems" 
              :key="item.index" 
              class="menu-sort-item"
            >
              <el-icon class="drag-handle"><Rank /></el-icon>
              <span>{{ item.title }}</span>
            </div>
          </div>
          <el-button type="primary" class="mt-3" @click="saveMenuOrder">保存并刷新</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 修改密码弹窗 -->
    <el-dialog v-model="passwordDialogVisible" title="修改密码" width="400px">
      <el-form :model="passwordForm" :rules="passwordRules" ref="passwordFormRef" label-width="100px">
        <el-form-item v-if="hasPassword" label="当前密码" prop="currentPassword">
          <el-input 
            v-model="passwordForm.currentPassword" 
            type="password" 
            show-password
            placeholder="请输入当前密码"
          />
        </el-form-item>
        <el-form-item label="新密码" prop="newPassword">
          <el-input 
            v-model="passwordForm.newPassword" 
            type="password" 
            show-password
            placeholder="请输入新密码（留空则取消密码）"
          />
        </el-form-item>
        <el-form-item label="确认新密码" prop="confirmPassword">
          <el-input 
            v-model="passwordForm.confirmPassword" 
            type="password" 
            show-password
            placeholder="请再次输入新密码"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="passwordDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="savePassword" :loading="savingPassword">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useSettingsStore } from '../../store/settings'
import { ElMessage, ElMessageBox } from 'element-plus'
import { View, Rank } from '@element-plus/icons-vue'
import axios from 'axios'
import Sortable from 'sortablejs'

const settingsStore = useSettingsStore()
const router = useRouter()

const password = ref('')
const lockShortcut = ref('')
const lockEnabled = ref(false)
const bgPath = ref('')
const lockBgPath = ref('')
const bgMode = ref('cover')
const isDark = ref(false)
const bgSettingType = ref('global') // 'global' 或 'lock'

const allBgs = ref([])
const isPreviewing = ref(false)

// 菜单列表从主布局路由动态生成，避免新增页面遗漏
const menuItems = ref([])
const menuSortListRef = ref(null)

const loadMenuItems = () => {
  const dashboardRoute = router.getRoutes().find(route => route.path === '/dashboard')
  const routeItems = (dashboardRoute?.children || [])
    .filter(route => route.meta?.title)
    .map(route => ({
      index: route.path.startsWith('/dashboard/') ? route.path : `/dashboard/${route.path}`,
      title: route.meta.title
    }))
  menuItems.value = routeItems
}
let sortableInstance = null

// 加载菜单顺序
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

// 初始化拖拽引擎
const initMenuSortable = () => {
  if (!menuSortListRef.value) return
  sortableInstance = Sortable.create(menuSortListRef.value, {
    animation: 200,
    handle: '.drag-handle',
    ghostClass: 'sortable-ghost',
    onEnd: (evt) => {
      const item = menuItems.value.splice(evt.oldIndex, 1)[0]
      menuItems.value.splice(evt.newIndex, 0, item)
    }
  })
}

// 保存排序
const saveMenuOrder = () => {
  const orderMap = {}
  menuItems.value.forEach((item, index) => {
    orderMap[item.index] = index
  })
  localStorage.setItem('menuOrder', JSON.stringify(orderMap))
  ElMessage.success('排序已保存，正在刷新应用...')
  setTimeout(() => {
    window.location.reload()
  }, 1000)
}

// 密码相关
const hasPassword = ref(false)
const passwordDialogVisible = ref(false)
const savingPassword = ref(false)
const passwordFormRef = ref(null)
const passwordForm = ref({
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
})

const validateConfirmPassword = (rule, value, callback) => {
  if (value !== passwordForm.value.newPassword) {
    callback(new Error('两次输入的密码不一致'))
  } else {
    callback()
  }
}

const passwordRules = {
  currentPassword: [
    { required: true, message: '请输入当前密码', trigger: 'blur' }
  ],
  newPassword: [
    { min: 0, max: 20, message: '密码长度不能超过20位', trigger: 'blur' }
  ],
  confirmPassword: [
    { validator: validateConfirmPassword, trigger: 'blur' }
  ]
}

const startPreview = () => {
  isPreviewing.value = true
}

const stopPreview = () => {
  isPreviewing.value = false
}

onMounted(() => {
  password.value = settingsStore.password || ''
  hasPassword.value = !!settingsStore.password
  lockShortcut.value = settingsStore.lockShortcut
  lockEnabled.value = settingsStore.lockEnabled
  bgPath.value = settingsStore.bgPath
  lockBgPath.value = settingsStore.lockBgPath
  bgMode.value = settingsStore.bgMode
  isDark.value = settingsStore.isDark
  
  loadBgs()

  loadMenuItems()
  loadMenuOrder()
  nextTick(() => {
    initMenuSortable()
  })
})

onUnmounted(() => {
  if (sortableInstance) {
    sortableInstance.destroy()
    sortableInstance = null
  }
})

const loadBgs = async () => {
  try {
    const { data } = await axios.get('http://127.0.0.1:5888/api/settings/bgs')
    if (data.success) {
      allBgs.value = data.data
    }
  } catch (err) {
    console.error('获取背景图列表失败', err)
  }
}

const saveSetting = async (key, value) => {
  const success = await settingsStore.updateSetting(key, value)
  if (success) {
    ElMessage.success('设置保存成功')
  } else {
    ElMessage.error('保存失败，请检查服务状态')
  }
}

const showPasswordDialog = () => {
  passwordForm.value = {
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  }
  passwordDialogVisible.value = true
}

const savePassword = async () => {
  if (!passwordFormRef.value) return
  
  await passwordFormRef.value.validate(async (valid) => {
    if (!valid) return
    
    savingPassword.value = true
    try {
      // 如果已有密码，需要验证当前密码
      if (hasPassword.value) {
        const { data: verifyData } = await axios.post('http://127.0.0.1:5888/api/settings/verify-password', {
          password: passwordForm.value.currentPassword
        })
        if (!verifyData.success) {
          ElMessage.error('当前密码错误')
          savingPassword.value = false
          return
        }
      }
      
      // 保存新密码
      const success = await settingsStore.updateSetting('password', passwordForm.value.newPassword)
      if (success) {
        ElMessage.success('密码修改成功')
        hasPassword.value = !!passwordForm.value.newPassword
        password.value = passwordForm.value.newPassword || ''
        passwordDialogVisible.value = false
      } else {
        ElMessage.error('密码修改失败')
      }
    } catch (error) {
      ElMessage.error('操作失败')
    } finally {
      savingPassword.value = false
    }
  })
}

const beforeBgUpload = (file) => {
  const isImage = file.type.startsWith('image/')
  const isLt30M = file.size / 1024 / 1024 < 30

  if (!isImage) {
    ElMessage.error('上传文件必须是图片格式!')
  }
  if (!isLt30M) {
    ElMessage.error('上传图片大小不能超过 30MB!')
  }
  return isImage && isLt30M
}

const handleMultiBgSuccess = (res) => {
  if (res.success) {
    ElMessage.success(`成功上传 ${res.count} 张图片`)
    loadBgs()
  } else {
    ElMessage.error(res.message || '上传失败')
  }
}

const selectBg = (url) => {
  if (bgSettingType.value === 'global') {
    if (bgPath.value !== url) {
      bgPath.value = url
      saveSetting('background_path', url)
    }
  } else {
    if (lockBgPath.value !== url) {
      lockBgPath.value = url
      saveSetting('lock_bg_path', url)
    }
  }
}

const clearCurrentBg = () => {
  if (bgSettingType.value === 'global') {
    clearGlobalBg()
  } else {
    clearLockBg()
  }
}

const clearGlobalBg = () => {
  bgPath.value = ''
  saveSetting('background_path', '')
}

const clearLockBg = () => {
  lockBgPath.value = ''
  saveSetting('lock_bg_path', '')
}

const deleteBg = async (filename) => {
  try {
    await ElMessageBox.confirm('确定要删除这张背景图吗？', '提示', { type: 'warning' })
    const { data } = await axios.delete(`http://127.0.0.1:5888/api/settings/bgs/${filename}`)
    if (data.success) {
      ElMessage.success('删除成功')
      if (bgPath.value.includes(filename)) {
        clearGlobalBg()
      }
      if (lockBgPath.value.includes(filename)) {
        clearLockBg()
      }
      loadBgs()
    }
  } catch (err) {
    if (err !== 'cancel') console.error(err)
  }
}
</script>

<style scoped>
.settings-page {
  background: transparent;
  min-height: 100%;
  border-radius: 8px;
  padding: 20px;
}

.settings-page :deep(.el-card) {
  background: var(--el-bg-color-overlay, rgba(255, 255, 255, 0.9));
}
.is-previewing {
  opacity: 0.1;
  transition: opacity 0.2s ease;
}

.settings-page {
  transition: opacity 0.2s ease;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.appearance-divider {
  position: relative;
}

.appearance-divider .preview-eye {
  margin-left: 8px;
  cursor: pointer;
  color: var(--el-text-color-secondary);
  transition: color 0.2s;
  user-select: none;
  vertical-align: middle;
  display: inline-flex;
  align-items: center;
}

.appearance-divider .preview-eye:hover {
  color: var(--el-color-primary);
}

.appearance-divider .preview-eye:active {
  color: var(--el-color-primary);
}

.appearance-divider .preview-eye .el-icon {
  font-size: 16px;
}

.box-card {
  max-width: 66%;
  margin: 0 auto;
}

.input-box {
  width: 300px;
}

.ml-2 {
  margin-left: 10px;
}

.form-tip {
  color: #909399;
  font-size: 12px;
  margin-top: 5px;
  margin-left: 12px;
  line-height: 1.2;
}

.bg-upload-container {
  display: flex;
  flex-direction: column;
  width: 100%;
}

.bg-gallery {
  display: flex;
  flex-wrap: wrap;
  gap: 15px;
}

.bg-item {
  position: relative;
  width: 120px;
  height: 80px;
  border-radius: 6px;
  overflow: hidden;
  cursor: pointer;
  border: 2px solid transparent;
  transition: all 0.2s;
  background-color: #f0f2f5;
  contain: layout paint;
}

.bg-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.bg-item.is-active {
  border-color: #409EFF;
}

.bg-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.bg-close {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 20px;
  height: 20px;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 14px;
  opacity: 0;
  transition: opacity 0.2s;
  z-index: 10;
}

.bg-item:hover .bg-close {
  opacity: 1;
}

.bg-close:hover {
  background: #F56C6C;
}

.bg-active-mark {
  position: absolute;
  bottom: 0;
  right: 0;
  background: #409EFF;
  color: #fff;
  font-size: 12px;
  padding: 2px 6px;
  border-top-left-radius: 6px;
}

.bg-type-mark {
  position: absolute;
  top: 4px;
  left: 4px;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: bold;
}

.bg-type-mark.global {
  background: #409EFF;
  color: #fff;
}

.bg-type-mark.lock {
  background: #E6A23C;
  color: #fff;
}

.bg-setting-tabs {
  display: flex;
  align-items: center;
  gap: 15px;
  margin-bottom: 15px;
}

.bg-current-info {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.mt-2 {
  margin-top: 8px;
}

.menu-sort-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 300px;
  margin-left: 120px;
}

.menu-sort-item {
  display: flex;
  align-items: center;
  padding: 10px 15px;
  background-color: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 4px;
  user-select: none;
}

.menu-sort-item .drag-handle {
  cursor: grab;
  margin-right: 15px;
  font-size: 18px;
  color: var(--el-text-color-secondary);
}

.menu-sort-item .drag-handle:active {
  cursor: grabbing;
}

.sortable-ghost {
  opacity: 0.5;
  background-color: var(--el-color-primary-light-9);
}

.sort-menu-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.sort-menu-item :deep(.el-form-item__content) {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  margin-left: 0 !important;
}

.sort-menu-item .form-tip {
  margin-left: 120px;
}

.mb-2 {
  margin-bottom: 8px;
}

.mt-3 {
  margin-top: 12px;
  margin-left: 120px;
}
</style>
