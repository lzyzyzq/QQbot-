<template>
  <div class="dashboard">
    <h2>仪表盘</h2>

    <el-row :gutter="20" style="margin-top: 20px">
      <el-col :xs="24" :sm="12" :md="8">
        <el-card shadow="hover">
          <template #header>机器人状态</template>
          <div class="status-card">
            <el-tag :type="statusType" size="large">{{ statusLabel }}</el-tag>
            <div class="status-actions" style="margin-top: 16px">
              <el-button
                v-if="botStore.status === 'stopped' || botStore.status === 'error'"
                type="primary"
                @click="handleStart"
                :loading="loading"
              >
                启动机器人
              </el-button>
              <template v-if="botStore.status === 'connected'">
                <el-button type="warning" @click="handleRestart" :loading="restarting">
                  <el-icon><Refresh /></el-icon>
                  重启机器人
                </el-button>
                <el-button type="danger" @click="handleStop" :loading="loading">
                  停止机器人
                </el-button>
              </template>
            </div>
          </div>
        </el-card>
      </el-col>

      <el-col :xs="24" :sm="12" :md="8">
        <el-card shadow="hover">
          <template #header>连接信息</template>
          <div class="info-card">
            <p><strong>AppID：</strong>{{ botStore.config?.appId || '未配置' }}</p>
            <p><strong>服务端口：</strong>3000</p>
            <p><strong>时间偏移：</strong>{{ timeOffsetLabel }}</p>
            <p><strong>运行时间：</strong>{{ uptime }}</p>
          </div>
        </el-card>
      </el-col>

      <el-col :xs="24" :sm="12" :md="8">
        <el-card shadow="hover">
          <template #header>快速操作</template>
          <div class="quick-actions">
            <el-button type="primary" @click="$router.push('/plugins')">管理插件</el-button>
            <el-button @click="$router.push('/settings')">系统设置</el-button>
            <el-button @click="$router.push('/logs')">查看日志</el-button>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useBotStore } from '@/stores/bot'
import { api } from '@/api'
import { ElMessage } from 'element-plus'

const botStore = useBotStore()
const loading = ref(false)
const restarting = ref(false)
const uptime = ref('')
const timeOffsetLabel = ref('')
let uptimeTimer: any = null

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const parts: string[] = []
  if (d > 0) parts.push(d + '天')
  if (h > 0) parts.push(h + '小时')
  if (m > 0) parts.push(m + '分')
  parts.push(s + '秒')
  return parts.join(' ')
}

async function fetchUptime() {
  try {
    const data: any = await api.get('/health')
    uptime.value = formatUptime(data.uptime || 0)
  } catch { uptime.value = '--' }
}

async function fetchTimeOffset() {
  try {
    const data: any = await api.get('/time-offset')
    timeOffsetLabel.value = data.label || '未设置'
  } catch { timeOffsetLabel.value = '--' }
}

onMounted(() => {
  fetchUptime()
  fetchTimeOffset()
  uptimeTimer = setInterval(() => { fetchUptime(); fetchTimeOffset(); }, 10000)
})

onUnmounted(() => {
  if (uptimeTimer) clearInterval(uptimeTimer)
})

const statusType = computed(() => {
  const map: Record<string, string> = {
    stopped: 'info',
    connecting: 'warning',
    connected: 'success',
    error: 'danger',
  }
  return map[botStore.status] || 'info'
})

const statusLabel = computed(() => {
  const map: Record<string, string> = {
    stopped: '未连接',
    connecting: '连接中...',
    connected: '已连接',
    error: '发生错误',
  }
  return map[botStore.status] || botStore.status
})

async function handleStart() {
  loading.value = true
  try {
    await botStore.startBot()
  } catch (e: any) {
    // handled by store
  } finally {
    loading.value = false
  }
}

async function handleStop() {
  loading.value = true
  try {
    await botStore.stopBot()
  } catch (e: any) {
    // handled by store
  } finally {
    loading.value = false
  }
}

async function handleRestart() {
  restarting.value = true
  try {
    await botStore.restartBot()
    ElMessage.success('机器人已重启，所有插件已刷新')
  } catch (e: any) {
    ElMessage.error(e.response?.data?.error || '重启失败')
  } finally {
    restarting.value = false
  }
}
</script>

<style scoped>
.dashboard h2 {
  margin-bottom: 10px;
  font-size: 24px;
}

.status-card, .info-card, .quick-actions {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.info-card p {
  margin: 4px 0;
  font-size: 14px;
}

.quick-actions {
  gap: 10px;
}

.quick-actions .el-button {
  width: 100%;
}

@media (max-width: 768px) {
  .dashboard h2 {
    font-size: 20px;
  }

  .quick-actions {
    width: 100%;
  }

  .info-card p {
    font-size: 13px;
  }
}
</style>
