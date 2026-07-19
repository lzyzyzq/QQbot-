<template>
  <div class="plugin-editor">
    <div class="page-header">
      <h2>{{ isNew ? '创建插件' : '编辑插件' }}</h2>
      <div>
        <el-button @click="$router.push('/plugins')">返回</el-button>
        <el-button type="primary" @click="savePlugin" :loading="saving">保存</el-button>
      </div>
    </div>

    <el-form :model="form" label-width="80px" style="margin-top: 20px">
      <el-row :gutter="20">
        <el-col :xs="24" :md="12">
          <el-form-item label="插件名称">
            <el-input v-model="form.name" placeholder="输入插件名称" />
          </el-form-item>
        </el-col>
        <el-col :xs="24" :md="12">
          <el-form-item label="描述">
            <el-input v-model="form.description" placeholder="插件描述(可选)" />
          </el-form-item>
        </el-col>
      </el-row>
    </el-form>

    <div class="editor-container">
      <div ref="editorRef" class="monaco-editor"></div>
    </div>

    <div v-if="error" class="editor-error">
      <el-alert :title="error" type="error" show-icon :closable="false" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '@/api'
import { ElMessage } from 'element-plus'
import * as monaco from 'monaco-editor'

const route = useRoute()
const router = useRouter()
const pluginId = computed(() => route.params.id as string)
const isNew = computed(() => pluginId.value === 'new')

const form = ref({ name: '', description: '' })
const code = ref('')
const saving = ref(false)
const error = ref('')
const editorRef = ref<HTMLElement | null>(null)

let editor: monaco.editor.IStandaloneCodeEditor | null = null

const DEFAULT_CODE = `module.exports = {
  manifest: {
    id: 'my-plugin',
    name: '我的插件',
    version: '1.0.0',
    description: '插件描述',
    author: '管理员'
  },

  onLoad: function(ctx) {
    ctx.logger.info('插件加载中...');
  },

  onEnable: function(ctx) {
    ctx.logger.info('插件已启用');

    // 监听频道消息
    ctx.eventBus.on('message.guild', async function(data) {
      const content = data.content || '';

      if (content.includes('你好')) {
        await ctx.bot.sendMessage(data.channelId, '你好！有什么可以帮助你的吗？', data.id);
      }

      if (content.includes('帮助')) {
        await ctx.bot.sendMessage(data.channelId, '可用命令：你好、帮助、时间', data.id);
      }

      if (content.includes('时间')) {
        const now = new Date().toLocaleString('zh-CN');
        await ctx.bot.sendMessage(data.channelId, '当前时间：' + now, data.id);
      }
    });
  },

  onDisable: function(ctx) {
    ctx.logger.info('插件已禁用');
  },

  onUnload: function(ctx) {
    ctx.logger.info('插件已卸载');
  }
};
`

onMounted(async () => {
  if (!isNew.value) {
    try {
      const res: any = await api.get(`/plugins/${pluginId.value}/code`)
      code.value = res.code
    } catch (e: any) {
      ElMessage.error('加载插件失败')
      router.push('/plugins')
      return
    }
  } else {
    code.value = DEFAULT_CODE
  }

  await nextTick()
  initEditor()
})

function initEditor() {
  if (!editorRef.value) return

  monaco.editor.defineTheme('bot-theme', {
    base: 'vs-dark',
    inherit: true,
    rules: [],
    colors: { 'editor.background': '#1e1e1e' },
  })

  editor = monaco.editor.create(editorRef.value, {
    value: code.value,
    language: 'javascript',
    theme: 'bot-theme',
    fontSize: 14,
    minimap: { enabled: false },
    automaticLayout: true,
    scrollBeyondLastLine: false,
    tabSize: 2,
  })
}

async function savePlugin() {
  if (!form.value.name) {
    error.value = '请输入插件名称'
    return
  }

  const pluginCode = editor?.getValue() || ''

  if (!pluginCode.trim()) {
    error.value = '插件代码不能为空'
    return
  }

  saving.value = true
  error.value = ''

  try {
    if (isNew.value) {
      const res: any = await api.post('/plugins', {
        name: form.value.name,
        description: form.value.description,
        code: pluginCode,
      })
      ElMessage.success('插件创建成功')
      router.replace(`/plugins/${res.id}`)
    } else {
      await api.put(`/plugins/${pluginId.value}`, {
        name: form.value.name,
        description: form.value.description,
        code: pluginCode,
      })
      ElMessage.success('插件保存成功')
    }
  } catch (e: any) {
    error.value = e.response?.data?.error || '保存失败'
  } finally {
    saving.value = false
  }
}

onBeforeUnmount(() => {
  editor?.dispose()
})
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

.editor-container {
  margin-top: 16px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  overflow: hidden;
}

.monaco-editor {
  height: 500px;
  width: 100%;
}

.editor-error {
  margin-top: 12px;
}

@media (max-width: 768px) {
  .monaco-editor {
    height: 350px;
  }

  :deep(.el-form-item__label) {
    width: 70px !important;
  }
}
</style>
