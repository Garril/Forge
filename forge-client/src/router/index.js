import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'LockScreen',
    component: () => import('../views/Settings/LockScreen.vue')
  },
  {
    path: '/dashboard',
    name: 'Layout',
    component: () => import('../layout/index.vue'),
    redirect: '/dashboard/plan',
    children: [
      {
        path: 'plan',
        name: 'Plan',
        component: () => import('../views/Plan/index.vue'),
        meta: { title: '日常规划' }
      },
      {
        path: 'video-notes',
        name: 'VideoNotes',
        component: () => import('../views/VideoNotes/index.vue'),
        meta: { title: '视频笔记' }
      },
      {
        path: 'board-analysis',
        name: 'BoardAnalysis',
        component: () => import('../views/BoardAnalysis/index.vue'),
        meta: { title: '盘面分析' }
      },
      {
        path: 'settings',
        name: 'Settings',
        component: () => import('../views/Settings/index.vue'),
        meta: { title: '系统设置' }
      },
    ]
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
