<template>
  <div class="plugins-page">
    <div class="page-header">
      <h2>插件管理</h2>
      <el-button type="primary" @click="createPlugin">
        <el-icon><Plus /></el-icon>
        <span class="btn-text">创建插件</span>
      </el-button>
      <input ref="zipInputEl" type="file" accept=".zip" style="display:none" @change="onZipSelected" />
      <el-button type="success" @click="zipInputEl?.click()">
        <el-icon><Upload /></el-icon>
        <span class="btn-text">上传ZIP插件</span>
      </el-button>
    </div>

    <el-table
      v-if="!isMobile"
      :data="plugins"
      style="width: 100%; margin-top: 20px"
      v-loading="loading"
      stripe
    >
      <el-table-column prop="name" label="插件名称" min-width="120" />
      <el-table-column prop="version" label="版本" width="80" />
      <el-table-column prop="description" label="描述" min-width="180" show-overflow-tooltip />
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-tag :type="row.enabled ? 'success' : 'info'" size="small">
            {{ row.enabled ? '已启用' : '已禁用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="280" fixed="right">
        <template #default="{ row }">
          <el-button size="small" @click="editPlugin(row)">编辑</el-button>
          <el-button size="small" v-if="row.has_webui" type="primary" @click="openSettings(row)">设置</el-button>
          <el-button
            size="small"
            :type="row.enabled ? 'warning' : 'success'"
            @click="togglePlugin(row)"
          >{{ row.enabled ? '停用' : '启用' }}</el-button>
          <el-popconfirm title="确定删除?" @confirm="deletePlugin(row)">
            <template #reference>
              <el-button size="small" type="danger">删除</el-button>
            </template>
          </el-popconfirm>
        </template>
      </el-table-column>
    </el-table>

    <div v-else class="plugin-cards" v-loading="loading">
      <el-card v-for="item in plugins" :key="item.id" class="plugin-card" shadow="hover">
        <div class="card-header">
          <span class="card-name">{{ item.name }}</span>
          <el-tag :type="item.enabled ? 'success' : 'info'" size="small">
            {{ item.enabled ? '已启用' : '已禁用' }}
          </el-tag>
        </div>
        <div class="card-desc">{{ item.description }}</div>
        <div class="card-meta">v{{ item.version }}</div>
        <div class="card-actions">
          <el-button size="small" @click="editPlugin(item)">编辑</el-button>
          <el-button size="small" v-if="item.has_webui" type="primary" @click="openSettings(item)">设置</el-button>
          <el-button size="small" :type="item.enabled ? 'warning' : 'success'" @click="togglePlugin(item)">
            {{ item.enabled ? '停用' : '启用' }}
          </el-button>
          <el-popconfirm title="确定删除?" @confirm="deletePlugin(item)">
            <template #reference>
              <el-button size="small" type="danger">删除</el-button>
            </template>
          </el-popconfirm>
        </div>
      </el-card>
    </div>

    <el-empty v-if="!loading && plugins.length === 0" description="暂无插件，点击上方按钮创建" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '@/api'
import { ElMessage } from 'element-plus'

const router = useRouter()
const plugins = ref<any[]>([])
const loading = ref(false)
const isMobile = ref(false)
const zipInputEl = ref<HTMLInputElement | null>(null)

function checkMobile() {
  isMobile.value = window.innerWidth < 768
}

async function fetchPlugins() {
  loading.value = true
  try {
    const res: any = await api.get('/plugins')
    plugins.value = Array.isArray(res) ? res : []
  } catch {
    // ignore
  } finally {
    loading.value = false
  }
}

function createPlugin() {
  router.push('/plugins/new')
}

function editPlugin(row: any) {
  router.push(`/plugins/${row.id}`)
}

async function togglePlugin(row: any) {
  try {
    const res: any = await api.post(`/plugins/${row.id}/toggle`)
    row.enabled = (res as any).enabled
    ElMessage.success((res as any).message || '操作成功')
  } catch (e: any) {
    ElMessage.error(e.response?.data?.error || '操作失败')
  }
}

function openSettings(row: any) {
  window.open('/api/plugins/' + row.id + '/webui', '_blank')
}

async function onZipSelected(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  const formData = new FormData()
  formData.append('file', file)

  loading.value = true
  try {
    const data: any = await api.post('/plugins/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    ElMessage.success('插件上传成功')
    fetchPlugins()
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.error || '上传失败')
  } finally {
    loading.value = false
    input.value = ''
  }
}

async function deletePlugin(row: any) {
  try {
    await api.delete(`/plugins/${row.id}`)
    ElMessage.success('插件已删除')
    fetchPlugins()
  } catch (e: any) {
    ElMessage.error(e.response?.data?.error || '删除失败')
  }
}

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
  fetchPlugins()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', checkMobile)
})
</script>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.page-header h2 {
  font-size: 20px;
}

.btn-text {
  margin-left: 4px;
}

.plugin-cards {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.plugin-card {
  border-radius: 8px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.card-name {
  font-weight: 600;
  font-size: 15px;
}

.card-desc {
  font-size: 13px;
  color: #666;
  margin-bottom: 6px;
}

.card-meta {
  font-size: 12px;
  color: #999;
  margin-bottom: 10px;
}

.card-actions {
  display: flex;
  gap: 8px;
}

@media (max-width: 768px) {
  .page-header {
    flex-wrap: wrap;
    gap: 10px;
  }
}
</style>
