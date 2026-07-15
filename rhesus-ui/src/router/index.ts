import { createRouter, createWebHashHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

declare module 'vue-router' {
  interface RouteMeta {
    title?: string
    requiresAuth?: boolean
  }
}

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/components/LoginPage.vue'),
      meta: { title: 'Rhesus' },
    },
    {
      path: '/',
      name: 'home',
      component: () => import('@/components/layout/AppShell.vue'),
      meta: { title: 'Rhesus', requiresAuth: true },
    },
    {
      path: '/feed/:id',
      name: 'feed',
      component: () => import('@/components/layout/AppShell.vue'),
      meta: { title: 'Rhesus', requiresAuth: true },
    },
    {
      path: '/category/:id',
      name: 'category',
      component: () => import('@/components/layout/AppShell.vue'),
      meta: { title: 'Rhesus', requiresAuth: true },
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('@/components/layout/AppShell.vue'),
      meta: { title: 'Rhesus', requiresAuth: true },
    },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  if (auth.isChecking) await auth.init()
  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { name: 'login' }
  }
  if (to.name === 'login' && auth.isAuthenticated) {
    return { name: 'home' }
  }
})

router.afterEach((to) => {
  document.title = to.meta.title ?? 'Rhesus'
})

export default router
