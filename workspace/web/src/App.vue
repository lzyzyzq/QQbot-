<template>
  <div id="app-container">
    <el-container v-if="authStore.isAuthenticated">
      <el-aside
        v-if="!isMobile"
        :width="isCollapse ? '64px' : '220px'"
        class="sidebar"
      >
        <SidebarContent :is-collapse="isCollapse" />
      </el-aside>

      <el-drawer
        v-model="drawerVisible"
        direction="ltr"
        size="220px"
        :show-close="false"
        :with-header="false"
        class="mobile-drawer"
      >
        <SidebarContent :is-collapse="false" @nav="drawerVisible = false" />
      </el-drawer>

      <el-container>
        <el-header class="header">
          <div class="header-left">
            <el-button v-if="isMobile" @click="drawerVisible = true" text>
              <el-icon :size="22"><Expand /></el-icon>
            </el-button>
            <el-button v-else @click="isCollapse = !isCollapse" text>
              <el-icon :size="20"><Fold v-if="!isCollapse" /><Expand v-else /></el-icon>
            </el-button>
          </div>
          <div class="header-right">
            <el-tag :type="statusTagType" size="small">{{ statusText }}</el-tag>
            <el-button text @click="authStore.logout" style="margin-left: 12px">
              <el-icon><SwitchButton /></el-icon>
            </el-button>
          </div>
        </el-header>
        <el-main>
          <router-view />
        </el-main>
      </el-container>
    </el-container>
    <div v-else class="login-wrapper">
      <router-view />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useBotStore } from '@/stores/bot'
import SidebarContent from '@/components/SidebarContent.vue'

const route = useRoute()
const authStore = useAuthStore()
const botStore = useBotStore()
const isCollapse = ref(false)
const drawerVisible = ref(false)
const isMobile = ref(false)

const activeMenu = computed(() => route.path)

const statusText = computed(() => {
  const map: Record<string, string> = {
    stopped: '未连接',
    connecting: '连接中',
    connected: '已连接',
    error: '错误',
  }
  return map[botStore.status] || botStore.status
})

const statusTagType = computed(() => {
  const map: Record<string, string> = {
    stopped: 'info',
    connecting: 'warning',
    connected: 'success',
    error: 'danger',
  }
  return map[botStore.status] || 'info'
})

function checkMobile() {
  isMobile.value = window.innerWidth < 768
}

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', checkMobile)
})

botStore.startPolling()
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #app, #app-container {
  height: 100%;
  width: 100%;
}

#app-container {
  display: flex;
}

.sidebar {
  background-color: #304156;
  min-height: 100vh;
  overflow-x: hidden;
  transition: width 0.3s;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fff;
  border-bottom: 1px solid #e6e6e6;
  padding: 0 16px;
  height: 60px;
}

.header-left, .header-right {
  display: flex;
  align-items: center;
}

.login-wrapper {
  width: 100%;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f0f2f5;
}

.el-main {
  background: #f0f2f5;
  min-height: calc(100vh - 60px);
  padding: 16px;
}

.mobile-drawer .el-drawer__body {
  padding: 0;
}
</style>
