<template>
  <div class="groups-page">
    <h2>群聊管理</h2>

    <el-card style="margin-bottom: 20px">
      <template #header>群列表 ({{ groups.length }})</template>
      <el-table :data="groups" stripe v-if="groups.length > 0" empty-text="暂无群聊数据 (收到群消息后自动记录)">
        <el-table-column prop="id" label="群ID" :show-overflow-tooltip="true" />
        <el-table-column prop="name" label="群名称">
          <template #default="{ row }">
            <span v-if="row.name">{{ row.name }}</span>
            <el-button v-else size="small" @click="editName(row)">设置名称</el-button>
          </template>
        </el-table-column>
        <el-table-column prop="member_count" label="成员数" width="100" />
        <el-table-column label="最后活跃" width="180">
          <template #default="{ row }">{{ formatTime(row.last_active) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="200">
          <template #default="{ row }">
            <el-button size="small" @click="viewMembers(row)">成员管理</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-else description="暂无群聊数据，群消息到达后自动记录" />
    </el-card>

    <!-- Members dialog -->
    <el-dialog v-model="memberDialog" :title="'成员管理: ' + selectedGroup?.name || selectedGroup?.id" width="700px">
      <el-table :data="members" stripe v-loading="loadingMembers" max-height="500" empty-text="暂无成员，收到群消息后自动记录">
        <el-table-column label="成员ID" :show-overflow-tooltip="true">
          <template #default="{ row }">{{ row.member_openid || '未知' }}</template>
        </el-table-column>
        <el-table-column label="昵称" width="120">
          <template #default="{ row }">{{ row.nickname || '-' }}</template>
        </el-table-column>
        <el-table-column label="QQ号" width="140">
          <template #default="{ row }">{{ row.qq_id || '-' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="250">
          <template #default="{ row }">
            <template v-if="selectedGroup">
              <el-button size="small" type="warning" @click="muteMember(row)">禁言</el-button>
              <el-button size="small" type="info" @click="unmuteMember(row)">解禁</el-button>
              <el-popconfirm title="确认移出该成员?" @confirm="kickMember(row)">
                <template #reference>
                  <el-button size="small" type="danger">踢出</el-button>
                </template>
              </el-popconfirm>
            </template>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>

    <!-- Mute duration dialog -->
    <el-dialog v-model="muteDialog" title="禁言时长" width="300px">
      <el-select v-model="muteDuration" placeholder="选择时长" style="width: 100%">
        <el-option label="1 分钟" :value="60" />
        <el-option label="5 分钟" :value="300" />
        <el-option label="10 分钟" :value="600" />
        <el-option label="30 分钟" :value="1800" />
        <el-option label="1 小时" :value="3600" />
        <el-option label="12 小时" :value="43200" />
        <el-option label="24 小时" :value="86400" />
      </el-select>
      <template #footer>
        <el-button @click="muteDialog = false">取消</el-button>
        <el-button type="primary" @click="confirmMute" :loading="muting">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { api } from '@/api'
import { ElMessage } from 'element-plus'

interface Group {
  id: string
  name: string | null
  member_count: number
  first_seen: string
  last_active: string
}

interface Member {
  member_openid: string
  qq_id: string
  nickname: string
  first_seen: string
  last_seen: string
}

const groups = ref<Group[]>([])
const selectedGroup = ref<Group | null>(null)
const memberDialog = ref(false)
const members = ref<Member[]>([])
const loadingMembers = ref(false)
const muteDialog = ref(false)
const muteDuration = ref(600)
const muting = ref(false)
const pendingMuteMember = ref<Member | null>(null)

onMounted(() => loadGroups())

async function loadGroups() {
  try {
    const data: any = await api.get('/groups')
    groups.value = data.groups || []
  } catch { ElMessage.error('加载失败') }
}

function editName(row: Group) {
  // Simple prompt-like editing
  const name = prompt('请输入群名称:')
  if (name) {
    api.put(`/groups/${row.id}/name`, { name }).then(() => {
      row.name = name
      ElMessage.success('已更新')
    }).catch(() => ElMessage.error('更新失败'))
  }
}

async function viewMembers(row: Group) {
  selectedGroup.value = row
  memberDialog.value = true
  loadingMembers.value = true
  try {
    const data: any = await api.get(`/groups/${row.id}/members`)
    members.value = data.members || []
  } catch {
    members.value = []
    ElMessage.error('获取失败')
  }
  loadingMembers.value = false
}

function muteMember(row: Member) {
  pendingMuteMember.value = row
  muteDialog.value = true
}

async function confirmMute() {
  if (!selectedGroup.value || !pendingMuteMember.value) return
  const memberId = pendingMuteMember.value.member_openid
  muting.value = true
  try {
    await api.post(`/groups/${selectedGroup.value.id}/mute`, { memberId, duration: muteDuration.value })
    ElMessage.success('已禁言')
    muteDialog.value = false
  } catch { ElMessage.error('禁言失败') }
  muting.value = false
}

async function unmuteMember(row: Member) {
  if (!selectedGroup.value) return
  const memberId = row.member_openid
  try {
    await api.post(`/groups/${selectedGroup.value.id}/unmute`, { memberId })
    ElMessage.success('已解禁')
  } catch { ElMessage.error('操作失败') }
}

async function kickMember(row: Member) {
  if (!selectedGroup.value) return
  const memberId = row.member_openid
  try {
    await api.post(`/groups/${selectedGroup.value.id}/kick`, { memberId })
    ElMessage.success('已移出')
    viewMembers(selectedGroup.value)
  } catch { ElMessage.error('移出失败') }
}

function formatTime(t: string) {
  return new Date(t + 'Z').toLocaleString('zh-CN')
}
</script>
