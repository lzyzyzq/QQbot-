<template>
  <div class="file-explorer">
    <h2>文件浏览器</h2>
    <div style="display: flex; gap: 16px; margin-bottom: 12px; align-items: center;">
      <el-breadcrumb separator="/">
        <el-breadcrumb-item :to="{ path: '/files' }">/</el-breadcrumb-item>
        <el-breadcrumb-item v-for="(seg, i) in pathSegments" :key="i" :to="{ path: '/files', query: { dir: seg.path } }">
          {{ seg.name }}
        </el-breadcrumb-item>
      </el-breadcrumb>
      <div style="display: flex; gap: 8px; margin-left: auto;">
        <input ref="fileInputEl" type="file" multiple style="display: none" @change="onFilesSelected" />
        <input ref="archiveInputEl" type="file" accept=".zip,.rar" style="display: none" @change="onArchiveSelected" />
        <el-button size="small" @click="fileInputEl?.click()">上传文件</el-button>
        <el-button size="small" @click="archiveInputEl?.click()">上传压缩包</el-button>
        <el-button size="small" @click="showNewDialog = true">+ 新建</el-button>
        <el-button size="small" :disabled="selected.length === 0" type="warning" @click="downloadSelected">打包下载({{ selected.length }})</el-button>
        <el-button size="small" @click="loadDir()">刷新</el-button>
      </div>
    </div>

    <el-table :data="items" stripe v-loading="loading" empty-text="目录为空" @selection-change="onSelChange" ref="tableRef">
      <el-table-column type="selection" width="40" />
      <el-table-column label="名称" sortable prop="name">
        <template #default="{ row }">
          <div style="display: flex; align-items: center; gap: 8px; cursor: pointer;" @click="openItem(row)">
            <span>{{ row.type === 'directory' ? '📁' : '📄' }}</span>
            <span :style="{ color: row.type === 'directory' ? '#409eff' : 'inherit' }">{{ row.name }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="类型" width="100">
        <template #default="{ row }">
          <el-tag :type="row.type === 'directory' ? 'warning' : ''" size="small">{{ row.type === 'directory' ? '目录' : '文件' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="大小" width="100">
        <template #default="{ row }">{{ row.size ? formatSize(row.size) : '-' }}</template>
      </el-table-column>
      <el-table-column label="操作" width="300">
        <template #default="{ row }">
          <el-button v-if="row.type !== 'directory'" size="small" @click="openEditor(row)">编辑</el-button>
          <el-button size="small" @click="renameItem(row)">重命名</el-button>
          <el-button size="small" @click="downloadFile(row)">下载</el-button>
          <el-popconfirm title="移入回收站(保留2天)?" @confirm="deleteItem(row, false)">
            <template #reference><el-button size="small" type="warning">删除</el-button></template>
          </el-popconfirm>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="showNewDialog" title="新建" width="400px">
      <el-form>
        <el-form-item label="类型">
          <el-radio-group v-model="newType">
            <el-radio value="file">文件</el-radio>
            <el-radio value="directory">目录</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="名称">
          <el-input v-model="newName" placeholder="请输入名称" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showNewDialog = false">取消</el-button>
        <el-button type="primary" @click="createItem" :loading="creating">创建</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="editDialog" :title="'编辑: ' + editingFile" width="80%" top="5vh">
      <textarea v-model="editContent" style="width: 100%; height: 60vh; font-family: monospace; font-size: 14px; resize: vertical; padding: 8px; border: 1px solid #dcdfe6; border-radius: 4px;"></textarea>
      <template #footer>
        <el-button @click="editDialog = false">取消</el-button>
        <el-button type="primary" @click="saveFile" :loading="saving">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="renameDialog" title="重命名" width="400px">
      <el-form>
        <el-form-item label="新名称">
          <el-input v-model="renameNewName" placeholder="请输入新名称" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="renameDialog = false">取消</el-button>
        <el-button type="primary" @click="doRename" :loading="renaming">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="uploading" title="上传中" width="300px" :close-on-click-modal="false" :show-close="false">
      <el-progress :percentage="uploadProgress" :status="uploadProgress === 100 ? 'success' : ''" />
      <p style="text-align: center;">{{ uploadMsg }}</p>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '@/api'
import { ElMessage } from 'element-plus'

interface FileItem {
  name: string
  type: 'file' | 'directory'
  path: string
  size?: number
}

const route = useRoute()
const router = useRouter()
const fileInputEl = ref<HTMLInputElement | null>(null)
const archiveInputEl = ref<HTMLInputElement | null>(null)
const items = ref<FileItem[]>([])
const currentDir = ref('')
const loading = ref(false)
const selected = ref<FileItem[]>([])
const tableRef = ref()

const showNewDialog = ref(false)
const newType = ref('file')
const newName = ref('')
const creating = ref(false)

const editDialog = ref(false)
const editingFile = ref('')
const editContent = ref('')
const saving = ref(false)

const uploading = ref(false)
const uploadProgress = ref(0)
const uploadMsg = ref('')

const renameDialog = ref(false)
const renamingFile = ref('')
const renameNewName = ref('')
const renaming = ref(false)

const pathSegments = ref<{ name: string; path: string }[]>([])

onMounted(() => {
  const dir = (route.query.dir as string) || ''
  currentDir.value = dir
  loadDir()
})

watch(() => route.query.dir, (dir) => {
  currentDir.value = (dir as string) || ''
  loadDir()
})

function buildSegments(dir: string) {
  if (!dir) return []
  const parts = dir.split('/')
  const segs: { name: string; path: string }[] = []
  let acc = ''
  for (const p of parts) {
    acc = acc ? acc + '/' + p : p
    segs.push({ name: p, path: acc })
  }
  return segs
}

async function loadDir() {
  loading.value = true
  try {
    const data: any = await api.get('/files', { params: { dir: currentDir.value } })
    items.value = data.items || []
    pathSegments.value = buildSegments(data.path || '')
  } catch { ElMessage.error('加载失败') }
  loading.value = false
}

function onSelChange(sel: FileItem[]) {
  selected.value = sel
}

function openItem(row: FileItem) {
  if (row.type === 'directory') {
    currentDir.value = row.path
    router.push({ path: '/files', query: { dir: row.path } })
  } else {
    openEditor(row)
  }
}

async function deleteItem(row: FileItem, permanent: boolean) {
  try {
    const data: any = await api.delete('/files', { params: { file: row.path, permanent: permanent ? '1' : '0' } })
    ElMessage.success(data.message || '已删除')
    loadDir()
  } catch (e: any) { ElMessage.error(e?.response?.data?.error || '删除失败') }
}

function renameItem(row: FileItem) {
  renamingFile.value = row.path
  renameNewName.value = row.name
  renameDialog.value = true
}

async function doRename() {
  if (!renameNewName.value.trim()) { ElMessage.warning('请输入名称'); return }
  renaming.value = true
  try {
    const data: any = await api.put('/files', { file: renamingFile.value, newName: renameNewName.value, action: 'rename' })
    ElMessage.success('已重命名')
    renameDialog.value = false
    loadDir()
  } catch (e: any) { ElMessage.error(e?.response?.data?.error || '重命名失败') }
  renaming.value = false
}

function openEditor(row: FileItem) {
  editingFile.value = row.path
  editContent.value = ''
  loadEditContent(row.path)
  editDialog.value = true
}

async function loadEditContent(path: string) {
  try {
    const data: any = await api.get('/files/download', { params: { file: path, raw: '1' } })
    editContent.value = typeof data === 'string' ? data : JSON.stringify(data)
  } catch { editContent.value = '' }
}

async function saveFile() {
  saving.value = true
  try {
    await api.put('/files', { file: editingFile.value, content: editContent.value })
    ElMessage.success('已保存')
    loadDir()
  } catch (e: any) { ElMessage.error(e?.response?.data?.error || '保存失败') }
  saving.value = false
}

async function createItem() {
  if (!newName.value.trim()) { ElMessage.warning('请输入名称'); return }
  creating.value = true
  try {
    await api.post('/files', { name: newName.value, type: newType.value, dir: currentDir.value })
    ElMessage.success('已创建')
    showNewDialog.value = false
    newName.value = ''
    loadDir()
  } catch (e: any) { ElMessage.error(e?.response?.data?.error || '创建失败') }
  creating.value = false
}

function downloadFile(row: FileItem) {
  const a = document.createElement('a')
  a.href = '/api/files/download?file=' + encodeURIComponent(row.path)
  a.download = row.name
  a.click()
}

function downloadSelected() {
  const paths = selected.value.map(s => s.path).join(',')
  const a = document.createElement('a')
  a.href = '/api/files/download-zip?files=' + encodeURIComponent(paths)
  a.download = 'files.zip'
  a.click()
}

async function onFilesSelected(e: Event) {
  const input = e.target as HTMLInputElement
  if (!input.files?.length) return
  await uploadFiles(input.files, false)
  input.value = ''
}

async function onArchiveSelected(e: Event) {
  const input = e.target as HTMLInputElement
  if (!input.files?.length) return
  await uploadFiles(input.files, true)
  input.value = ''
}

async function uploadFiles(fileList: FileList, extract: boolean) {
  const formData = new FormData()
  for (let i = 0; i < fileList.length; i++) {
    formData.append('files', fileList[i])
  }
  formData.append('dir', currentDir.value)
  formData.append('extract', extract ? '1' : '0')

  uploading.value = true
  uploadProgress.value = 0
  uploadMsg.value = '上传中...'

  try {
    const data: any = await api.post('/files/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e: any) => {
        uploadProgress.value = Math.round((e.loaded * 100) / e.total)
      },
    })
    uploadMsg.value = data.message || '上传完成'
    uploadProgress.value = 100
    setTimeout(() => { uploading.value = false }, 800)
    loadDir()
  } catch (e: any) {
    uploadMsg.value = e?.response?.data?.error || '上传失败'
  }
}

function formatSize(bytes: number) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}
</script>
