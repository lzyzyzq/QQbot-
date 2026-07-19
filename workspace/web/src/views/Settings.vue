<template>
  <div class="settings-page">
    <h2>系统设置</h2>

    <el-card style="margin-top: 20px">
      <template #header>超级主人</template>
      <div v-if="superMaster">
        <p><strong>用户ID：</strong>{{ superMaster.id || '未知' }}</p>
        <p v-if="superMaster.added_at"><strong>设置时间：</strong>{{ superMaster.added_at }}</p>
      </div>
      <el-form :model="superForm" label-width="80px" style="margin-top:12px">
        <el-form-item label="用户ID">
          <el-input v-model="superForm.qqId" placeholder="输入用户的OpenID设置超级主人" style="width:320px" />
          <el-button type="primary" @click="saveSuper" :loading="savingSuper" style="margin-left:8px">
            {{ superMaster ? '更换' : '设置' }}
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card style="margin-top: 20px">
      <template #header>副主人列表</template>
      <el-table :data="miniMasters" style="width: 100%" size="small">
        <el-table-column prop="qqId" label="QQ号" />
        <el-table-column prop="id" label="ID" show-overflow-tooltip />
        <el-table-column label="来源" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.source === 'auth_code'" type="success" size="small">授权码</el-tag>
            <el-tag v-else type="info" size="small">直接任命</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="auth_code" label="授权码" width="100" />
        <el-table-column label="过期" width="100">
          <template #default="{ row }">
            <span v-if="row.is_permanent">永久</span>
            <span v-else-if="row.expires_at">{{ formatTime(row.expires_at) }}</span>
            <span v-else>--</span>
          </template>
        </el-table-column>
        <el-table-column label="添加时间" width="170">
          <template #default="{ row }">{{ row.added_at || '--' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="80">
          <template #default="{ row }">
            <el-popconfirm title="确认移除此副主人？" @confirm="removeMini(row.id)">
              <template #reference>
                <el-button type="danger" size="small" link>移除</el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>
      <div v-if="miniMasters.length === 0" style="color: #909399; padding: 20px 0; text-align: center">
        暂无副主人
      </div>
    </el-card>

    <el-card style="margin-top: 20px">
      <template #header>时间偏移设置</template>
      <el-form label-width="120px" :inline="true">
        <el-form-item label="时间偏移(分钟)">
          <el-input-number v-model="timeOffset" :min="-1440" :max="1440" :step="1" style="width:180px" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="saveTimeOffset" :loading="savingTime">保存</el-button>
          <el-button @click="resetTimeOffset" :loading="savingTime">重置</el-button>
        </el-form-item>
      </el-form>
      <el-alert
        v-if="timeLabel"
        :title="'当前: ' + timeLabel"
        type="info"
        :closable="false"
        show-icon
        style="margin-top:8px"
      />
      <div style="color:#909399;font-size:12px;margin-top:8px">
        正数=调快时间, 负数=调慢时间。或群/私聊发送「修改时间 +30分钟」
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useBotStore } from '@/stores/bot'
import { api } from '@/api'
import { ElMessage } from 'element-plus'

const botStore = useBotStore()
const superMaster = ref<any>(null)
const miniMasters = ref<any[]>([])
const timeOffset = ref(0)
const timeLabel = ref('')
const savingTime = ref(false)
const superForm = ref({ qqId: '' })
const savingSuper = ref(false)

function formatTime(t: string) {
  if (!t) return '--'
  return new Date(t).toLocaleString('zh-CN')
}

async function loadMasters() {
  try {
    const data: any = await api.get('/bot/status')
    superMaster.value = data.super_master_id || null
    miniMasters.value = data.mini_masters || []
  } catch {}
}

async function loadTimeOffset() {
  try {
    const data: any = await api.get('/time-offset')
    timeOffset.value = data.offset || 0
    timeLabel.value = data.label || ''
  } catch {}
}

async function removeMini(id: string) {
  try {
    await api.delete(`/masters/mini/${id}`)
    ElMessage.success('已移除')
    loadMasters()
  } catch (e: any) {
    ElMessage.error(e.response?.data?.error || '移除失败')
  }
}

async function saveTimeOffset() {
  savingTime.value = true
  try {
    const data: any = await api.put('/time-offset', { offset: timeOffset.value })
    timeLabel.value = data.label
    ElMessage.success('时间偏移已保存')
  } catch (e: any) {
    ElMessage.error(e.response?.data?.error || '保存失败')
  }
  savingTime.value = false
}

async function resetTimeOffset() {
  timeOffset.value = 0
  saveTimeOffset()
}

async function saveSuper() {
  const qqId = superForm.value.qqId.trim()
  if (!qqId) {
    ElMessage.warning('请输入QQ号')
    return
  }
  savingSuper.value = true
  try {
    const data: any = await api.put('/masters/super', { qqId })
    superMaster.value = data.super_master_id
    ElMessage.success('超级主人已更新')
  } catch (e: any) {
    ElMessage.error(e.response?.data?.error || '设置失败')
  }
  savingSuper.value = false
}

onMounted(() => {
  loadMasters()
  loadTimeOffset()
})
</script>

<style scoped>
.settings-page h2 {
  margin-bottom: 10px;
  font-size: 24px;
}
</style>
