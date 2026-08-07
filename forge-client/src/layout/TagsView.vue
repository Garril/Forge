<template>
  <div class="tags-view-container">
    <el-scrollbar wrap-class="tags-view-wrapper" :vertical="false">
      <router-link
        v-for="tag in tagsViewStore.visitedViews"
        :key="tag.path"
        :to="tag.path"
        class="tags-view-item"
        :class="isActive(tag) ? 'active' : ''"
      >
        {{ tag.title }}
        <el-icon 
          class="el-icon-close" 
          @click.prevent.stop="closeSelectedTag(tag)"
        ><Close /></el-icon>
      </router-link>
    </el-scrollbar>
  </div>
</template>

<script setup>
import { watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Close } from '@element-plus/icons-vue'
import { useTagsViewStore } from '../store/tagsView'

const route = useRoute()
const router = useRouter()
const tagsViewStore = useTagsViewStore()

const isActive = (tag) => {
  return tag.path === route.path
}

const addView = () => {
  tagsViewStore.addView(route)
}

const closeSelectedTag = (view) => {
  const canClose = tagsViewStore.delView(view)
  if (!canClose) {
    return // 不能关闭最后一个标签
  }
  if (isActive(view)) {
    const latestView = tagsViewStore.visitedViews.slice(-1)[0]
    if (latestView) {
      router.push(latestView.path)
    }
  }
}

// 关闭当前标签
const closeCurrentTag = () => {
  const currentView = tagsViewStore.visitedViews.find(v => v.path === route.path)
  if (currentView) {
    closeSelectedTag(currentView)
  }
}

// 键盘事件监听
const handleKeydown = (e) => {
  // Ctrl+W 关闭当前标签
  if (e.ctrlKey && e.key === 'w') {
    e.preventDefault()
    closeCurrentTag()
  }
}

watch(() => route.path, () => {
  addView()
})

onMounted(() => {
  addView()
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
.tags-view-container {
  height: 34px;
  width: 100%;
  background: #fff;
  border-bottom: 1px solid #d8dce5;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, .12), 0 0 3px 0 rgba(0, 0, 0, .04);
}
.tags-view-wrapper {
  padding: 0 10px;
}
.tags-view-item {
  display: inline-flex;
  align-items: center;
  position: relative;
  cursor: pointer;
  height: 26px;
  line-height: 26px;
  border: 1px solid #d8dce5;
  color: #495060;
  background: #fff;
  padding: 0 8px;
  font-size: 12px;
  margin-left: 5px;
  margin-top: 4px;
  text-decoration: none;
  border-radius: 2px;
}
.tags-view-item.active {
  background-color: #409EFF;
  color: #fff;
  border-color: #409EFF;
}
.tags-view-item.active::before {
  content: '';
  background: #fff;
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  position: relative;
  margin-right: 5px;
}
.el-icon-close {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  text-align: center;
  transition: all .3s cubic-bezier(.645, .045, .355, 1);
  transform-origin: 100% 50%;
  margin-left: 4px;
}
.el-icon-close:hover {
  background-color: #b4bccc;
  color: #fff;
}
</style>