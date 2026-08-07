<template>
  <div class="plan-page">
    <el-tabs v-model="activeTab" type="border-card">
      <el-tab-pane label="计划表" name="schedule">
        <div class="toolbar">
          <el-date-picker v-model="scheduleDate" type="date" value-format="YYYY-MM-DD" />
          <el-button type="primary" :icon="Plus" @click="openScheduleDialog()">添加计划</el-button>
        </div>
        <el-table :data="scheduleBlocksForDay" border>
          <el-table-column prop="start_time" label="开始" width="110" />
          <el-table-column prop="end_time" label="结束" width="110" />
          <el-table-column prop="content" label="计划内容" />
          <el-table-column label="操作" width="150" align="center">
            <template #default="{ row }">
              <el-button link type="primary" @click="openScheduleDialog(row)">编辑</el-button>
              <el-button link type="danger" @click="removeSchedule(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-if="!scheduleBlocksForDay.length" description="今天还没有计划" />
      </el-tab-pane>

      <el-tab-pane label="习惯打卡" name="habits">
        <div class="toolbar">
          <el-button type="primary" :icon="Plus" @click="habitDialogVisible = true">新增习惯</el-button>
        </div>
        <el-table :data="habits" border>
          <el-table-column prop="name" label="习惯" />
          <el-table-column prop="description" label="说明" />
          <el-table-column label="今日状态" width="130" align="center">
            <template #default="{ row }">
              <el-checkbox :model-value="isHabitChecked(row.id)" @change="value => toggleHabit(row, value)">已完成</el-checkbox>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="130" align="center">
            <template #default="{ row }">
              <el-button link type="danger" @click="removeHabit(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-if="!habits.length" description="还没有习惯" />
      </el-tab-pane>

      <el-tab-pane label="备忘录" name="memo">
        <Memo />
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="scheduleDialogVisible" :title="editingSchedule.id ? '编辑计划' : '添加计划'" width="430px">
      <el-form label-width="70px">
        <el-form-item label="日期"><el-date-picker v-model="editingSchedule.block_date" type="date" value-format="YYYY-MM-DD" /></el-form-item>
        <el-form-item label="内容"><el-input v-model="editingSchedule.content" /></el-form-item>
        <el-form-item label="时间"><el-time-picker v-model="scheduleTimeRange" is-range format="HH:mm" value-format="HH:mm" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="scheduleDialogVisible = false">取消</el-button><el-button type="primary" @click="saveSchedule">保存</el-button></template>
    </el-dialog>

    <el-dialog v-model="habitDialogVisible" title="新增习惯" width="430px">
      <el-form label-width="70px">
        <el-form-item label="名称"><el-input v-model="newHabit.name" /></el-form-item>
        <el-form-item label="说明"><el-input v-model="newHabit.description" type="textarea" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="habitDialogVisible = false">取消</el-button><el-button type="primary" @click="saveHabit">保存</el-button></template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import axios from 'axios'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import Memo from '../Memo/index.vue'

const API_BASE = 'http://localhost:5888/api'
const activeTab = ref('schedule')
const scheduleDate = ref(new Date().toISOString().slice(0, 10))
const scheduleBlocks = ref([])
const scheduleDialogVisible = ref(false)
const scheduleTimeRange = ref(['09:00', '10:00'])
const editingSchedule = ref({ id: '', block_date: '', content: '', start_time: '', end_time: '' })
const habits = ref([])
const habitLogs = ref([])
const habitDialogVisible = ref(false)
const newHabit = ref({ name: '', description: '', icon: '⭐' })
const today = () => new Date().toISOString().slice(0, 10)

const scheduleBlocksForDay = computed(() => scheduleBlocks.value.filter(item => item.block_date === scheduleDate.value))
const loadScheduleBlocks = async () => {
  try {
    const { data } = await axios.get(`${API_BASE}/plan/schedule-blocks`)
    if (data.success) scheduleBlocks.value = data.data || []
  } catch { ElMessage.error('计划读取失败') }
}
const openScheduleDialog = row => {
  editingSchedule.value = row ? { ...row } : { id: '', block_date: scheduleDate.value, content: '', start_time: '09:00', end_time: '10:00' }
  scheduleTimeRange.value = [editingSchedule.value.start_time, editingSchedule.value.end_time]
  scheduleDialogVisible.value = true
}
const saveSchedule = async () => {
  if (!editingSchedule.value.block_date || !editingSchedule.value.content || scheduleTimeRange.value.length !== 2) return ElMessage.warning('请填写完整计划')
  const payload = { ...editingSchedule.value, start_time: scheduleTimeRange.value[0], end_time: scheduleTimeRange.value[1] }
  try {
    const request = payload.id ? axios.put(`${API_BASE}/plan/schedule-blocks/${payload.id}`, payload) : axios.post(`${API_BASE}/plan/schedule-blocks`, payload)
    await request
    scheduleDialogVisible.value = false
    await loadScheduleBlocks()
    ElMessage.success('计划已保存')
  } catch { ElMessage.error('计划保存失败') }
}
const removeSchedule = async row => {
  try {
    await ElMessageBox.confirm('确定删除这个计划吗？', '提示')
    await axios.delete(`${API_BASE}/plan/schedule-blocks/${row.id}`)
    await loadScheduleBlocks()
  } catch (error) { if (error !== 'cancel') ElMessage.error('计划删除失败') }
}
const loadHabits = async () => {
  try {
    const { data } = await axios.get(`${API_BASE}/plan/habits`)
    if (data.success) { habits.value = data.data?.habits || []; habitLogs.value = data.data?.logs || [] }
  } catch { ElMessage.error('习惯读取失败') }
}
const isHabitChecked = id => habitLogs.value.some(log => log.habit_id === id && String(log.check_date).slice(0, 10) === today())
const toggleHabit = async (habit, checked) => {
  try {
    await axios.post(`${API_BASE}/plan/habits/${checked ? 'check' : 'uncheck'}`, { habit_id: habit.id, check_date: today() })
    await loadHabits()
  } catch { ElMessage.error('习惯打卡失败') }
}
const saveHabit = async () => {
  if (!newHabit.value.name.trim()) return ElMessage.warning('请输入习惯名称')
  try {
    await axios.post(`${API_BASE}/plan/habits`, newHabit.value)
    habitDialogVisible.value = false
    newHabit.value = { name: '', description: '', icon: '⭐' }
    await loadHabits()
  } catch { ElMessage.error('习惯保存失败') }
}
const removeHabit = async habit => {
  try {
    await ElMessageBox.confirm(`确定删除习惯“${habit.name}”吗？`, '提示')
    await axios.delete(`${API_BASE}/plan/habits/${habit.id}`)
    await loadHabits()
  } catch (error) { if (error !== 'cancel') ElMessage.error('习惯删除失败') }
}
onMounted(() => { loadScheduleBlocks(); loadHabits() })
</script>

<style scoped>
.plan-page { height: 100%; padding: 18px; box-sizing: border-box; overflow: auto; }
.toolbar { display: flex; gap: 12px; align-items: center; margin-bottom: 16px; }
.el-empty { min-height: 180px; }
</style>
