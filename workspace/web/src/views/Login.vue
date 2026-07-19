<template>
  <el-card class="login-card" shadow="always">
    <template #header>
      <div class="login-header">QQ Bot Platform</div>
    </template>
    <el-form @submit.prevent="handleLogin" :model="form" label-width="0">
      <el-form-item>
        <el-input
          v-model="form.password"
          type="password"
          placeholder="管理员密码"
          show-password
          size="large"
        />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" size="large" @click="handleLogin" :loading="loading" style="width: 100%">
          登录
        </el-button>
      </el-form-item>
    </el-form>
    <div v-if="error" class="login-error">{{ error }}</div>
  </el-card>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const form = reactive({ password: '' })
const loading = ref(false)
const error = ref('')

async function handleLogin() {
  if (!form.password) return
  loading.value = true
  error.value = ''
  try {
    await authStore.login(form.password)
    router.push('/')
  } catch (e: any) {
    error.value = e.response?.data?.error || '登录失败'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-card {
  width: 380px;
  max-width: 90vw;
}

.login-header {
  text-align: center;
  font-size: 22px;
  font-weight: bold;
  color: #303133;
}

.login-error {
  color: #f56c6c;
  text-align: center;
  font-size: 14px;
}
</style>
