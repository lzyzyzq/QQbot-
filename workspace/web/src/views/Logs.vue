<template>
  <div class="logs-page">
    <div class="page-header">
      <h2>系统日志</h2>
      <div class="log-controls">
        <el-select v-model="levelFilter" placeholder="日志级别" clearable style="width: 130px; margin-right: 10px">
          <el-option label="全部" value="" />
          <el-option label="ERROR" value="error" />
          <el-option label="WARN" value="warn" />
          <el-option label="INFO" value="info" />
          <el-option label="DEBUG" value="debug" />
        </el-select>
        <el-button @click="fetchLogs" :loading="loading">刷新</el-button>
        <el-popconfirm title="确定清空所有日志文件?" @confirm="clearLogs">
          <template #reference>
            <el-button type="danger" :loading="clearing">清空日志</el-button>
          </template>
        </el-popconfirm>
      </div>
    </div>

    <el-card style="margin-top: 20px">
      <div class="log-list">
        <div v-for="(log, index) in logs" :key="index" class="log-item" :class="'log-' + log.level">
          <span class="log-time">{{ log.timestamp }}</span>
          <span class="log-level">{{ levelBadge(log.level) }}</span>
          <span class="log-module">[{{ log.module }}]</span>
          <span class="log-msg">{{ log.message }}</span>
        </div>
        <el-empty v-if="!loading && logs.length === 0" description="暂无日志" />
      </div>

      <div class="log-pagination" v-if="total > 0">
        <el-pagination
          v-model:current-page="currentPage"
          :page-size="pageSize"
          :total="total"
          layout="prev, pager, next"
          @current-change="fetchLogs"
          small
        />
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { api } from '@/api'
import { ElMessage } from 'element-plus'

const logs = ref<any[]>([])
const loading = ref(false)
const clearing = ref(false)
const total = ref(0)
const currentPage = ref(1)
const pageSize = 20
const levelFilter = ref('')

function levelBadge(level: string): string {
  const map: Record<string, string> = { error: '错误', warn: '警告', info: '信息', debug: '调试' }
  return map[level] || level.toUpperCase()
}

async function fetchLogs() {
  loading.value = true
  try {
    const offset = (currentPage.value - 1) * pageSize
    const params: any = { limit: pageSize, offset }
    if (levelFilter.value) {
      params.level = levelFilter.value
    }
    const res: any = await api.get('/logs', { params })
    logs.value = res.logs
    total.value = res.total
  } catch {
    // ignore
  } finally {
    loading.value = false
  }
}

async function clearLogs() {
  clearing.value = true
  try {
    const res: any = await api.delete('/logs')
    logs.value = []
    total.value = 0
    ElMessage.success(res?.message || '日志已清空')
  } catch (e: any) {
    ElMessage.error(e.response?.data?.error || '清空失败')
  } finally {
    clearing.value = false
  }
}

watch(levelFilter, () => {
  currentPage.value = 1
  fetchLogs()
})

fetchLogs()
</script>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.page-header h2 {
  font-size: 20px;
}

.log-controls {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.log-list {
  font-family: 'Courier New', monospace;
  font-size: 13px;
  max-height: 60vh;
  overflow-y: auto;
}

.log-item {
  padding: 6px 8px;
  border-left: 3px solid transparent;
  margin-bottom: 2px;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  border-radius: 2px;
}

.log-time {
  color: #909399;
  white-space: nowrap;
  font-size: 12px;
}

.log-level {
  font-weight: bold;
  white-space: nowrap;
  font-size: 12px;
  padding: 1px 6px;
  border-radius: 3px;
}

.log-module {
  color: #409eff;
  white-space: nowrap;
  font-size: 12px;
}

.log-msg {
  word-break: break-all;
  flex: 1;
}

.log-error {
  background: #fef0f0;
  border-left-color: #f56c6c;
}
.log-error .log-level {
  background: #f56c6c;
  color: #fff;
}

.log-warn {
  background: #fdf6ec;
  border-left-color: #e6a23c;
}
.log-warn .log-level {
  background: #e6a23c;
  color: #fff;
}

.log-info {
  background: transparent;
  border-left-color: #67c23a;
}
.log-info .log-level {
  background: #67c23a;
  color: #fff;
}

.log-debug {
  background: transparent;
  border-left-color: #909399;
}
.log-debug .log-level {
  background: #909399;
  color: #fff;
}

.log-pagination {
  margin-top: 16px;
  display: flex;
  justify-content: center;
}

@media (max-width: 768px) {
  .log-list {
    font-size: 12px;
  }

  .log-item {
    padding: 4px 6px;
  }
}
</style>
