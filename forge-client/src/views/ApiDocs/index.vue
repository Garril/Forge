<template>
  <div class="api-docs-container" @mousedown="handleContainerMouseDown" @mouseup="handleContainerMouseUp" @mousemove="handleContainerMouseMove">
    <!-- 左侧目录树 -->
    <div class="sidebar" ref="sidebarRef">
      <div class="sidebar-header">
        <el-dropdown @command="handleCreateCommand">
          <el-button type="primary" :icon="Plus" size="small">
            新建<el-icon class="el-icon--right"><arrow-down /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="file">新建文件</el-dropdown-item>
              <el-dropdown-item command="folder">新建文件夹</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-button :icon="Refresh" size="small" circle @click="loadFileList" />
      </div>
      
      <!-- 文件树区域（支持拖拽和框选） -->
      <div 
        class="file-tree-container"
        @dragover.prevent
        @drop="handleTreeDrop"
      >
        <!-- 框选层 -->
        <div 
          v-if="isSelecting"
          class="selection-box"
          :style="selectionBoxStyle"
        />
        
        <div class="file-tree" ref="treeContainerRef">
          <tree-node
            v-for="node in fileTree"
            :key="node.path"
            :node="node"
            :selected-files="selectedFiles"
            :dragging-file="draggingFile"
            @node-click="handleNodeClick"
            @node-dblclick="handleNodeDblClick"
            @drag-start="handleDragStart"
            @drag-end="handleDragEnd"
            @drop="handleNodeDrop"
            @rename="renameFile"
            @delete="deleteFile"
          />
        </div>
      </div>
    </div>

    <!-- 右侧编辑器 -->
    <div class="editor-wrapper" v-if="currentFile">
      <div class="editor-header">
        <span class="file-path">{{ currentFile.path }}</span>
        <div class="editor-actions">
          <el-button type="primary" :icon="Check" size="small" @click="saveFile">保存</el-button>
        </div>
      </div>
      <div class="editor-body">
        <div class="editor-pane">
          <textarea
            ref="editorRef"
            v-model="fileContent"
            class="markdown-editor"
            placeholder="输入 Markdown 内容..."
            @keydown="handleKeydown"
            @input="onEditorInput"
          />
          <div class="upload-area">
            <el-upload
              class="image-uploader"
              action="http://127.0.0.1:5888/api/upload/markdown-image"
              name="image"
              :show-file-list="false"
              :on-success="handleImageSuccess"
              :before-upload="beforeImageUpload"
            >
              <el-button :icon="Picture" size="small">插入图片</el-button>
            </el-upload>
            <span class="upload-tip">支持粘贴截图或点击上传</span>
          </div>
        </div>
        <div class="preview-pane" v-html="renderedContent" />
      </div>
    </div>

    <div v-else class="empty-state">
      <el-empty description="选择或创建一个 Markdown 文件">
        <el-button type="primary" @click="showCreateDialog = true">新建文件</el-button>
      </el-empty>
    </div>

    <!-- 新建文件/文件夹弹窗 -->
    <el-dialog v-model="showCreateDialog" :title="createType === 'folder' ? '新建文件夹' : '新建 Markdown 文件'" width="400px">
      <el-form :model="newFileForm" label-width="80px">
        <el-form-item :label="createType === 'folder' ? '文件夹名' : '文件名'">
          <el-input v-model="newFileForm.name" :placeholder="createType === 'folder' ? '例如: 配置文档' : '例如: api-config.md'" />
        </el-form-item>
        <el-form-item label="目录">
          <el-select v-model="newFileForm.folder" placeholder="选择目录" style="width: 100%">
            <el-option label="根目录" value="" />
            <el-option v-for="folder in folders" :key="folder" :label="folder" :value="folder" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" @click="createItem" :disabled="!newFileForm.name">创建</el-button>
      </template>
    </el-dialog>

    <!-- 重命名弹窗 -->
    <el-dialog v-model="showRenameDialog" title="重命名" width="400px">
      <el-form label-width="80px">
        <el-form-item label="新名称">
          <el-input v-model="renameForm.newName" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showRenameDialog = false">取消</el-button>
        <el-button type="primary" @click="confirmRename" :disabled="!renameForm.newName">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick, h } from 'vue'
import axios from 'axios'
import { ElMessage, ElMessageBox } from 'element-plus'
import { 
  Plus, Refresh, Check, Picture, ArrowDown
} from '@element-plus/icons-vue'
import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'
import 'highlight.js/styles/github-dark.css'

const API_BASE = 'http://127.0.0.1:5888/api'

// Markdown 渲染器
const md = new MarkdownIt({
  highlight: function (str, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(str, { language: lang }).value
      } catch (__) {}
    }
    return ''
  },
  breaks: true,
  linkify: true
})

// 状态
const fileTree = ref([])
const currentFile = ref(null)
const fileContent = ref('')
const originalContent = ref('')
const editorRef = ref(null)
const showCreateDialog = ref(false)
const showRenameDialog = ref(false)
const createType = ref('file')
const sidebarRef = ref(null)
const treeContainerRef = ref(null)

// 拖拽和选择状态
const draggingFile = ref(null)
const selectedFiles = ref(new Set())
const isSelecting = ref(false)
const selectionStart = ref({ x: 0, y: 0 })
const selectionEnd = ref({ x: 0, y: 0 })

const newFileForm = ref({
  name: '',
  folder: ''
})

const renameForm = ref({
  oldPath: '',
  newName: '',
  isDirectory: false
})

// 计算属性
const folders = computed(() => {
  const result = []
  const traverse = (nodes) => {
    for (const node of nodes) {
      if (node.isDirectory) {
        result.push(node.path)
        if (node.children) traverse(node.children)
      }
    }
  }
  traverse(fileTree.value)
  return result
})

const renderedContent = computed(() => {
  return md.render(fileContent.value)
})

const selectionBoxStyle = computed(() => {
  const left = Math.min(selectionStart.value.x, selectionEnd.value.x)
  const top = Math.min(selectionStart.value.y, selectionEnd.value.y)
  const width = Math.abs(selectionEnd.value.x - selectionStart.value.x)
  const height = Math.abs(selectionEnd.value.y - selectionStart.value.y)
  return {
    left: `${left}px`,
    top: `${top}px`,
    width: `${width}px`,
    height: `${height}px`
  }
})

// 递归树节点组件
const TreeNode = {
  props: ['node', 'selectedFiles', 'draggingFile'],
  emits: ['node-click', 'node-dblclick', 'drag-start', 'drag-end', 'drop', 'rename', 'delete'],
  setup(props, { emit }) {
    const isExpanded = ref(true)
    const isDragOver = ref(false)
    
    const isSelected = computed(() => props.selectedFiles.has(props.node.path))
    const isDragging = computed(() => props.draggingFile?.path === props.node.path)
    
    const handleClick = (e) => {
      if (props.node.isDirectory) {
        isExpanded.value = !isExpanded.value
      }
      emit('node-click', props.node, e)
    }
    
    const handleDblClick = () => {
      if (!props.node.isDirectory) {
        emit('node-dblclick', props.node)
      }
    }
    
    const onDragStart = (e) => {
      if (props.node.isDirectory) {
        e.preventDefault()
        return
      }
      emit('drag-start', props.node, e)
    }
    
    const onDragEnd = () => {
      emit('drag-end')
    }
    
    const onDragOver = (e) => {
      e.preventDefault()
      if (props.node.isDirectory) {
        isDragOver.value = true
      }
    }
    
    const onDragLeave = () => {
      isDragOver.value = false
    }
    
    const onDrop = (e) => {
      e.preventDefault()
      isDragOver.value = false
      emit('drop', props.node, e)
    }
    
    return () => h('div', {
      class: 'tree-node-wrapper'
    }, [
      h('div', {
        class: [
          'tree-node',
          { 
            'is-directory': props.node.isDirectory,
            'is-selected': isSelected.value,
            'is-dragging': isDragging.value,
            'is-drag-over': isDragOver.value
          }
        ],
        style: { paddingLeft: `${(props.node.level || 0) * 16 + 8}px` },
        draggable: !props.node.isDirectory,
        onClick: handleClick,
        onDblclick: handleDblClick,
        onDragstart: onDragStart,
        onDragend: onDragEnd,
        onDragover: onDragOver,
        onDragleave: onDragLeave,
        onDrop: onDrop
      }, [
        h('span', { class: 'expand-icon' }, [
          props.node.isDirectory 
            ? h('span', { class: ['folder-icon', { expanded: isExpanded.value }] }, '▶')
            : null
        ]),
        h('el-icon', { size: 16 }, () => props.node.isDirectory ? h('span', '📁') : h('span', '📄')),
        h('span', { class: 'node-label' }, props.node.name),
        !props.node.isDirectory 
          ? h('span', { class: 'node-actions' }, [
              h('el-icon', { 
                class: 'action-btn',
                onClick: (e) => { e.stopPropagation(); emit('rename', props.node); }
              }, () => h('span', '✏️')),
              h('el-icon', { 
                class: 'action-btn delete',
                onClick: (e) => { e.stopPropagation(); emit('delete', props.node); }
              }, () => h('span', '🗑️'))
            ])
          : null
      ]),
      // 子节点
      (props.node.isDirectory && isExpanded.value && props.node.children?.length)
        ? h('div', { class: 'tree-children' }, 
            props.node.children.map(child => h(TreeNode, {
              key: child.path,
              node: { ...child, level: (props.node.level || 0) + 1 },
              selectedFiles: props.selectedFiles,
              draggingFile: props.draggingFile,
              onNodeClick: (n, e) => emit('node-click', n, e),
              onNodeDblclick: (n) => emit('node-dblclick', n),
              onDragStart: (n, e) => emit('drag-start', n, e),
              onDragEnd: () => emit('drag-end'),
              onDrop: (n, e) => emit('drop', n, e),
              onRename: (n) => emit('rename', n),
              onDelete: (n) => emit('delete', n)
            }))
          )
        : null
    ])
  }
}

// 方法
const loadFileList = async () => {
  try {
    const { data } = await axios.get(`${API_BASE}/markdown/files`)
    if (data.success) {
      fileTree.value = data.data
    }
  } catch (err) {
    ElMessage.error('加载文件列表失败')
  }
}

const handleCreateCommand = (command) => {
  createType.value = command
  newFileForm.value = { name: '', folder: '' }
  showCreateDialog.value = true
}

const handleNodeClick = (node, e) => {
  if (e.ctrlKey || e.metaKey) {
    // Ctrl/Cmd + 点击：切换选择
    if (selectedFiles.value.has(node.path)) {
      selectedFiles.value.delete(node.path)
    } else {
      selectedFiles.value.add(node.path)
    }
    selectedFiles.value = new Set(selectedFiles.value)
  } else {
    // 普通点击：单选
    selectedFiles.value.clear()
    selectedFiles.value.add(node.path)
    selectedFiles.value = new Set(selectedFiles.value)
  }
}

const handleNodeDblClick = async (node) => {
  if (node.isDirectory) return
  
  // 如果当前有未保存的更改，提示保存
  if (currentFile.value && hasUnsavedChanges()) {
    try {
      await ElMessageBox.confirm('当前文件有未保存的更改，是否继续？', '提示', {
        type: 'warning'
      })
    } catch {
      return
    }
  }
  
  currentFile.value = node
  try {
    const { data: res } = await axios.get(`${API_BASE}/markdown/file`, {
      params: { path: node.path }
    })
    if (res.success) {
      fileContent.value = res.content
      originalContent.value = res.content
    }
  } catch (err) {
    ElMessage.error('加载文件失败')
  }
}

// 拖拽处理
const handleDragStart = (node, e) => {
  draggingFile.value = node
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('text/plain', node.path)
}

const handleDragEnd = () => {
  draggingFile.value = null
}

const handleNodeDrop = async (targetNode, e) => {
  if (!targetNode.isDirectory || !draggingFile.value) return
  
  const filePath = draggingFile.value.path
  const fileName = filePath.split('/').pop()
  const newPath = `${targetNode.path}/${fileName}`
  
  if (filePath === newPath) return
  
  try {
    await axios.put(`${API_BASE}/markdown/file/move`, {
      oldPath: filePath,
      newPath: newPath
    })
    ElMessage.success('移动成功')
    await loadFileList()
    
    // 如果移动的是当前打开的文件，更新当前文件路径
    if (currentFile.value?.path === filePath) {
      currentFile.value.path = newPath
    }
  } catch (err) {
    ElMessage.error('移动失败')
  }
}

const handleTreeDrop = async (e) => {
  // 拖到根目录
  if (!draggingFile.value) return
  
  const filePath = draggingFile.value.path
  const fileName = filePath.split('/').pop()
  
  // 检查是否已经在根目录
  if (!filePath.includes('/')) return
  
  try {
    await axios.put(`${API_BASE}/markdown/file/move`, {
      oldPath: filePath,
      newPath: fileName
    })
    ElMessage.success('移动成功')
    await loadFileList()
    
    if (currentFile.value?.path === filePath) {
      currentFile.value.path = fileName
    }
  } catch (err) {
    ElMessage.error('移动失败')
  }
}

// 框选处理
const handleContainerMouseDown = (e) => {
  // 只在文件树区域框选，且不是点击在节点上
  if (!treeContainerRef.value?.contains(e.target)) return
  if (e.target.closest('.tree-node')) {
    // 如果点击在节点上，不启动框选
    return
  }
  
  isSelecting.value = true
  const rect = treeContainerRef.value.getBoundingClientRect()
  selectionStart.value = {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
  }
  selectionEnd.value = { ...selectionStart.value }
  
  // 清除之前的选择（如果没有按住Ctrl/Cmd）
  if (!e.ctrlKey && !e.metaKey) {
    selectedFiles.value.clear()
    selectedFiles.value = new Set()
  }
}

const handleContainerMouseMove = (e) => {
  if (!isSelecting.value) return
  
  const rect = treeContainerRef.value.getBoundingClientRect()
  selectionEnd.value = {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
  }
  
  // 计算框选区域内的文件
  updateSelection()
}

const handleContainerMouseUp = () => {
  if (!isSelecting.value) return
  isSelecting.value = false
}

const updateSelection = () => {
  const boxLeft = Math.min(selectionStart.value.x, selectionEnd.value.x)
  const boxTop = Math.min(selectionStart.value.y, selectionEnd.value.y)
  const boxRight = Math.max(selectionStart.value.x, selectionEnd.value.x)
  const boxBottom = Math.max(selectionStart.value.y, selectionEnd.value.y)
  
  // 遍历所有文件节点检查是否在框选区域内
  const checkNodes = (nodes) => {
    for (const node of nodes) {
      if (!node.isDirectory) {
        // 找到对应的DOM元素
        const nodeEl = treeContainerRef.value?.querySelector(`[data-path="${node.path}"]`)
        if (nodeEl) {
          const rect = nodeEl.getBoundingClientRect()
          const containerRect = treeContainerRef.value.getBoundingClientRect()
          const nodeLeft = rect.left - containerRect.left
          const nodeTop = rect.top - containerRect.top
          const nodeRight = nodeLeft + rect.width
          const nodeBottom = nodeTop + rect.height
          
          // 检查是否相交
          if (nodeLeft < boxRight && nodeRight > boxLeft &&
              nodeTop < boxBottom && nodeBottom > boxTop) {
            selectedFiles.value.add(node.path)
          }
        }
      }
      if (node.children) checkNodes(node.children)
    }
  }
  
  checkNodes(fileTree.value)
  selectedFiles.value = new Set(selectedFiles.value)
}

const createItem = async () => {
  const isFolder = createType.value === 'folder'
  let itemName = newFileForm.value.name
  
  if (!isFolder && !itemName.endsWith('.md')) {
    itemName += '.md'
  }
  
  const path = newFileForm.value.folder 
    ? `${newFileForm.value.folder}/${itemName}`
    : itemName
  
  try {
    if (isFolder) {
      await axios.post(`${API_BASE}/markdown/folder`, { path })
    } else {
      await axios.post(`${API_BASE}/markdown/file`, {
        path,
        content: ''
      })
    }
    ElMessage.success('创建成功')
    showCreateDialog.value = false
    newFileForm.value = { name: '', folder: '' }
    await loadFileList()
  } catch (err) {
    ElMessage.error('创建失败')
  }
}

const renameFile = (data) => {
  renameForm.value.oldPath = data.path
  renameForm.value.newName = data.name
  renameForm.value.isDirectory = data.isDirectory
  showRenameDialog.value = true
}

const confirmRename = async () => {
  try {
    const oldPath = renameForm.value.oldPath
    const dir = oldPath.includes('/') ? oldPath.substring(0, oldPath.lastIndexOf('/')) : ''
    const newPath = dir ? `${dir}/${renameForm.value.newName}` : renameForm.value.newName
    
    await axios.put(`${API_BASE}/markdown/file/rename`, {
      oldPath,
      newPath
    })
    ElMessage.success('重命名成功')
    showRenameDialog.value = false
    await loadFileList()
    
    if (currentFile.value?.path === oldPath) {
      currentFile.value = null
      fileContent.value = ''
    }
  } catch (err) {
    ElMessage.error('重命名失败')
  }
}

const deleteFile = async (data) => {
  try {
    await ElMessageBox.confirm(`确定要删除 ${data.name} 吗？`, '提示', {
      type: 'warning'
    })
    await axios.delete(`${API_BASE}/markdown/file`, {
      params: { path: data.path }
    })
    ElMessage.success('删除成功')
    await loadFileList()
    
    if (currentFile.value?.path === data.path) {
      currentFile.value = null
      fileContent.value = ''
    }
  } catch (err) {
    if (err !== 'cancel') ElMessage.error('删除失败')
  }
}

const saveFile = async () => {
  if (!currentFile.value) return
  
  try {
    await axios.post(`${API_BASE}/markdown/file`, {
      path: currentFile.value.path,
      content: fileContent.value
    })
    originalContent.value = fileContent.value
    ElMessage.success('保存成功')
  } catch (err) {
    ElMessage.error('保存失败')
  }
}

// 实时预览
const onEditorInput = () => {
  // 内容变化时自动触发重新渲染（通过computed属性）
  // 这里可以添加防抖保存等功能
}

const handleKeydown = (e) => {
  // Ctrl+S 保存
  if (e.ctrlKey && e.key === 's') {
    e.preventDefault()
    saveFile()
  }
  // Tab 缩进
  if (e.key === 'Tab') {
    e.preventDefault()
    const editor = editorRef.value
    const start = editor.selectionStart
    const end = editor.selectionEnd
    const value = editor.value
    editor.value = value.substring(0, start) + '  ' + value.substring(end)
    fileContent.value = editor.value
    nextTick(() => {
      editor.selectionStart = editor.selectionEnd = start + 2
    })
  }
}

// 粘贴上传图片 - 使用window级别的粘贴监听
const handleWindowPaste = async (e) => {
  // 只有当编辑器有焦点时才处理粘贴
  if (document.activeElement !== editorRef.value) return
  
  const items = e.clipboardData?.items
  if (!items) return
  
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile()
      if (file) {
        await uploadImage(file)
      }
    }
  }
}

const uploadImage = async (file) => {
  const formData = new FormData()
  formData.append('image', file)
  
  try {
    const { data } = await axios.post(`${API_BASE}/upload/markdown-image`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    if (data.success) {
      insertImageMarkdown(data.url)
      ElMessage.success('图片上传成功')
    }
  } catch (err) {
    ElMessage.error('图片上传失败')
  }
}

const insertImageMarkdown = (url) => {
  const editor = editorRef.value
  const start = editor.selectionStart
  const imageMarkdown = `\n![image](${url})\n`
  fileContent.value = fileContent.value.substring(0, start) + imageMarkdown + fileContent.value.substring(start)
  nextTick(() => {
    editor.selectionStart = editor.selectionEnd = start + imageMarkdown.length
    editor.focus()
  })
}

const handleImageSuccess = (response) => {
  if (response.success) {
    insertImageMarkdown(response.url)
    ElMessage.success('图片插入成功')
  } else {
    ElMessage.error(response.message || '图片上传失败')
  }
}

const beforeImageUpload = (file) => {
  const isImage = file.type.startsWith('image/')
  const isLt10M = file.size / 1024 / 1024 < 10

  if (!isImage) {
    ElMessage.error('只能上传图片文件!')
  }
  if (!isLt10M) {
    ElMessage.error('图片大小不能超过 10MB!')
  }
  return isImage && isLt10M
}

const hasUnsavedChanges = () => {
  return fileContent.value !== originalContent.value
}

onMounted(() => {
  loadFileList()
  // 注册全局粘贴事件
  window.addEventListener('paste', handleWindowPaste)
})

// 组件卸载时移除事件监听
import { onUnmounted } from 'vue'
onUnmounted(() => {
  window.removeEventListener('paste', handleWindowPaste)
})
</script>

<style scoped>
.api-docs-container {
  display: flex;
  height: 100%;
  gap: 20px;
  position: relative;
}

.sidebar {
  width: 280px;
  background: var(--el-bg-color, #fff);
  border-radius: 8px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 2px 12px rgba(0,0,0,0.1);
}

.sidebar-header {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.file-tree-container {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.file-tree {
  flex: 1;
  overflow-y: auto;
  position: relative;
}

/* 框选层 */
.selection-box {
  position: absolute;
  border: 1px dashed var(--el-color-primary);
  background: rgba(64, 158, 255, 0.1);
  pointer-events: none;
  z-index: 100;
}

/* 树节点样式 */
.tree-node-wrapper {
  user-select: none;
}

.tree-node {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
}

.tree-node:hover {
  background: var(--el-fill-color);
}

.tree-node.is-selected {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.tree-node.is-dragging {
  opacity: 0.5;
}

.tree-node.is-directory.is-drag-over {
  background: var(--el-color-success-light-9);
  border: 1px dashed var(--el-color-success);
}

.expand-icon {
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: inherit;
}

.folder-icon {
  font-size: 10px;
  color: var(--el-text-color-secondary);
  transition: transform 0.2s;
  cursor: inherit;
}

.folder-icon.expanded {
  transform: rotate(90deg);
}

.node-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
}

.node-actions {
  display: none;
  gap: 4px;
  cursor: pointer;
}

.tree-node:hover .node-actions {
  display: flex;
}

.action-btn {
  padding: 2px 4px;
  border-radius: 4px;
  cursor: inherit;
  font-size: 12px;
  opacity: 0.6;
  transition: opacity 0.2s;
}

.action-btn:hover {
  opacity: 1;
  background: var(--el-fill-color-darker);
}

.action-btn.delete:hover {
  color: var(--el-color-danger);
}

.tree-children {
  position: relative;
}

.editor-wrapper {
  flex: 1;
  background: var(--el-bg-color, #fff);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 2px 12px rgba(0,0,0,0.1);
  overflow: hidden;
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--el-border-color-light);
  background: var(--el-fill-color-light);
}

.file-path {
  font-family: monospace;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.editor-actions {
  display: flex;
  gap: 8px;
}

.editor-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.editor-pane {
  flex: 0 0 50%;
  display: flex;
  flex-direction: column;
  padding: 16px;
  overflow: hidden;
  border-right: 1px solid var(--el-border-color-light);
}

.markdown-editor {
  flex: 1;
  width: 100%;
  padding: 12px;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  resize: none;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 14px;
  line-height: 1.6;
  background: var(--el-bg-color);
  color: var(--el-text-color-primary);
  outline: none;
}

.markdown-editor:focus {
  border-color: var(--el-color-primary);
}

.upload-area {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--el-border-color-light);
}

.upload-tip {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.preview-pane {
  flex: 0 0 50%;
  padding: 16px;
  overflow-y: auto;
  background: var(--el-fill-color-light);
}

.preview-pane :deep(h1) { font-size: 2em; margin-bottom: 0.5em; border-bottom: 2px solid var(--el-border-color); padding-bottom: 0.3em; }
.preview-pane :deep(h2) { font-size: 1.5em; margin: 1em 0 0.5em; border-bottom: 1px solid var(--el-border-color-light); padding-bottom: 0.3em; }
.preview-pane :deep(h3) { font-size: 1.25em; margin: 1em 0 0.5em; }
.preview-pane :deep(h4) { font-size: 1.1em; margin: 1em 0 0.5em; }
.preview-pane :deep(p) { margin: 0.5em 0; line-height: 1.6; }
.preview-pane :deep(code) { background: var(--el-fill-color); padding: 2px 6px; border-radius: 3px; font-family: monospace; }
.preview-pane :deep(pre) { background: #1e1e1e; padding: 16px; border-radius: 8px; overflow-x: auto; margin: 1em 0; }
.preview-pane :deep(pre code) { background: transparent; padding: 0; color: #d4d4d4; }
.preview-pane :deep(ul, ol) { margin: 0.5em 0; padding-left: 2em; }
.preview-pane :deep(li) { margin: 0.3em 0; }
.preview-pane :deep(img) { max-width: 100%; border-radius: 4px; margin: 0.5em 0; }
.preview-pane :deep(blockquote) { border-left: 4px solid var(--el-color-primary); padding-left: 1em; margin: 1em 0; color: var(--el-text-color-secondary); background: var(--el-fill-color); padding: 0.5em 1em; border-radius: 4px; }
.preview-pane :deep(table) { border-collapse: collapse; width: 100%; margin: 1em 0; }
.preview-pane :deep(th, td) { border: 1px solid var(--el-border-color); padding: 8px 12px; }
.preview-pane :deep(th) { background: var(--el-fill-color); }
.preview-pane :deep(hr) { border: none; border-top: 1px solid var(--el-border-color); margin: 1em 0; }
.preview-pane :deep(a) { color: var(--el-color-primary); }
.preview-pane :deep(strong) { font-weight: 600; }
.preview-pane :deep(em) { font-style: italic; }

.empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--el-bg-color, #fff);
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.1);
}
</style>
