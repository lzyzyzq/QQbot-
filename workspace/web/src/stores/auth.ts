import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/api'

export const useAuthStore = defineStore('auth', () => {
  const isAuthenticated = ref(!!localStorage.getItem('token'))
  const token = ref(localStorage.getItem('token') || '')

  async function login(password: string) {
    const res: any = await api.post('/auth/login', { password })
    token.value = res.token
    localStorage.setItem('token', res.token)
    isAuthenticated.value = true
    return res
  }

  async function checkStatus() {
    try {
      await api.get('/auth/status')
    } catch {
      logout()
    }
  }

  function logout() {
    token.value = ''
    localStorage.removeItem('token')
    isAuthenticated.value = false
  }

  return { isAuthenticated, token, login, checkStatus, logout }
})
