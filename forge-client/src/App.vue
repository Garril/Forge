<template>
  <router-view></router-view>
</template>

<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useSettingsStore } from './store/settings'

const router = useRouter()
const settingsStore = useSettingsStore()

onMounted(async () => {
  // 监听锁屏快捷键
  if (window.electronAPI) {
    window.electronAPI.onLockScreen(() => {
      // 如果当前已经在锁屏页面，不再重复锁屏
      const currentPath = router.currentRoute.value.path
      if (currentPath === '/') {
        return
      }
      // 执行锁屏逻辑，跳回根路径，并带上当前路径
      router.push({
        path: '/',
        query: { redirect: router.currentRoute.value.fullPath }
      })
    })
  }

  // 加载全局配置
  await settingsStore.loadSettings()
})
</script>

<style>
/* 全局样式覆盖 */
body, html {
  margin: 0;
  padding: 0;
  height: 100%;
  font-family: "Helvetica Neue", Helvetica, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "微软雅黑", Arial, sans-serif;
  overflow: hidden; /* 防止全局滚动条，使用内部滚动 */
  background-color: var(--el-bg-color-page, #f0f2f5);
  color: var(--el-text-color-primary, #303133);
}

#app {
  height: 100%;
}

/* 全局 cursor 样式优化 - 避免频繁切换 */

/* 表格行统一 cursor */
.el-table .el-table__body tr {
  cursor: default;
}

.el-table .el-table__body tr:hover > td {
  cursor: inherit;
}

/* 表格中的可点击元素继承 cursor */
.el-table .cell > * {
  cursor: inherit;
}

/* 日历单元格统一 cursor */
.el-calendar-table td {
  cursor: default;
}

.el-calendar-table td .el-calendar-day {
  cursor: inherit;
}

/* 按钮保持 pointer */
.el-button,
button {
  cursor: pointer !important;
}

/* 链接保持 pointer */
a,
.el-link {
  cursor: pointer !important;
}

/* 输入框保持 text cursor */
input,
textarea,
.el-input__inner,
.el-textarea__inner {
  cursor: text !important;
}

/* 禁用状态的统一处理 */
[disabled],
.is-disabled {
  cursor: not-allowed !important;
}
</style>
