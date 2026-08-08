<template>
  <div class="video-notes-page">
    <div class="page-header">
      <div>
        <h2>视频笔记</h2>
        <p>解析视频 → 下载素材 → 生成 SRT → AI 整理 Markdown 笔记</p>
      </div>
      <el-button :type="status.initialized ? 'success' : 'warning'" :loading="checking" @click="checkOrInitialize">
        <el-icon><CircleCheck v-if="status.initialized" /><Tools v-else /></el-icon>
        {{ status.initialized ? '运行环境正常' : '检测 / 初始化' }}
      </el-button>
    </div>

    <el-alert v-if="statusError" type="error" :title="statusError" :closable="false" show-icon class="status-alert" />

    <el-card class="workflow-card">
      <el-steps :active="activeStep" finish-status="success" align-center>
        <el-step title="解析" description="读取标题、时长和封面" />
        <el-step title="下载" description="保存本地视频" />
        <el-step title="字幕" description="本地语音转 SRT" />
        <el-step title="笔记" description="AI 生成 Markdown" />
      </el-steps>
    </el-card>

    <div class="content-grid">
      <el-card class="input-card">
        <template #header><span>视频来源</span></template>
        <el-form label-position="top">
          <el-form-item label="视频链接">
            <el-input v-model="form.url" placeholder="粘贴 Bilibili、YouTube 等视频链接" clearable @keyup.enter="parseVideo" />
          </el-form-item>
          <el-form-item label="Cookie">
            <el-alert type="info" :closable="false" show-icon>
              系统会根据网址自动选择 `video-captioner` 下的 `cookies_bilbil.txt` 或 `cookies_ytb.txt`。
            </el-alert>
          </el-form-item>
          <div class="button-row">
            <el-button type="primary" :loading="running === 'parse'" :disabled="!form.url" @click="parseVideo">解析视频</el-button>
            <el-button type="success" :loading="running === 'download'" :disabled="!parsed" @click="downloadVideo">下载视频</el-button>
            <el-button type="warning" :loading="running === 'auto'" :disabled="Boolean(running)" @click="autoGenerateNotes">自动生成笔记</el-button>
          </div>
        </el-form>
        <el-descriptions v-if="parsed" :column="1" border class="video-info">
          <el-descriptions-item label="标题">{{ parsed.title || '-' }}</el-descriptions-item>
          <el-descriptions-item label="作者">{{ parsed.uploader || '-' }}</el-descriptions-item>
          <el-descriptions-item label="时长">{{ parsed.duration || '-' }} 秒</el-descriptions-item>
        </el-descriptions>
      </el-card>

      <el-card class="input-card">
        <template #header><div class="card-header-row"><span>字幕与 AI 笔记</span><el-button type="primary" plain class="compact-button" @click="openHistory">历史记录</el-button></div></template>
        <el-form label-position="top">
          <el-form-item label="视频文件路径">
            <div class="path-row">
              <el-input v-model="form.videoPath" placeholder="下载完成后自动填入，也可填写本地视频路径" clearable />
              <el-button v-if="form.videoPath" type="primary" plain size="small" class="compact-button folder-button" @click="openPath(form.videoPath)">打开文件夹</el-button>
            </div>
          </el-form-item>
          <el-form-item label="SRT 文件路径">
            <div class="path-row">
              <el-input v-model="form.srtPath" placeholder="生成 SRT 后自动填入" clearable />
              <el-button v-if="form.srtPath" type="primary" plain size="small" class="compact-button folder-button" @click="openPath(form.srtPath)">打开文件夹</el-button>
            </div>
          </el-form-item>
          <el-form-item label="Markdown 文件路径">
            <div class="path-row">
              <el-input v-model="form.markdownPath" placeholder="生成 Markdown 后自动填入" clearable />
              <el-button v-if="form.markdownPath" type="primary" plain size="small" class="compact-button folder-button" @click="openPath(form.markdownPath)">打开文件夹</el-button>
              <el-button v-if="form.markdownPath" size="small" type="primary" @click="previewMarkdown(form.markdownPath)">预览</el-button>
            </div>
          </el-form-item>
          <el-alert type="info" :closable="false" show-icon class="asr-tip">
            默认使用 B 接口进行在线语音识别，无需下载本地模型；只生成原始 SRT 字幕，不进行翻译。
          </el-alert>
          <div class="config-summary">
            <span>AI API：{{ aiConfig.apiBase || '未配置' }}</span>
            <el-button type="primary" plain @click="openConfig">配置 AI API</el-button>
          </div>
          <div class="model-controls">
            <el-select v-model="aiConfig.model" filterable allow-create placeholder="选择模型" @change="saveSelectedModel">
              <el-option v-for="model in models" :key="model" :label="model" :value="model" />
            </el-select>
            <el-button type="primary" :loading="modelsLoading" @click="loadModels">刷新模型</el-button>
            <span class="balance-row">余额：{{ balanceText }}</span>
            <el-button type="info" plain :icon="Refresh" aria-label="刷新余额" title="刷新余额" @click="loadBalance" />
          </div>
          <div class="button-row">
            <el-button type="primary" :loading="running === 'transcribe'" :disabled="!form.videoPath" @click="transcribe">生成 SRT</el-button>
            <el-button type="success" :loading="running === 'summarize'" :disabled="!form.srtPath || !aiConfig.apiKey || !aiConfig.apiBase || !aiConfig.model" @click="summarize">生成 Markdown 笔记</el-button>
            <el-button type="danger" plain class="compact-button" :disabled="!currentFolderPath" @click="deleteCurrentHistory">删除</el-button>
          </div>
        </el-form>
      </el-card>
    </div>

    <el-card v-if="jobInfo" class="job-card">
      <div class="job-title"><span>{{ jobInfo.message }}</span><el-tag :type="jobInfo.status === 'failed' ? 'danger' : jobInfo.status === 'completed' ? 'success' : 'warning'">{{ jobInfo.status }}</el-tag></div>
      <el-progress :percentage="jobInfo.progress" :status="jobInfo.status === 'failed' ? 'exception' : undefined" />
      <p v-if="jobInfo.status === 'failed'" class="error-text">{{ jobInfo.message }}</p>
      <div v-if="jobInfo.result && resultPath(jobInfo.result)" class="result-row">
        <span class="result-path">{{ resultPath(jobInfo.result) }}</span>
      </div>
    </el-card>

    <el-dialog v-model="configVisible" title="AI Responses API 配置" width="560px">
      <el-form :model="configDraft" label-position="top">
        <el-form-item label="预设 API 配置">
          <div class="preset-select-row"><el-select v-model="configDraftPreset" :loading="apiPresetsLoading" style="width:100%" @change="applyApiPreset"><el-option v-for="preset in apiPresets" :key="preset.id" :label="preset.name" :value="preset.id" /></el-select><el-button type="success" plain @click="createApiPreset">新增</el-button><el-button type="danger" plain :disabled="!configDraftPreset" @click="deleteApiPreset">删除</el-button></div>
        </el-form-item>
        <el-form-item label="预设名称"><el-input v-model="configDraft.name" placeholder="例如：我的 DeepSeek" /></el-form-item>
        <el-form-item label="Base URL"><el-input v-model="configDraft.apiBase" placeholder="例如：https://api.deepseek.com 或 https://token.sensenova.cn/v1" /></el-form-item>
        <el-form-item label="调用方法"><el-select v-model="configDraft.apiMethod" style="width:100%"><el-option label="Responses API" value="responses" /><el-option label="Chat Completions API" value="chat-completions" /></el-select></el-form-item>
        <el-form-item label="API Key"><el-input v-model="configDraft.apiKey" type="password" show-password /></el-form-item>
        <el-form-item label="模型"><el-input v-model="configDraft.model" placeholder="例如：deepseek-chat" /></el-form-item>
        <el-form-item label="生成笔记提示词"><el-input v-model="configDraft.prompt" type="textarea" :rows="5" /></el-form-item>
      </el-form>
      <template #footer><el-button type="info" plain @click="configVisible = false">取消</el-button><el-button type="primary" @click="saveConfig">保存</el-button></template>
    </el-dialog>

    <el-dialog v-model="previewVisible" title="SRT 与 Markdown 预览" width="1100px" align-center>
      <div class="preview-columns">
        <section class="preview-panel"><h3>SRT 文件预览</h3><el-input v-model="srtContent" type="textarea" :rows="24" readonly /></section>
        <section class="preview-panel"><h3>Markdown 文件预览</h3><el-input v-model="markdownContent" type="textarea" :rows="24" readonly /></section>
      </div>
      <template #footer><el-button type="success" plain class="compact-button" @click="copyMarkdown">复制 Markdown</el-button><el-button type="primary" @click="previewVisible = false">关闭</el-button></template>
    </el-dialog>

    <el-dialog v-model="historyVisible" title="视频笔记历史记录" width="900px">
      <el-empty v-if="!history.length" description="暂无历史记录" />
      <div v-else class="history-list">
        <div v-for="item in history" :key="item.folderPath" class="history-item">
          <div><strong>{{ item.name }}</strong><p>{{ item.folderPath }}</p></div>
          <div class="history-actions"><el-button type="primary" plain class="compact-button" @click="openHistoryFolder(item.folderPath)">打开文件夹</el-button><el-button type="danger" plain class="compact-button" @click="deleteHistory(item)">删除</el-button></div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import axios from 'axios'
import { ElMessage, ElMessageBox } from 'element-plus'
import { CircleCheck, Tools, Refresh } from '@element-plus/icons-vue'

const API = 'http://127.0.0.1:5888/api/video-notes'
const DEFAULT_PROMPT = `You are a helpful assistant.

你是一名专业的内容整理助手，擅长把视频字幕（.srt 文件）整理成高质量的读书笔记。

## 任务
读取我提供的 .srt 字幕文件（带时间戳），总结视频内容，生成一份详细、凝练的 markdown 读书笔记。

## 笔记格式规范

### 标题结构
- 一级标题：视频标题（# 视频标题）
- 二级标题：最多不超过 5 个（##），要高度凝练地概括每个板块的核心主题
- 三级标题及以下：不再使用任何 # 层级标题，统一改用以下方式表达：
  - > 引用语法（用于关键小结话语）
  - | 表格（用于数据对比、清单）
  - **加粗**（用于强调要点）

### > 语法的使用规则
- > 只用于标注**关键的小结话语**——类似金句、点睛总结、核心结论
- 杜绝大批量文字使用 > 标注；正文内容用普通段落书写，保持阅读流畅

### 表述方式
- 以**个人写笔记的视角**撰写，语言自然、通顺
- 少用或不用"视频中说道""视频中解释""视频中表示"等指明这是视频笔记的说法，避免阅读不流畅

### 内容要求
- 内容要尽量**详细**，保留原文的关键台词、具体数据、典型例子
- 同时做到**高度凝练**，删繁就简，突出核心观点和逻辑链条
- 逻辑清晰，按板块组织，方便快速复习

## 输出
直接输出整理好的 markdown 笔记，不要添加额外的说明或评价。`
const form = reactive({ url: '', videoPath: '', srtPath: '', markdownPath: '', language: 'zh' })
const apiPresets = ref([])
const apiPresetsLoading = ref(false)
const aiConfig = reactive({ apiBase: 'https://api.deepseek.com', apiMethod: 'responses', apiKey: '', model: 'deepseek-chat', prompt: DEFAULT_PROMPT })
const configDraft = reactive({ name: '', apiBase: aiConfig.apiBase, apiMethod: aiConfig.apiMethod, apiKey: aiConfig.apiKey, model: aiConfig.model, prompt: aiConfig.prompt })
const configDraftPreset = ref('deepseek-official')
const legacyPrompt = ref('')
const API_CONFIG_STORAGE_KEY = 'video-notes-ai-config'
const ACTIVE_API_PRESET_KEY = 'video-notes-active-api-preset'
const activeApiPreset = ref('deepseek-official')
const getPreset = id => apiPresets.value.find(item => item.id === id)
const getPresetId = config => {
  const savedId = localStorage.getItem(ACTIVE_API_PRESET_KEY)
  return (savedId && apiPresets.value.some(item => item.id === savedId) ? savedId : null)
    || apiPresets.value.find(item => item.apiBase && item.apiBase === config.apiBase)?.id
    || activeApiPreset.value
    || apiPresets.value[0]?.id
}
const loadApiPresets = async () => {
  apiPresetsLoading.value = true
  try {
    const { data } = await axios.get(`${API}/api-presets`)
    apiPresets.value = data.data || []
    if (!apiPresets.value.some(item => item.id === configDraftPreset.value)) configDraftPreset.value = apiPresets.value[0]?.id || ''
    if (legacyPrompt.value && apiPresets.value.length) {
      const target = apiPresets.value.find(item => item.id === configDraftPreset.value) || apiPresets.value.find(item => item.id === 'deepseek-official') || apiPresets.value[0]
      if (target && !target.prompt) {
        await axios.put(`${API}/api-presets/${encodeURIComponent(target.id)}`, { ...target, apiMethod: target.apiMethod || 'responses', prompt: legacyPrompt.value })
        target.prompt = legacyPrompt.value
      }
    }
  } catch (error) { ElMessage.error(error.response?.data?.message || 'API 预设读取失败') } finally { apiPresetsLoading.value = false }
}
const loadApiProfile = id => {
  const preset = getPreset(id)
  if (!preset) return
  configDraft.name = preset.name || ''
  configDraft.apiBase = preset.apiBase || ''
  configDraft.apiMethod = preset.apiMethod || 'responses'
  configDraft.apiKey = preset.apiKey || ''
  configDraft.model = preset.model || ''
  configDraft.prompt = preset.prompt || legacyPrompt.value || DEFAULT_PROMPT
}
const createApiPreset = () => {
  configDraftPreset.value = ''
  activeApiPreset.value = ''
  Object.assign(configDraft, { name: '', apiBase: '', apiMethod: 'responses', apiKey: '', model: '', prompt: DEFAULT_PROMPT })
}
const editApiPreset = () => { const preset = getPreset(configDraftPreset.value); if (preset) Object.assign(configDraft, preset) }
const deleteApiPreset = async () => {
  const preset = getPreset(configDraftPreset.value)
  if (!preset) return
  try {
    await ElMessageBox.confirm(`确定删除预设“${preset.name}”吗？`, '删除 API 预设', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' })
    await axios.delete(`${API}/api-presets/${encodeURIComponent(preset.id)}`)
    await loadApiPresets()
    const next = apiPresets.value[0]
    if (next) { configDraftPreset.value = next.id; activeApiPreset.value = next.id; loadApiProfile(next.id) }
    ElMessage.success('API 预设已删除')
  } catch (error) { if (error !== 'cancel' && error?.response) ElMessage.error(error.response?.data?.message || 'API 预设删除失败') }
}
const configVisible = ref(false)
const models = ref([])
const modelsLoading = ref(false)
const balanceText = ref('未查询')
const previewVisible = ref(false)
const markdownContent = ref('')
const srtContent = ref('')
const historyVisible = ref(false)
const history = ref([])
const currentFolderPath = ref('')
const status = reactive({ initialized: false, python: false, package: false, ffmpeg: false })
const parsed = ref(null)
const jobInfo = ref(null)
const checking = ref(false)
const running = ref('')
const statusError = ref('')
let timer = null
const activeStep = computed(() => jobInfo.value?.type === 'summarize' ? 4 : jobInfo.value?.type === 'transcribe' ? 3 : jobInfo.value?.type === 'download' ? 2 : parsed.value ? 1 : 0)

const checkStatus = async () => {
  const { data } = await axios.get(`${API}/status`)
  Object.assign(status, data.data)
}
const checkOrInitialize = async () => {
  checking.value = true
  statusError.value = ''
  try {
    await checkStatus()
    if (!status.initialized) {
      const { data } = await axios.post(`${API}/initialize`)
      if (data.data) Object.assign(status, data.data)
      await checkStatus()
      if (!status.initialized) {
        throw new Error(data.message || '视频笔记环境尚未完整配置，请检查 Python 依赖和 ffmpeg')
      }
      ElMessage.success('视频笔记环境初始化完成')
    } else ElMessage.success('环境检测正常')
  } catch (error) { statusError.value = error.response?.data?.message || '无法连接后端，请先启动 Forge Server' } finally { checking.value = false }
}
const startJob = async (type, payload, displayType = type) => {
  running.value = displayType
  try {
    const { data } = await axios.post(`${API}/${type}`, payload)
    return await poll(data.data.jobId)
  } catch (error) {
    ElMessage.error(error.response?.data?.message || `${type} 任务启动失败`)
    throw error
  } finally {
    if (running.value === displayType) running.value = ''
  }
}
const poll = async id => {
  clearInterval(timer)
  return new Promise((resolve, reject) => {
    const get = async () => {
      try {
        const { data } = await axios.get(`${API}/jobs/${id}`)
        jobInfo.value = data.data
        if (jobInfo.value.status === 'completed' || jobInfo.value.status === 'failed') {
          clearInterval(timer)
          const result = jobInfo.value.result || {}
          if (jobInfo.value.status === 'completed') {
            if (result.video) form.videoPath = result.video
            if (result.srtPath) form.srtPath = result.srtPath
            if (result.markdownPath) {
              form.markdownPath = result.markdownPath
              updateCurrentFolder(result.markdownPath)
            }
            ElMessage.success(jobInfo.value.message)
            if (result.markdownPath) notifyMarkdownSuccess(result.markdownPath)
          }
          resolve(jobInfo.value)
        }
      } catch (error) {
        clearInterval(timer)
        reject(error)
      }
    }
    get()
    timer = setInterval(get, 1000)
  })
}
const parseVideo = async () => {
  await startJob('parse', { url: form.url })
  if (jobInfo.value?.status === 'completed' && jobInfo.value.result) {
    parsed.value = jobInfo.value.result
    await ElMessageBox.confirm(
      `已解析到标题：${parsed.value.title || '未获取到标题'}，请核对视频信息。`,
      '核对视频信息',
      { confirmButtonText: '确认', cancelButtonText: '取消', type: 'info' }
    ).catch(() => {})
  }
}
const downloadVideo = () => startJob('download', { url: form.url, title: parsed.value?.title })
const transcribe = () => startJob('transcribe', { videoPath: form.videoPath, language: form.language })
const summarize = () => startJob('summarize', { inputPath: form.srtPath, title: parsed.value?.title, ...aiConfig })
const autoGenerateNotes = async () => {
  if (!form.url.trim()) return ElMessage.warning('请先输入视频链接')
  if (!aiConfig.apiKey || !aiConfig.apiBase || !aiConfig.model) return ElMessage.warning('请先完成 AI API 配置')
  running.value = 'auto'
  try {
    if (!parsed.value) {
      await parseVideo()
      if (!parsed.value) throw new Error('视频解析未完成')
    }
    const downloadResult = await startJob('download', { url: form.url, title: parsed.value?.title }, 'auto')
    if (downloadResult?.status !== 'completed' || !form.videoPath) throw new Error('视频下载未完成')
    running.value = 'auto'
    const srtResult = await startJob('transcribe', { videoPath: form.videoPath, language: form.language }, 'auto')
    if (srtResult?.status !== 'completed' || !form.srtPath) throw new Error('SRT 生成未完成')
    running.value = 'auto'
    const markdownResult = await startJob('summarize', { inputPath: form.srtPath, title: parsed.value?.title, ...aiConfig }, 'auto')
    if (markdownResult?.status !== 'completed') throw new Error('Markdown 生成未完成')
  } catch (error) {
    if (error.message) ElMessage.error(`自动生成笔记失败：${error.message}`)
  } finally {
    running.value = ''
  }
}
const resultPath = result => result.markdownPath || result.srtPath || result.video || ''
const updateCurrentFolder = filePath => { if (filePath) currentFolderPath.value = filePath.substring(0, filePath.lastIndexOf('\\')) }
const notifyMarkdownSuccess = filePath => {
  if (window.electronAPI?.showSystemNotification) window.electronAPI.showSystemNotification({ title: '视频笔记生成完成', body: `Markdown 文件已生成：${filePath}` })
}
const openPath = filePath => { if (window.electronAPI?.invokeAction) window.electronAPI.invokeAction('show-in-folder', filePath) }
const openConfig = async () => {
  await loadApiPresets()
  configDraftPreset.value = getPresetId(aiConfig) || apiPresets.value[0]?.id || ''
  activeApiPreset.value = configDraftPreset.value
  loadApiProfile(configDraftPreset.value)
  configVisible.value = true
}
const applyApiPreset = id => {
  configDraftPreset.value = id
  activeApiPreset.value = id
  localStorage.setItem(ACTIVE_API_PRESET_KEY, id)
  loadApiProfile(id)
}
const saveConfig = async () => {
  if (!configDraft.name.trim()) return ElMessage.warning('请填写预设名称')
  const payload = { name: configDraft.name.trim(), apiBase: configDraft.apiBase.trim(), apiMethod: configDraft.apiMethod || 'responses', apiKey: configDraft.apiKey, model: configDraft.model.trim(), prompt: configDraft.prompt }
  try {
    const current = getPreset(configDraftPreset.value)
    const { data } = current
      ? await axios.put(`${API}/api-presets/${encodeURIComponent(current.id)}`, payload)
      : await axios.post(`${API}/api-presets`, payload)
    await loadApiPresets()
    configDraftPreset.value = data.data.id
    activeApiPreset.value = data.data.id
    localStorage.setItem(ACTIVE_API_PRESET_KEY, data.data.id)
    Object.assign(aiConfig, data.data)
    localStorage.setItem(API_CONFIG_STORAGE_KEY, JSON.stringify(aiConfig))
    configVisible.value = false
    ElMessage.success('AI 配置预设已保存')
  } catch (error) { ElMessage.error(error.response?.data?.message || 'AI 配置预设保存失败') }
}
const saveSelectedModel = async () => {
  const preset = getPreset(getPresetId(aiConfig))
  if (!preset) return
  try {
    const { data } = await axios.put(`${API}/api-presets/${encodeURIComponent(preset.id)}`, { name: preset.name, apiBase: aiConfig.apiBase, apiMethod: aiConfig.apiMethod || 'responses', apiKey: aiConfig.apiKey, model: aiConfig.model, prompt: aiConfig.prompt })
    Object.assign(preset, data.data)
    localStorage.setItem(API_CONFIG_STORAGE_KEY, JSON.stringify(aiConfig))
  } catch (error) { ElMessage.error(error.response?.data?.message || '模型配置保存失败') }
}
const loadModels = async () => {
  if (!aiConfig.apiKey) return ElMessage.warning('请先在 AI API 配置中填写 API Key')
  modelsLoading.value = true
  try { const { data } = await axios.get(`${API}/models`, { params: { apiBase: aiConfig.apiBase, apiMethod: aiConfig.apiMethod, apiKey: aiConfig.apiKey } }); models.value = (data.data.data || []).map(item => item.id); ElMessage.success('模型列表已刷新') }
  catch (error) { ElMessage.error(error.response?.data?.message || '模型列表获取失败') } finally { modelsLoading.value = false }
}
const loadBalance = async () => {
  if (!aiConfig.apiKey) { balanceText.value = '暂无余额信息'; return }
  try { const { data } = await axios.get(`${API}/balance`, { params: { apiBase: aiConfig.apiBase, apiMethod: aiConfig.apiMethod, apiKey: aiConfig.apiKey } }); balanceText.value = (data.data.balance_infos || []).map(item => `${item.total_balance} ${item.currency}`).join(' / ') || '无余额信息' }
  catch { balanceText.value = '暂无余额信息' }
}
const readTextFile = async filePath => {
  if (!filePath) return ''
  const { data } = await axios.get(`${API}/file`, { params: { path: filePath }, responseType: 'text' })
  return data
}
const previewMarkdown = async filePath => {
  try {
    const srtPath = form.srtPath || filePath.replace(/\.md$/i, '.srt')
    srtContent.value = await readTextFile(srtPath)
    markdownContent.value = await readTextFile(filePath)
    currentFolderPath.value = form.markdownPath ? filePath.substring(0, filePath.lastIndexOf('\\')) : ''
    previewVisible.value = true
  } catch (error) { ElMessage.error(error.response?.data?.message || '预览文件读取失败') }
}
const openHistoryFolder = folderPath => openPath(folderPath)
const loadHistory = async () => {
  try { const { data } = await axios.get(`${API}/history`); history.value = data.data || [] }
  catch (error) { ElMessage.error(error.response?.data?.message || '历史记录读取失败') }
}
const openHistory = async () => { await loadHistory(); historyVisible.value = true }
const deleteHistory = async item => {
  try {
    await ElMessageBox.confirm(`确定删除“${item.name}”及其全部视频、SRT、Markdown 文件吗？`, '删除历史记录', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' })
    await axios.delete(`${API}/history`, { data: { folderPath: item.folderPath } })
    if (item.folderPath === currentFolderPath.value) { currentFolderPath.value = ''; form.videoPath = ''; form.srtPath = ''; form.markdownPath = '' }
    await loadHistory()
    ElMessage.success('历史记录已删除')
  } catch (error) { if (error !== 'cancel' && error?.response) ElMessage.error(error.response?.data?.message || '删除失败') }
}
const deleteCurrentHistory = async () => {
  const item = history.value.find(record => record.folderPath === currentFolderPath.value)
  if (item) await deleteHistory(item)
  else if (form.markdownPath) await deleteHistory({ name: '当前任务', folderPath: form.markdownPath.substring(0, form.markdownPath.lastIndexOf('\\')) })
}
const copyMarkdown = async () => { await navigator.clipboard.writeText(markdownContent.value); ElMessage.success('Markdown 已复制') }
onMounted(async () => {
  try {
    const saved = JSON.parse(localStorage.getItem(API_CONFIG_STORAGE_KEY) || '{}')
    Object.assign(aiConfig, saved)
    legacyPrompt.value = saved.prompt || ''
  } catch {}
  await loadApiPresets()
  const activePreset = getPresetId(aiConfig) || apiPresets.value[0]?.id || ''
  configDraftPreset.value = activePreset
  activeApiPreset.value = activePreset
  if (activePreset) localStorage.setItem(ACTIVE_API_PRESET_KEY, activePreset)
  if (activePreset && getPreset(activePreset)) {
    const preset = getPreset(activePreset)
    Object.assign(aiConfig, { apiBase: preset.apiBase, apiMethod: preset.apiMethod || 'responses', apiKey: preset.apiKey, model: preset.model, prompt: preset.prompt || aiConfig.prompt })
  }
  checkStatus().catch(() => { statusError.value = '后端服务未启动，请先启动 Forge Server' })
  if (aiConfig.apiKey) loadBalance()
})
onUnmounted(() => clearInterval(timer))
</script>

<style scoped>
.video-notes-page { padding: 24px; height: 100%; overflow: auto; color: var(--el-text-color-primary); }
.page-header, .job-title, .button-row, .result-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.page-header { margin-bottom: 20px; padding: 18px 22px; border: 1px solid rgba(96, 165, 250, 0.35); border-radius: 14px; background: linear-gradient(135deg, rgb(94 75 37 / 92%), rgba(15, 23, 42, 0.96)); box-shadow: 0 8px 24px rgba(15, 23, 42, 0.28); }
.page-header h2 { margin: 0 0 8px; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: 1px; text-shadow: 0 2px 8px rgba(0, 0, 0, 0.32); }
.page-header p { margin: 0; color: #dbeafe; font-size: 14px; font-weight: 500; letter-spacing: 0.3px; }
.status-alert, .workflow-card, .job-card { margin-bottom: 20px; }
.content-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; }
.input-card { min-height: 380px; } .video-info { margin-top: 20px; } .form-row { display: flex; gap: 12px; margin-bottom: 18px; } .form-row > * { flex: 1; } .half { flex: 1; margin-bottom: 0; }
.path-row { display: flex; gap: 10px; width: 100%; align-items: center; } .path-row .el-input { flex: 1; } .preset-select-row { display: flex; gap: 8px; width: 100%; align-items: center; } .preset-select-row .el-select { flex: 1; min-width: 0; } .preset-select-row :deep(.el-button) { min-width: 64px; width: auto; padding: 0 10px; } .asr-tip { margin-bottom: 18px; } .config-summary, .model-controls, .balance-row { display: flex; align-items: center; gap: 12px; } .config-summary { justify-content: space-between; margin: 8px 0 18px; color: var(--el-text-color-secondary); } .model-controls { margin-bottom: 18px; } .model-controls .el-select { flex: 1; min-width: 180px; } .balance-row { color: var(--el-text-color-secondary); white-space: nowrap; } .result-row .button-row { flex-shrink: 0; }
.button-row { justify-content: flex-start; } .card-header-row { display: flex; align-items: center; justify-content: space-between; width: 100%; } .video-notes-page :deep(.compact-button) { min-width: 82px !important; height: 30px !important; padding: 0 12px; font-size: 13px; } .folder-button { color: var(--el-color-primary); border-color: var(--el-color-primary-light-5); background: var(--el-color-primary-light-9); } .video-notes-page :deep(.el-button) { min-width: 108px; height: 36px; font-weight: 600; } .video-notes-page :deep(.el-button.is-link) { min-width: auto; } .model-controls :deep(.el-button) { min-width: 82px !important; width: auto; height: 32px !important; padding: 0 12px; } .model-controls :deep(.el-button.is-plain) { min-width: 32px !important; width: 32px; padding: 0; } .preview-columns { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px; } .preview-panel { min-width: 0; } .preview-panel h3 { margin: 0 0 10px; font-size: 15px; } .preview-panel :deep(.el-textarea__inner) { overflow-y: auto; resize: none; font-family: Consolas, monospace; line-height: 1.5; } .history-list { max-height: 60vh; overflow-y: auto; } .history-item { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px 0; border-bottom: 1px solid var(--el-border-color-lighter); } .history-item p { margin: 6px 0 0; color: var(--el-text-color-secondary); font-size: 12px; word-break: break-all; } .history-actions { display: flex; flex-shrink: 0; gap: 8px; } .job-card { margin-top: 20px; } .error-text { color: var(--el-color-danger); margin-top: 12px; }
@media (max-width: 900px) { .content-grid { grid-template-columns: 1fr; } .preview-columns { grid-template-columns: 1fr; } .page-header { align-items: flex-start; flex-direction: column; } }
</style>
