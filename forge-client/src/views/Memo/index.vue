<template>
  <div class="memo-container">
    <!-- 控制面板 -->
    <div class="memo-controls">
      <el-button type="primary" :icon="Plus" @click="openMemoDialog()">新建备忘</el-button>
      <el-radio-group v-model="displayMode" size="small">
        <el-radio-button label="all">全部</el-radio-button>
        <el-radio-button label="permanent">长期展示</el-radio-button>
        <el-radio-button label="random">随机展示</el-radio-button>
      </el-radio-group>
      <el-button v-if="displayMode === 'random' || displayMode === 'all'" type="info" :icon="Refresh" size="small" @click="refreshRandomMemos">
        刷新随机
      </el-button>
      <el-popover v-if="displayMode === 'random' || displayMode === 'all'" placement="bottom" :width="200" trigger="click">
        <template #reference>
          <el-button type="warning" :icon="Setting" size="small">设置数量</el-button>
        </template>
        <div class="random-count-setting">
          <div class="setting-label">每次随机展示数量</div>
          <el-slider v-model="randomCount" :min="1" :max="20" show-stops @change="saveRandomCount" />
          <div class="setting-value">{{ randomCount }} 条</div>
        </div>
      </el-popover>
    </div>

    <!-- 便签墙 -->
    <div class="memo-wall" ref="wallRef">
      <!-- 长期展示的便签 -->
      <template v-if="displayMode === 'all' || displayMode === 'permanent'">
        <div
          v-for="memo in permanentMemos"
          :key="memo.id"
          class="memo-note permanent"
          :style="getNoteStyle(memo)"
        >
          <div class="note-pin"></div>
          <div class="note-header">
            <div class="note-title">{{ memo.title || '无标题' }}</div>
            <div class="note-actions">
              <el-button type="primary" size="small" :icon="Edit" circle @click="editMemo(memo)" />
              <el-button type="danger" size="small" :icon="Delete" circle @click="deleteMemo(memo)" />
            </div>
          </div>
          <div class="note-content-full">{{ memo.content || '无内容' }}</div>
          <div class="note-images" v-if="memo.attachments && memo.attachments.length > 0">
            <img
              v-for="(att, idx) in memo.attachments.slice(0, 2)"
              :key="idx"
              :src="att.url"
              class="note-thumb"
              @click.stop="previewImage(att.url)"
            />
            <span v-if="memo.attachments.length > 2" class="more-images">+{{ memo.attachments.length - 2 }}</span>
          </div>
          <div class="note-footer">
            <div class="note-type-tag">长期</div>
            <div class="note-date">{{ formatDate(memo.created_at) }}</div>
          </div>
        </div>
      </template>

      <!-- 随机展示的便签 -->
      <template v-if="(displayMode === 'all' || displayMode === 'random') && randomMemos.length > 0">
        <div class="random-section-title" v-if="displayMode === 'all'">随机抽取</div>
        <div
          v-for="memo in randomMemos"
          :key="memo.id"
          class="memo-note random"
          :style="getNoteStyle(memo, true)"
        >
          <div class="note-pin"></div>
          <div class="note-header">
            <div class="note-title">{{ memo.title || '无标题' }}</div>
            <div class="note-actions">
              <el-button type="primary" size="small" :icon="Edit" circle @click="editMemo(memo)" />
              <el-button type="danger" size="small" :icon="Delete" circle @click="deleteMemo(memo)" />
            </div>
          </div>
          <div class="note-content-full">{{ memo.content || '无内容' }}</div>
          <div class="note-images" v-if="memo.attachments && memo.attachments.length > 0">
            <img
              v-for="(att, idx) in memo.attachments.slice(0, 2)"
              :key="idx"
              :src="att.url"
              class="note-thumb"
              @click.stop="previewImage(att.url)"
            />
            <span v-if="memo.attachments.length > 2" class="more-images">+{{ memo.attachments.length - 2 }}</span>
          </div>
          <div class="note-footer">
            <div class="note-type-tag random-tag">随机</div>
            <div class="note-date">{{ formatDate(memo.created_at) }}</div>
          </div>
        </div>
      </template>

      <!-- 空状态 -->
      <el-empty v-if="filteredMemos.length === 0" description="暂无备忘录" :image-size="100" />
    </div>

    <!-- 新建/编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="editingMemo ? '编辑备忘' : '新建备忘'"
      width="600px"
      destroy-on-close
    >
      <el-form :model="memoForm" label-width="80px">
        <el-form-item label="标题">
          <el-input v-model="memoForm.title" placeholder="请输入标题（可选）" />
        </el-form-item>
        <el-form-item label="内容">
          <el-input
            v-model="memoForm.content"
            type="textarea"
            :rows="6"
            placeholder="请输入内容"
          />
        </el-form-item>
        <el-form-item label="展示方式">
          <el-radio-group v-model="memoForm.display_type">
            <el-radio label="permanent">长期展示</el-radio>
            <el-radio label="random">随机展示</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveMemo">保存</el-button>
      </template>
    </el-dialog>

    <!-- 图片预览 -->
    <el-dialog v-model="previewVisible" width="80%" center destroy-on-close>
      <img :src="previewUrl" style="width: 100%; max-height: 80vh; object-fit: contain;" />
    </el-dialog>

    <!-- 所有记录抽屉 -->
    <el-drawer v-model="drawerVisible" title="所有备忘录" size="500px">
      <div class="all-memos-list">
        <div
          v-for="memo in allMemos"
          :key="memo.id"
          class="memo-list-item"
        >
          <div class="item-header">
            <span class="item-title">{{ memo.title || '无标题' }}</span>
            <el-tag size="small" :type="memo.display_type === 'permanent' ? 'success' : 'warning'">
              {{ memo.display_type === 'permanent' ? '长期' : '随机' }}
            </el-tag>
          </div>
          <div class="item-content">{{ getContentPreview(memo.content, 50) }}</div>
          <div class="item-images" v-if="memo.attachments && memo.attachments.length > 0">
            <img
              v-for="(att, idx) in memo.attachments.slice(0, 3)"
              :key="idx"
              :src="att.url"
              class="item-thumb"
            />
          </div>
          <div class="item-actions">
            <el-button type="primary" size="small" :icon="Edit" @click="editMemo(memo)">编辑</el-button>
            <el-button type="danger" size="small" :icon="Delete" @click="deleteMemo(memo)">删除</el-button>
          </div>
        </div>
      </div>
    </el-drawer>

    <!-- 查看所有按钮 -->
    <el-button
      class="view-all-btn"
      type="info"
      :icon="List"
      circle
      size="large"
      @click="drawerVisible = true"
      title="查看所有备忘录"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { Plus, Delete, Edit, Refresh, List, Setting } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import axios from 'axios'

const BASE_URL = 'http://localhost:5888'
const API_BASE = `${BASE_URL}/api/memos`

// 数据
const allMemos = ref([])
const randomMemos = ref([])
const displayMode = ref('all')
const dialogVisible = ref(false)
const editingMemo = ref(null)
const flippedCards = ref([])
const drawerVisible = ref(false)
const previewVisible = ref(false)
const previewUrl = ref('')
const wallRef = ref(null)
const randomCount = ref(3) // 随机展示数量（页面级设置）

// 表单
const memoForm = ref({
  title: '',
  content: '',
  display_type: 'permanent'
})

// 计算属性
const permanentMemos = computed(() => {
  return allMemos.value.filter(m => m.display_type === 'permanent')
})

const filteredMemos = computed(() => {
  if (displayMode.value === 'permanent') return permanentMemos.value
  if (displayMode.value === 'random') return randomMemos.value
  return [...permanentMemos.value, ...randomMemos.value]
})

// 加载随机展示数量设置
const loadRandomCount = async () => {
  try {
    const { data } = await axios.get(`${API_BASE}/settings/random-count`)
    if (data.success) {
      randomCount.value = data.data
    }
  } catch (err) {
    console.log('加载随机数量设置失败', err)
  }
}

// 保存随机展示数量设置
const saveRandomCount = async () => {
  try {
    await axios.put(`${API_BASE}/settings/random-count`, { count: randomCount.value })
    ElMessage.success('设置已保存')
    refreshRandomMemos()
  } catch (err) {
    ElMessage.error('保存设置失败')
  }
}

// 加载数据
const loadMemos = async () => {
  try {
    const [{ data: memosData }, { data: countData }] = await Promise.all([
      axios.get(API_BASE),
      axios.get(`${API_BASE}/settings/random-count`)
    ])
    if (memosData.success) {
      allMemos.value = memosData.data
    }
    if (countData.success) {
      randomCount.value = countData.data
    }
    refreshRandomMemos()
  } catch (err) {
    ElMessage.error('加载备忘录失败')
  }
}

const refreshRandomMemos = () => {
  // 从随机类型的备忘录中抽取
  const randomPool = allMemos.value.filter(m => m.display_type === 'random')
  // 使用页面级设置 randomCount
  const count = randomCount.value
  // 随机打乱
  const shuffled = [...randomPool].sort(() => 0.5 - Math.random())
  randomMemos.value = shuffled.slice(0, Math.min(count, randomPool.length))
}

// 便签样式 - 生成随机位置和旋转角度
const getNoteStyle = (memo, isRandom = false) => {
  const colors = isRandom
    ? ['#fff3e0', '#e3f2fd', '#f3e5f5', '#e8f5e9', '#fce4ec']
    : ['#fff9c4', '#c8e6c9', '#b3e5fc', '#d1c4e9', '#f8bbd9']

  // 使用 memo.id 生成伪随机数，保证同一便签位置固定
  const seed = memo.id.toString().split('').reduce((a, b) => a + parseInt(b), 0)
  const colorIndex = seed % colors.length
  const rotation = (seed % 7) - 3 // -3 到 3 度
  const marginTop = (seed % 20) + 10 // 10 到 30px

  return {
    backgroundColor: colors[colorIndex],
    transform: `rotate(${rotation}deg)`,
    marginTop: `${marginTop}px`
  }
}

// 内容预览
const getContentPreview = (content, maxLength = 60) => {
  if (!content) return '无内容'
  return content.length > maxLength ? content.substring(0, maxLength) + '...' : content
}

// 日期格式化
const formatDate = (dateStr) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

// 翻转卡片
const flipCard = (id) => {
  const index = flippedCards.value.indexOf(id)
  if (index > -1) {
    flippedCards.value.splice(index, 1)
  } else {
    flippedCards.value.push(id)
  }
}

// 打开对话框
const openMemoDialog = () => {
  editingMemo.value = null
  memoForm.value = {
    title: '',
    content: '',
    display_type: 'permanent'
  }
  dialogVisible.value = true
}

// 编辑备忘录
const editMemo = (memo) => {
  editingMemo.value = memo
  memoForm.value = {
    title: memo.title,
    content: memo.content,
    display_type: memo.display_type
  }
  dialogVisible.value = true
}

// 保存备忘录
const saveMemo = async () => {
  try {
    const payload = { ...memoForm.value }

    if (editingMemo.value) {
      await axios.put(`${API_BASE}/${editingMemo.value.id}`, payload)
      ElMessage.success('更新成功')
    } else {
      await axios.post(API_BASE, payload)
      ElMessage.success('创建成功')
    }

    dialogVisible.value = false
    loadMemos()
  } catch (err) {
    ElMessage.error('保存失败')
  }
}

// 删除备忘录
const deleteMemo = async (memo) => {
  try {
    await ElMessageBox.confirm('确定要删除这条备忘录吗？', '提示', { type: 'warning' })
    await axios.delete(`${API_BASE}/${memo.id}`)
    ElMessage.success('删除成功')
    loadMemos()
    drawerVisible.value = false
  } catch (err) {
    if (err !== 'cancel') {
      ElMessage.error('删除失败')
    }
  }
}

// 预览图片
const previewImage = (url) => {
  previewUrl.value = url
  previewVisible.value = true
}

onMounted(() => {
  loadMemos()
})
</script>

<style scoped>
.memo-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 20px;
  background: var(--el-bg-color-page, #f5f7fa);
  position: relative;
}

.memo-controls {
  display: flex;
  gap: 15px;
  margin-bottom: 20px;
  align-items: center;
  flex-wrap: wrap;
}

.memo-wall {
  flex: 1;
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  padding: 20px;
  overflow-y: auto;
  align-content: flex-start;
  background:
    linear-gradient(90deg, rgba(200,200,200,0.1) 1px, transparent 1px),
    linear-gradient(rgba(200,200,200,0.1) 1px, transparent 1px);
  background-size: 20px 20px;
  border-radius: 12px;
  position: relative;
}

.random-section-title {
  width: 100%;
  font-size: 14px;
  color: var(--el-text-color-secondary);
  margin: 10px 0;
  padding-left: 10px;
  border-left: 3px solid var(--el-color-primary);
}

/* 便签卡片样式 */
.memo-note {
  width: 260px;
  min-height: auto;
  padding: 20px;
  border-radius: 4px;
  box-shadow: 2px 2px 8px rgba(0,0,0,0.15);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
  position: relative;
  overflow: visible;
  display: flex;
  flex-direction: column;
  cursor: default;
}

.memo-note:hover {
  transform: rotate(0deg) scale(1.03) !important;
  box-shadow: 4px 4px 15px rgba(0,0,0,0.2);
  z-index: 10;
}

.note-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 10px;
}

.note-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: auto;
  padding-top: 10px;
}

/* 图钉效果 */
.note-pin {
  position: absolute;
  top: -8px;
  left: 50%;
  transform: translateX(-50%);
  width: 16px;
  height: 16px;
  background: radial-gradient(circle at 30% 30%, #ff6b6b, #c92a2a);
  border-radius: 50%;
  box-shadow: 1px 1px 3px rgba(0,0,0,0.3);
}

.note-pin::after {
  content: '';
  position: absolute;
  bottom: -6px;
  left: 50%;
  transform: translateX(-50%);
  width: 2px;
  height: 10px;
  background: rgba(0,0,0,0.3);
}

.note-title {
  font-weight: bold;
  font-size: 16px;
  color: #1a1a1a;
  word-wrap: break-word;
  overflow-wrap: break-word;
  flex: 1;
  padding-right: 10px;
  cursor: default;
}

.note-content-full {
  font-size: 13px;
  color: #333333;
  line-height: 1.6;
  margin-bottom: 10px;
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow-wrap: break-word;
  max-height: 300px;
  overflow-y: auto;
  /* 隐藏滚动条但保留滚动功能 */
  scrollbar-width: none;
  -ms-overflow-style: none;
  cursor: text;
}

.note-content-full::-webkit-scrollbar {
  display: none;
}

.note-actions {
  display: flex;
  gap: 5px;
  opacity: 1;
}

/* 便签hover时确保操作按钮始终可见 */
.memo-note:hover .note-actions {
  opacity: 1;
}

.note-images {
  display: flex;
  gap: 5px;
  margin-bottom: 8px;
}

.note-thumb {
  width: 40px;
  height: 40px;
  object-fit: cover;
  border-radius: 4px;
  cursor: pointer;
  border: 1px solid rgba(0,0,0,0.1);
}

.more-images {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0,0,0,0.05);
  border-radius: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.note-date {
  font-size: 11px;
  color: #555555;
}

.note-type-tag {
  padding: 2px 8px;
  background: var(--el-color-success-light);
  color: var(--el-color-success);
  border-radius: 12px;
  font-size: 11px;
}

.random-tag {
  background: var(--el-color-warning-light);
  color: var(--el-color-warning);
}

/* 查看所有按钮 */
.view-all-btn {
  position: fixed;
  bottom: 30px;
  right: 30px;
  z-index: 100;
  box-shadow: 0 2px 12px rgba(0,0,0,0.2);
}

/* 抽屉中的列表 */
.all-memos-list {
  padding: 10px;
}

.memo-list-item {
  padding: 15px;
  margin-bottom: 15px;
  background: var(--el-bg-color);
  border-radius: 8px;
  border: 1px solid var(--el-border-color-lighter);
}

.item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.item-title {
  font-weight: bold;
  font-size: 15px;
}

.item-content {
  font-size: 13px;
  color: var(--el-text-color-regular);
  margin-bottom: 10px;
  line-height: 1.5;
}

.item-images {
  display: flex;
  gap: 5px;
  margin-bottom: 10px;
}

.item-thumb {
  width: 60px;
  height: 60px;
  object-fit: cover;
  border-radius: 4px;
}

.item-actions {
  display: flex;
  gap: 10px;
}

.slider-hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-left: 10px;
}

.random-count-setting {
  padding: 10px;
}

.random-count-setting .setting-label {
  font-size: 14px;
  color: var(--el-text-color-primary);
  margin-bottom: 15px;
  font-weight: 500;
}

.random-count-setting .setting-value {
  text-align: center;
  font-size: 16px;
  color: var(--el-color-primary);
  margin-top: 10px;
  font-weight: bold;
}
</style>
