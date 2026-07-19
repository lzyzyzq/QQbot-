<template>
  <div>
    <div class="logo" @click="$emit('nav')">
      <span v-if="!isCollapse">QQ Bot Platform</span>
      <span v-else>Bot</span>
    </div>
    <el-menu
      :default-active="activeMenu"
      :collapse="isCollapse"
      router
      background-color="#304156"
      text-color="#bfcbd9"
      active-text-color="#409eff"
      @select="$emit('nav')"
    >
      <el-menu-item index="/">
        <el-icon><Monitor /></el-icon>
        <span>仪表盘</span>
      </el-menu-item>
      <el-menu-item index="/plugins">
        <el-icon><Grid /></el-icon>
        <span>插件管理</span>
      </el-menu-item>
      <el-menu-item index="/settings">
        <el-icon><Setting /></el-icon>
        <span>设置</span>
      </el-menu-item>
      <el-menu-item index="/logs">
        <el-icon><Document /></el-icon>
        <span>日志</span>
      </el-menu-item>
      <el-menu-item index="/auth-codes">
        <el-icon><Key /></el-icon>
        <span>授权码</span>
      </el-menu-item>
      <el-menu-item index="/files">
        <el-icon><FolderOpened /></el-icon>
        <span>文件管理</span>
      </el-menu-item>
      <el-menu-item index="/groups">
        <el-icon><ChatDotRound /></el-icon>
        <span>群聊管理</span>
      </el-menu-item>
      <el-menu-item index="/trash">
        <el-icon><Delete /></el-icon>
        <span>回收站</span>
      </el-menu-item>
    </el-menu>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

defineProps<{ isCollapse: boolean }>()
defineEmits<{ nav: [] }>()

const route = useRoute()
const activeMenu = computed(() => route.path)
</script>

<style scoped>
.logo {
  height: 60px;
  line-height: 60px;
  text-align: center;
  color: #fff;
  font-size: 18px;
  font-weight: bold;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
}
</style>
