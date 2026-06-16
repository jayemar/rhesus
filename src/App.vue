<template>
  <RouterView />
</template>

<script setup lang="ts">
import { watch } from 'vue'
import { RouterView, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()
const { isAuthenticated } = storeToRefs(auth)

watch(isAuthenticated, (val, prev) => {
  if (prev === true && val === false) router.replace('/login')
})
</script>
