<template>
  <div class="auth-codes">
    <h2>授权码管理</h2>
    <p style="color: #909399; margin-bottom: 20px;">
      生成授权码后,在QQ群/私聊发送「授权码 XXXXXX」即可成为小主人
    </p>

    <el-card style="margin-bottom: 20px">
      <template #header>生成授权码</template>
      <el-form :inline="true">
        <el-form-item label="有效期">
          <el-select v-model="expiry" placeholder="选择有效期" style="width: 160px">
            <el-option label="30 分钟" value="30" />
            <el-option label="1 小时" value="60" />
            <el-option label="6 小时" value="360" />
            <el-option label="12 小时" value="720" />
            <el-option label="24 小时" value="1440" />
            <el-option label="永久有效" value="0" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="generate" :loading="generating">生成授权码</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card>
      <template #header>授权码列表 ({{ codes.length }})</template>
      <el-table :data="codes" stripe v-if="codes.length > 0">
        <el-table-column prop="code" label="授权码" />
        <el-table-column label="有效期">
          <template #default="{ row }">
            <el-tag v-if="row.is_permanent" type="warning">永久</el-tag>
            <span v-else>{{ formatExpiry(row.expires_at) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态">
          <template #default="{ row }">
            <el-tag v-if="row.used_by" type="info">已使用</el-tag>
            <el-tag v-else type="success">可用</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="used_by" label="使用者" />
        <el-table-column label="操作" width="100">
          <template #default="{ row }">
            <el-popconfirm title="确认撤销此授权码?" @confirm="revoke(row.id)">
              <template #reference>
                <el-button type="danger" size="small" :disabled="!!row.used_by">撤销</el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-else description="暂无授权码" />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { api } from '@/api'
import { ElMessage } from 'element-plus'

interface AuthCode {
  id: string
  code: string
  created_by: string
  expires_at: string | null
  is_permanent: number
  used_by: string | null
  used_at: string | null
  created_at: string
}

const codes = ref<AuthCode[]>([])
const expiry = ref('1440')
const generating = ref(false)

onMounted(() => loadCodes())

async function loadCodes() {
  try {
    const data: any = await api.get('/auth-codes')
    codes.value = data.codes || []
  } catch { ElMessage.error('加载失败') }
}

async function generate() {
  generating.value = true
  try {
    const data: any = await api.post('/auth-codes', {
      expires_in_minutes: expiry.value === '0' ? null : parseInt(expiry.value)
    })
    ElMessage.success(`授权码: ${data.code} (${data.expires_label})`)
    loadCodes()
  } catch { ElMessage.error('生成失败') }
  generating.value = false
}

async function revoke(id: string) {
  try {
    await api.delete(`/auth-codes/${id}`)
    ElMessage.success('已撤销')
    loadCodes()
  } catch { ElMessage.error('撤销失败') }
}

function formatExpiry(exp: string | null) {
  if (!exp) return '永久'
  return new Date(exp).toLocaleString('zh-CN')
}
</script>
