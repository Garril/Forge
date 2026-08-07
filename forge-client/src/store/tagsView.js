import { defineStore } from 'pinia'

// 清理旧版本残留的 localStorage 数据
try {
  localStorage.removeItem('forge_tags_view')
} catch (e) {
  // ignore
}

export const useTagsViewStore = defineStore('tagsView', {
  state: () => ({
    visitedViews: []
  }),
  actions: {
    addView(view) {
      if (view.name && view.name !== 'Layout' && view.name !== 'LockScreen') {
        const isExist = this.visitedViews.some(v => v.path === view.path)
        if (!isExist) {
          this.visitedViews.push({
            path: view.path,
            name: view.name,
            title: view.meta.title || 'Unknown'
          })
        }
      }
    },
    delView(view) {
      // 至少保留一个标签页
      if (this.visitedViews.length <= 1) {
        return false
      }
      this.visitedViews = this.visitedViews.filter(v => v.path !== view.path)
      return true
    }
  }
})