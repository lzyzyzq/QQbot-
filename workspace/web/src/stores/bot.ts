import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/api'

export const useBotStore = defineStore('bot', () => {
  const status = ref('stopped')
  const config = ref<any>(null)
  let pollingTimer: ReturnType<typeof setInterval> | null = null

  async function fetchStatus() {
    try {
      const res: any = await api.get('/bot/status')
      status.value = String(res.status)
      config.value = res.config
    } catch {
      // ignore
    }
  }

  async function startBot() {
    const res: any = await api.post('/bot/start')
    status.value = String(res.status)
    return res
  }

  async function stopBot() {
    const res: any = await api.post('/bot/stop')
    status.value = String(res.status)
    return res
  }

  async function restartBot() {
    const res: any = await api.post('/bot/restart')
    status.value = String(res.status)
    return res
  }

  async function saveConfig(configData: any) {
    return api.put('/bot/config', configData)
  }

  function startPolling() {
    fetchStatus()
    pollingTimer = setInterval(fetchStatus, 5000)
  }

  function stopPolling() {
    if (pollingTimer) {
      clearInterval(pollingTimer)
      pollingTimer = null
    }
  }

  return { status, config, fetchStatus, startBot, stopBot, restartBot, saveConfig, startPolling, stopPolling }
})
