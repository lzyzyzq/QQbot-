<template>
  <div class="trash-page">
    <h2>回收站</h2>
    <p style="color: #909399; margin-bottom: 12px;">
      删除的文件保留2天，过期自动清理
      <el-button size="small" type="danger" style="float: right" @click="emptyTrash" :loading="emptying">清空回收站</el-button>
    </p>

    <el-table :data="items" stripe v-loading="loading" empty-text="回收站为空">
      <el-table-column label="名称" prop="name" />
      <el-table-column label="类型" width="80">
        <template #default="{ row }">
          <el-tag :type="row.isDir ? 'warning' : ''" size="small">{{ row.isDir ? '目录' : '文件' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="原路径" prop="originalPath" :show-overflow-tooltip="true" />
      <el-table-column label="删除时间" width="180">
        <template #default="{ row }">{{ formatTime(row.deletedAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="180">
        <template #default="{ row }">
          <el-button size="small" type="primary" @click="restore(row)">恢复</el-button>
          <el-popconfirm title="确认永久删除?" @confirm="permanentDelete(row)">
            <template #reference><el-button size="small" type="danger">永久删除</el-button></template>
          </el-popconfirm>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { api } from '@/api'
import { ElMessage } from 'element-plus'

interface TrashItem {
  id: string
  name: string
  originalPath: string
  isDir: boolean
  deletedAt: string
}

const items = ref<TrashItem[]>([])
const loading = ref(false)
const emptying = ref(false)

onMounted(() => loadTrash())

async function loadTrash() {
  loading.value = true
  try {
    const data: any = await api.get('/trash')
    items.value = data.items || []
  } catch { ElMessage.error('加载失败') }
  loading.value = false
}

async function restore(row: TrashItem) {
  try {
    await api.post('/trash/restore', { id: row.id })
    ElMessage.success('已恢复')
    loadTrash()
  } catch (e: any) { ElMessage.error(e?.response?.data?.error || '恢复失败') }
}

async function permanentDelete(row: TrashItem) {
  try {
    await api.delete('/trash', { params: { id: row.id } })
    ElMessage.success('已永久删除')
    loadTrash()
  } catch { ElMessage.error('删除失败') }
}

async function emptyTrash() {
  emptying.value = true
  try {
    await api.delete('/trash')
    ElMessage.success('回收站已清空')
    loadTrash()
  } catch { ElMessage.error('清空失败') }
  emptying.value = false
}

function formatTime(t: string) {
  return new Date(t).toLocaleString('zh-CN')
}
</script>
