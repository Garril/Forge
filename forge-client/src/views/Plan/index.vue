<template>
  <div class="plan-container">
    <el-tabs v-model="activeTab" type="border-card" @tab-change="handleTabChange">
      <!-- 计划表 -->
      <el-tab-pane label="📋 计划表" name="schedule" lazy>
          <div class="schedule-view" @click="clearSelectedBlock">
          <div class="schedule-toolbar">
            <div class="schedule-nav-group">
              <el-button size="small" :icon="ArrowLeft" class="schedule-nav-btn" @click="prevScheduleWeek">上一周</el-button>
              <el-button size="small" class="schedule-nav-btn schedule-nav-primary" @click="currentScheduleWeek">本周</el-button>
              <el-button size="small" :icon="ArrowRight" class="schedule-nav-btn" @click="nextScheduleWeek">下一周</el-button>
            </div>
            <div class="schedule-action-group">
              <el-button size="small" type="primary" :icon="Collection" class="schedule-action-btn" @click="openSchedulePresetDialog">预设配置</el-button>
              <el-button size="small" type="danger" :icon="Delete" class="schedule-action-btn" @click="clearTodaySchedule">清空当天计划</el-button>
            </div>
          </div>
          <div class="schedule-grid">
            <div class="schedule-header">
              <div class="schedule-time-header">时间</div>
              <div
                v-for="day in scheduleDays"
                :key="day.dateStr"
                class="schedule-day-header"
                :class="{ today: day.isToday, selected: day.isSelected }"
                @click="selectScheduleDate(day)"
              >
                {{ day.label }}
              </div>
            </div>
            <div class="schedule-body" ref="scheduleBodyRef">
              <div class="schedule-time-column">
                <div v-for="time in scheduleTimeSlots" :key="time" class="schedule-time-cell">{{ time }}</div>
              </div>
              <div
                v-for="day in scheduleDays"
                :key="day.dateStr"
                class="schedule-day-column"
                @dblclick="handleDayDoubleClick($event, day)"
              >
                <div v-for="time in scheduleTimeSlots" :key="time" class="schedule-cell"></div>
                <div
                  v-for="block in getScheduleBlocksByDate(day.dateStr)"
                  :key="block.id"
                  class="schedule-block"
                  :class="{
                    'schedule-block-previewing': isPreviewingBlock(block.id),
                    'schedule-block-selected': isBlockSelected(block.id)
                  }"
                  :style="getScheduleBlockStyle(block, day)"
                  @mousedown.stop="startDragBlock($event, block, day)"
                  @click.stop="selectScheduleBlock(block)"
                  @dblclick.stop="openEditScheduleBlock(block)"
                >
                  <div class="schedule-block-content" :class="{ 'schedule-block-content-horizontal': isBlockHeightSmall(block) }">
                    <span class="schedule-block-time">{{ formatTimeRange(block.start_time, block.end_time) }}</span>
                    <span v-if="!quickEditBlock || quickEditBlock.id !== block.id" class="schedule-block-text" :title="block.content">{{ block.content }}</span>
                    <el-input
                      v-else
                      v-model="quickEditBlock.content"
                      class="schedule-block-quick-edit"
                      size="small"
                      @click.stop
                      @mousedown.stop
                    />
                  </div>
                  <div class="schedule-block-resize" @mousedown.stop="startResizeBlock($event, block, day)"></div>
                </div>
              </div>
              <div
                v-if="scheduleBlockPreview"
                class="schedule-block schedule-block-preview"
                :style="getScheduleBlockPreviewStyle(scheduleBlockPreview)"
              >
                <div class="schedule-block-content">
                  <span class="schedule-block-time">{{ formatTimeRange(scheduleBlockPreview.start_time, scheduleBlockPreview.end_time) }}</span>
                  <span class="schedule-block-text">{{ scheduleBlockPreview.content }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <!-- 日历 -->
      <el-tab-pane label="📅 日历" name="calendar" lazy>
        <el-row :gutter="20">
          <el-col :span="16">
            <el-calendar v-model="currentDate" class="tall-calendar">
              <template #date-cell="{ data }">
                <div class="calendar-cell" @click="handleDateClick(data)">
                  <div class="calendar-day-header">
                    <span :class="{ 'is-today': data.isToday }" class="solar-day">{{ data.day.split('-').slice(1).join('-') }}</span>
                    <span class="lunar-day" :class="getLunarInfo(data.day).colorClass">{{ getLunarInfo(data.day).text }}</span>
                  </div>
                  <div class="events-list">
                    <div
                      v-for="e in getEventsByDate(data.day).slice(0, 8)"
                      :key="e.id"
                      class="event-badge"
                      :class="{ 'memo-badge': e.type === 'memo', 'process-badge': e.type === 'process', 'habit-badge': e.type === 'habit', 'completed': e.type === 'memo' && e.is_completed }"
                    >
                      <span v-if="e.type === 'memo' && e.is_completed">✓ </span>
                      <span v-else>• </span>
                      {{ e.content }}
                    </div>
                    <div v-if="getEventsByDate(data.day).length > 8" class="more-badge">
                      +{{ getEventsByDate(data.day).length - 8 }} 更多
                    </div>
                  </div>
                </div>
              </template>
            </el-calendar>
          </el-col>
          <el-col :span="8">
            <el-card shadow="never">
              <template #header>
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <h4>{{ selectedDate }} 日程</h4>
                  <el-button size="small" type="primary" :icon="Plus" @click="showAddMemoDialog">新增备忘</el-button>
                </div>
              </template>
              <el-empty v-if="selectedDateItems.length === 0" description="当日无事项" />
              <div v-else class="event-items">
                <div class="section-title" v-if="selectedDateMemos.length > 0">备忘事件</div>
                <div
                  v-for="e in selectedDateMemos"
                  :key="e.id"
                  class="event-item memo-item"
                  :class="{ 'completed': e.is_completed }"
                  @click="toggleMemoComplete(e, !(e.is_completed === 1 || e.is_completed === true))"
                >
                  <el-checkbox
                    :model-value="e.is_completed === 1 || e.is_completed === true"
                    @change="(val) => toggleMemoComplete(e, val)"
                    size="small"
                  />
                  <span v-if="editingEventId !== e.id" class="memo-content" @dblclick.stop="startEditEvent(e)">{{ e.content }}</span>
                  <el-input
                    v-else
                    v-model="editEventContent"
                    size="small"
                    style="width: 200px;"
                    @blur="saveEditEvent(e.id)"
                    @keyup.enter="saveEditEvent(e.id)"
                    v-focus
                  />
                  <div class="event-actions" @click.stop>
                    <el-icon class="action-icon" @click="startEditEvent(e)"><EditPen /></el-icon>
                    <el-icon class="action-icon danger" @click="deleteEvent(e.id)"><Delete /></el-icon>
                  </div>
                </div>
                
                <div class="section-title" v-if="selectedDateProcesses.length > 0" style="margin-top: 15px;">相关流程</div>
                <div v-for="p in selectedDateProcesses" :key="p.id" class="event-item process-item">
                  <div class="process-info">
                    <el-tag size="small" :type="p.status === 1 ? 'success' : 'info'">{{ p.status === 1 ? '已完成' : '进行中' }}</el-tag>
                    <span class="process-name">{{ p.name }}</span>
                  </div>
                  <div class="process-date">
                    {{ formatDate(p.start_time) }} ~ {{ formatDate(p.deadline) }}
                  </div>
                </div>

                <div class="section-title" v-if="selectedDateHabits.length > 0" style="margin-top: 15px;">习惯打卡</div>
                <div 
                  v-for="h in selectedDateHabits" 
                  :key="h.id" 
                  class="event-item habit-item"
                  @click="toggleCheck(h.id, selectedDate)"
                >
                  <div class="habit-info">
                    <span v-if="!h.icon.startsWith('/')" class="habit-icon">{{ h.icon }}</span>
                    <img v-else :src="BASE_URL + h.icon" class="habit-icon-img" />
                    <span class="habit-name">{{ h.name }}</span>
                    <el-tag v-if="h.checked" size="small" type="success">已打卡</el-tag>
                    <el-tag v-else size="small" type="info">未打卡</el-tag>
                  </div>
                </div>
              </div>
            </el-card>
          </el-col>
        </el-row>
      </el-tab-pane>

      <!-- 习惯打卡 -->
      <el-tab-pane label="⭐ 习惯打卡" name="habits" lazy>
        <div class="habit-container">
          <!-- 左侧习惯列表 -->
          <div class="habit-list-section">
            <div class="habit-list-header">
              <el-button type="primary" :icon="Plus" @click="habitDialogVisible = true">新增习惯</el-button>

            </div>
            <div class="habit-list">
              <div 
                v-for="(habit, index) in habits" 
                :key="habit.id"
                class="habit-row"
                :class="{ active: selectedHabit?.id === habit.id }"
                @click="selectHabit(habit)"
              >
                  <div class="habit-info-left">
                  <span v-if="!habit.icon.startsWith('/')" class="habit-icon-large" @dblclick.stop="openEditHabitDialog(habit)">{{ habit.icon }}</span>
                  <img v-else :src="BASE_URL + habit.icon" class="habit-icon-large-img" @dblclick.stop="openEditHabitDialog(habit)" />
                  <div class="habit-text">
                    <div class="habit-name-large" @dblclick.stop="openEditHabitDialog(habit)">{{ habit.name }}</div>
                    <div class="habit-stats">
                      <span class="stat-item">
                        <el-icon><Lightning /></el-icon>
                        {{ getTotalCheckCount(habit.id) }}天
                      </span>
                      <span class="stat-item">
                        <el-icon><FireIcon /></el-icon>
                        {{ getCurrentStreak(habit.id) }}天
                      </span>
                    </div>
                  </div>
                </div>
                <div class="habit-actions">
                  <el-icon class="action-icon" @click.stop="moveHabitUp(habit, index)"><ArrowUp /></el-icon>
                  <el-icon class="action-icon" @click.stop="moveHabitDown(habit, index)"><ArrowDown /></el-icon>
                  <el-icon class="action-icon" @click.stop="openEditHabitDialog(habit)"><EditPen /></el-icon>
                  <el-icon class="action-icon danger" @click.stop="deleteHabit(habit)"><Delete /></el-icon>
                </div>
                <div class="habit-week-checks">
                  <div 
                    v-for="d in last7Days" 
                    :key="d"
                    class="week-check-item"
                    @click.stop="toggleCheck(habit.id, d)"
                  >
                    <div 
                      class="week-check-dot"
                      :class="{ checked: isHabitChecked(habit.id, d) }"
                    >
                      <el-icon v-if="isHabitChecked(habit.id, d)"><Check /></el-icon>
                    </div>
                    <span class="week-check-date">{{ formatShortDate(d) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- 右侧详情面板 -->
          <div class="habit-detail-section" v-if="selectedHabit">
            <div class="detail-header">
              <span v-if="!selectedHabit.icon.startsWith('/')" class="detail-icon">{{ selectedHabit.icon }}</span>
              <img v-else :src="BASE_URL + selectedHabit.icon" class="detail-icon-img" />
              <span class="detail-name">{{ selectedHabit.name }}</span>
            </div>
            <div class="detail-stats">
              <div class="stat-card">
                <div class="stat-icon"><el-icon><Calendar /></el-icon></div>
                <div class="stat-label">月打卡</div>
                <div class="stat-value">{{ getMonthCheckCount(selectedHabit.id) }}天</div>
              </div>
              <div class="stat-card">
                <div class="stat-icon blue"><el-icon><Lightning /></el-icon></div>
                <div class="stat-label">总打卡</div>
                <div class="stat-value">{{ getTotalCheckCount(selectedHabit.id) }}天</div>
              </div>
              <div class="stat-card">
                <div class="stat-icon orange"><el-icon><TrendCharts /></el-icon></div>
                <div class="stat-label">月完成率</div>
                <div class="stat-value">{{ getMonthCompletionRate(selectedHabit.id) }}%</div>
              </div>
              <div class="stat-card">
                <div class="stat-icon red"><el-icon><FireIcon /></el-icon></div>
                <div class="stat-label">当前连续</div>
                <div class="stat-value">{{ getCurrentStreak(selectedHabit.id) }}天</div>
              </div>
            </div>
            <div class="detail-calendar">
              <div class="calendar-header">
                <el-icon class="nav-arrow" @click="changeHabitMonth(-1)"><ArrowLeft /></el-icon>
                <span class="calendar-title">{{ habitCalendarYear }}年{{ habitCalendarMonth + 1 }}月</span>
                <el-icon class="nav-arrow" @click="changeHabitMonth(1)"><ArrowRight /></el-icon>
              </div>
              <div class="mini-calendar">
                <div class="week-header">
                  <span v-for="day in ['日', '一', '二', '三', '四', '五', '六']" :key="day" class="week-day">{{ day }}</span>
                </div>
                <div class="days-grid">
                  <div 
                    v-for="(day, index) in habitCalendarDays" 
                    :key="index"
                    class="day-cell"
                    :class="{ 
                      checked: day.isChecked, 
                      'other-month': !day.isCurrentMonth,
                      today: day.isToday
                    }"
                    @click="day.isCurrentMonth && toggleCheck(selectedHabit.id, day.dateStr)"
                  >
                    <span class="day-num">{{ day.date }}</span>
                    <el-icon v-if="day.isChecked" class="check-mark"><Check /></el-icon>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="habit-detail-section empty" v-else>
            <el-empty description="选择一个习惯查看详情" />
          </div>
        </div>
      </el-tab-pane>
      <!-- 备忘录 -->
      <el-tab-pane label="📝 备忘录" name="memo" lazy>
        <Memo />
      </el-tab-pane>

    </el-tabs>

    <!-- 记账弹窗 -->
    <el-dialog v-model="ledgerDialogVisible" title="记一笔外卖/餐饮支出" width="400px">
      <el-form :model="ledgerForm" label-width="80px">
        <el-form-item label="类型">
          <el-radio-group v-model="ledgerForm.type">
            <el-radio :label="2">支出</el-radio>
            <el-radio :label="1">收入</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="日期">
          <el-date-picker v-model="ledgerForm.record_date" type="date" value-format="YYYY-MM-DD" style="width:100%" />
        </el-form-item>
        <el-form-item label="金额">
          <el-input-number v-model="ledgerForm.amount" :min="0" :precision="2" :step="1" style="width:100%" />
        </el-form-item>
        <el-form-item label="分类">
          <el-select v-model="ledgerForm.category" filterable allow-create default-first-option style="width:100%">
            <el-option v-for="cat in ledgerCategories" :key="cat.id" :label="cat.name" :value="cat.name" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="ledgerForm.remark" placeholder="如：店铺名称或评价" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="ledgerDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveLedgerRecord">保存</el-button>
      </template>
    </el-dialog>

    <!-- 新增备忘弹窗 -->
    <el-dialog v-model="memoDialogVisible" title="新增备忘" width="400px">
      <el-form>
        <el-form-item label="日期">
          <el-date-picker v-model="newMemoDate" type="date" value-format="YYYY-MM-DD" style="width:100%" />
        </el-form-item>
        <el-form-item label="备忘内容">
          <el-input v-model="newMemoContent" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="memoDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveMemo" :disabled="!newMemoContent">保存</el-button>
      </template>
    </el-dialog>

    <!-- 新增习惯弹窗 -->
    <el-dialog v-model="habitDialogVisible" title="新增习惯" width="400px">
      <el-form :model="newHabit" label-width="80px">
        <el-form-item label="名称">
          <el-input v-model="newHabit.name" />
        </el-form-item>
        <el-form-item label="图标">
          <div class="icon-selector">
            <div 
              v-for="icon in presetIcons" 
              :key="icon" 
              class="icon-item"
              :class="{ active: newHabit.icon === icon }"
              @click="newHabit.icon = icon"
            >
              <span v-if="!icon.startsWith('/')" class="icon-content">{{ icon }}</span>
              <img v-else :src="BASE_URL + icon" class="icon-content-img" />
            </div>
            <el-upload
              class="icon-upload-btn"
              name="image"
              :action="`${API_BASE}/upload/habit-icon`"
              :show-file-list="false"
              :on-success="(res) => { handleUploadIconSuccess(res); newHabit.icon = res.url }"
              :before-upload="beforeUploadIcon"
            >
              <div class="icon-item dashed-btn">
                <el-icon><Plus /></el-icon>
              </div>
            </el-upload>
          </div>
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="newHabit.description" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="habitDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveHabit" :disabled="!newHabit.name">保存</el-button>
      </template>
    </el-dialog>

    <!-- 编辑习惯弹窗 -->
    <el-dialog v-model="editHabitDialogVisible" title="编辑习惯" width="400px">
      <el-form :model="editingHabit" label-width="80px">
        <el-form-item label="名称">
          <el-input v-model="editingHabit.name" />
        </el-form-item>
        <el-form-item label="图标">
          <div class="icon-selector">
            <div 
              v-for="icon in presetIcons" 
              :key="icon" 
              class="icon-item"
              :class="{ active: editingHabit.icon === icon }"
              @click="editingHabit.icon = icon"
            >
              <span v-if="!icon.startsWith('/')" class="icon-content">{{ icon }}</span>
              <img v-else :src="BASE_URL + icon" class="icon-content-img" />
            </div>
            <el-upload
              class="icon-upload-btn"
              name="image"
              :action="`${API_BASE}/upload/habit-icon`"
              :show-file-list="false"
              :on-success="(res) => { handleUploadIconSuccess(res); editingHabit.icon = res.url }"
              :before-upload="beforeUploadIcon"
            >
              <div class="icon-item dashed-btn">
                <el-icon><Plus /></el-icon>
              </div>
            </el-upload>
          </div>
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="editingHabit.description" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editHabitDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="updateHabit" :disabled="!editingHabit.name">保存</el-button>
      </template>
    </el-dialog>

    <!-- 新建流程弹窗 -->
    <el-dialog v-model="processDialogVisible" title="新建流程" width="400px">
      <el-form :model="newProcess" label-width="80px">
        <el-form-item label="流程名称" required>
          <el-input v-model="newProcess.name" />
        </el-form-item>
        <el-form-item label="开始时间">
          <el-date-picker v-model="newProcess.start_time" type="date" value-format="YYYY-MM-DD" style="width:100%" />
        </el-form-item>
        <el-form-item label="截止期限">
          <el-date-picker v-model="newProcess.deadline" type="date" value-format="YYYY-MM-DD" style="width:100%" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="processDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveProcess" :disabled="!newProcess.name">创建</el-button>
      </template>
    </el-dialog>

    <!-- 编辑流程弹窗 -->
    <el-dialog v-model="editProcessDialogVisible" title="编辑流程" width="400px">
      <el-form :model="editingProcess" label-width="80px">
        <el-form-item label="流程名称" required>
          <el-input v-model="editingProcess.name" />
        </el-form-item>
        <el-form-item label="开始时间">
          <el-date-picker v-model="editingProcess.start_time" type="date" value-format="YYYY-MM-DD" style="width:100%" />
        </el-form-item>
        <el-form-item label="截止期限">
          <el-date-picker v-model="editingProcess.deadline" type="date" value-format="YYYY-MM-DD" style="width:100%" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editProcessDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="updateProcess" :disabled="!editingProcess.name">保存</el-button>
      </template>
    </el-dialog>

    <!-- 不知道吃什么弹窗 -->
    <el-dialog v-model="randomPickerVisible" title="不知道吃什么？" width="600px" @opened="initShopChart" @closed="destroyShopChart">
      <!-- 抽奖区域 -->
      <div class="random-picker-section">
        <div class="random-picker-title">
          <el-icon><StarFilled /></el-icon>
          <span>收藏店铺抽奖</span>
        </div>
        <div class="random-picker-box" :class="{ 'is-rolling': isRolling }">
          <div v-if="!isRolling && !rolledShop" class="random-picker-placeholder">点击开始抽奖</div>
          <div v-else-if="isRolling" class="random-picker-rolling">{{ rollingShop }}</div>
          <div v-else class="random-picker-result">
            <div class="result-shop">{{ rolledShop }}</div>
            <div class="result-label">今天吃这家！</div>
          </div>
        </div>
        <div class="random-picker-actions">
          <el-button 
            type="primary" 
            :icon="Refresh" 
            size="large" 
            @click="startRoll" 
            :disabled="isRolling || favoriteShops.length === 0"
            :loading="isRolling"
          >
            {{ isRolling ? '抽奖中...' : (rolledShop ? '再抽一次' : '开始抽奖') }}
          </el-button>
          <el-button v-if="rolledShop" type="success" size="large" @click="useRolledShop">就用这家</el-button>
        </div>
        <div v-if="favoriteShops.length === 0" class="random-picker-empty">
          <el-icon><Star /></el-icon>
          <span>暂无收藏的店铺，先去收藏几个吧！</span>
        </div>
      </div>
      
      <el-divider />
      
      <!-- 统计图表区域 -->
      <div class="shop-stats-section">
        <div class="shop-stats-title">
          <el-icon><TrendCharts /></el-icon>
          <span>店铺消费次数 TOP10</span>
        </div>
        <div ref="shopChartRef" class="shop-chart-container" style="width: 100%; height: 300px;"></div>
      </div>
    </el-dialog>

    <!-- 闹钟编辑弹窗 -->
    <el-dialog v-model="alarmDialogVisible" :title="editingAlarm.id ? '编辑闹钟' : '添加闹钟'" width="400px">
      <el-form :model="editingAlarm" label-width="80px">
        <el-form-item label="时间">
          <el-time-picker v-model="editingAlarm.timeObj" format="HH:mm" style="width: 100%" />
        </el-form-item>
        <el-form-item label="内容">
          <el-input v-model="editingAlarm.content" placeholder="如：下班、吃药..." />
        </el-form-item>
        <el-form-item label="重复">
          <el-checkbox-group v-model="editingAlarm.daysArr">
            <el-checkbox label="1">一</el-checkbox>
            <el-checkbox label="2">二</el-checkbox>
            <el-checkbox label="3">三</el-checkbox>
            <el-checkbox label="4">四</el-checkbox>
            <el-checkbox label="5">五</el-checkbox>
            <el-checkbox label="6">六</el-checkbox>
            <el-checkbox label="0">日</el-checkbox>
          </el-checkbox-group>
        </el-form-item>
        <el-form-item label="状态">
          <el-switch v-model="editingAlarm.is_active" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="alarmDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveAlarm" :disabled="!editingAlarm.content || !editingAlarm.timeObj">保存</el-button>
      </template>
    </el-dialog>

    <!-- 倒数日编辑弹窗 -->
    <el-dialog v-model="countdownDayDialogVisible" :title="editingCountdownDay.id ? '编辑倒数日' : '添加倒数日'" width="400px">
      <el-form :model="editingCountdownDay" label-width="80px">
        <el-form-item label="名称">
          <el-input v-model="editingCountdownDay.label" placeholder="例如：项目截止、生日..." />
        </el-form-item>
        <el-form-item label="开始日期">
          <el-date-picker v-model="editingCountdownDay.start_date" type="date" placeholder="选择开始日期" value-format="YYYY-MM-DD" style="width: 100%;" />
        </el-form-item>
        <el-form-item label="目标日期">
          <el-date-picker v-model="editingCountdownDay.end_date" type="date" placeholder="选择目标日期" value-format="YYYY-MM-DD" style="width: 100%;" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="countdownDayDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveCountdownDay" :disabled="!editingCountdownDay.label || !editingCountdownDay.start_date || !editingCountdownDay.end_date">保存</el-button>
      </template>
    </el-dialog>

    <!-- 计划块编辑弹窗 -->
    <el-dialog v-model="scheduleBlockDialogVisible" :title="editingScheduleBlock.id ? '编辑计划' : '添加计划'" width="520px">
      <el-form :model="editingScheduleBlock" label-width="80px">
        <el-form-item label="日期">
          <el-date-picker v-model="editingScheduleBlock.block_date" type="date" placeholder="选择日期" value-format="YYYY-MM-DD" style="width: 100%;" />
        </el-form-item>
        <el-form-item label="时间">
          <el-time-picker
            v-model="scheduleBlockTimeRange"
            is-range
            range-separator="~"
            start-placeholder="开始时间"
            end-placeholder="结束时间"
            format="HH:mm"
            value-format="HH:mm"
            style="width: 100%;"
          />
        </el-form-item>
        <el-form-item label="事项">
          <el-input v-model="editingScheduleBlock.content" type="textarea" :rows="3" placeholder="请输入计划事项" />
        </el-form-item>
      </el-form>
      <template #footer>
        <div style="display: flex; justify-content: space-between;">
          <el-button v-if="editingScheduleBlock.id" type="danger" @click="deleteScheduleBlock(editingScheduleBlock)">删除</el-button>
          <div style="margin-left: auto;">
            <el-button @click="scheduleBlockDialogVisible = false">取消</el-button>
            <el-button type="primary" @click="saveScheduleBlock">保存</el-button>
          </div>
        </div>
      </template>
    </el-dialog>

    <!-- 预设配置弹窗 -->
    <el-dialog v-model="schedulePresetDialogVisible" title="预设配置" width="600px">
      <div class="schedule-preset-list">
        <div v-for="(preset, pIndex) in schedulePresets" :key="preset.name" class="schedule-preset-item">
          <div class="schedule-preset-header">
            <span class="schedule-preset-name">{{ preset.name }}</span>
            <div class="schedule-preset-actions">
              <el-button type="primary" size="small" @click="applySchedulePreset(preset)">应用</el-button>
              <el-button size="small" @click="openEditPresetDialog(preset, pIndex)">编辑</el-button>
              <el-button type="danger" size="small" @click="deleteSchedulePreset(pIndex)">删除</el-button>
            </div>
          </div>
          <div class="schedule-preset-content">
            <div v-for="(item, index) in preset.items" :key="index" class="schedule-preset-slot">
              {{ item.start_time }}~{{ item.end_time }} {{ item.content }}
            </div>
          </div>
        </div>
      </div>
      <div class="schedule-preset-add">
        <el-button type="primary" :icon="Plus" @click="openAddPresetDialog">新增预设</el-button>
      </div>
    </el-dialog>

    <!-- 预设编辑/新增弹窗 -->
    <el-dialog
      v-model="schedulePresetEditDialogVisible"
      :title="editingPresetIndex === -1 ? '新增预设' : '编辑预设'"
      width="560px"
      class="preset-edit-dialog"
    >
      <el-form label-width="80px">
        <el-form-item label="预设名称">
          <el-input v-model="editingPreset.name" placeholder="请输入预设名称" />
        </el-form-item>
      </el-form>
      <div class="schedule-preset-edit-list">
        <div v-for="(item, index) in editingPreset.items" :key="index" class="schedule-preset-edit-row">
          <el-time-picker
            v-model="item.startTimeObj"
            format="HH:mm"
            value-format="HH:mm"
            placeholder="开始"
            size="small"
            style="width: 110px;"
          />
          <span style="margin: 0 6px; color: #909399;">~</span>
          <el-time-picker
            v-model="item.endTimeObj"
            format="HH:mm"
            value-format="HH:mm"
            placeholder="结束"
            size="small"
            style="width: 110px;"
          />
          <el-input v-model="item.content" placeholder="事件内容" size="small" style="width: 180px; margin-left: 8px;" />
          <el-button type="danger" :icon="Close" size="small" style="margin-left: 8px;" @click="removePresetItem(index)" />
        </div>
      </div>
      <div style="margin-top: 12px;">
        <el-button :icon="Plus" size="small" @click="addPresetItem">添加时段</el-button>
      </div>

      <template #footer>
        <div style="display: flex; justify-content: flex-end; gap: 8px;">
          <el-button @click="schedulePresetEditDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="savePreset">保存</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>


<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import axios from 'axios'
import { Plus, Delete, Check, Edit, EditPen, RefreshLeft, Close, Lightning, TrendCharts, Calendar, ArrowLeft, ArrowRight, ArrowUp, ArrowDown, Star, StarFilled, QuestionFilled, Refresh, Rank, Collection } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Lunar, HolidayUtil } from 'lunar-javascript'
import { h } from 'vue'
import * as echarts from 'echarts'
import Sortable from 'sortablejs'
import Memo from '../Memo/index.vue'

// Fire图标别名
const FireIcon = {
  render() {
    return h('svg', { viewBox: '0 0 24 24', width: '1em', height: '1em' }, [
      h('path', { fill: 'currentColor', d: 'M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67zM11.71 19c-1.78 0-3.22-1.4-3.22-3.14 0-1.62 1.05-2.76 2.81-3.12 1.77-.36 3.6-1.21 4.62-2.58.39 1.29.59 2.65.59 4.04 0 2.65-2.15 4.8-4.8 4.8z' })
    ])
  }
}

const BASE_URL = 'http://127.0.0.1:5888'
const API_BASE = `${BASE_URL}/api`
const activeTab = ref('schedule')

// 获取日期所在周的周一（周一为一周起点）
const getWeekStart = (date) => {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(d.setDate(diff))
}

const scheduleWeekStart = ref(getWeekStart(new Date()))
const selectedScheduleDate = ref(new Date().toISOString().slice(0, 10))

const scheduleDays = computed(() => {
  const start = new Date(scheduleWeekStart.value)
  const days = []
  const weekChars = ['日', '一', '二', '三', '四', '五', '六']
  for (let i = 0; i < 7; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const date = String(d.getDate()).padStart(2, '0')
    const dateStr = `${d.getFullYear()}-${month}-${date}`
    days.push({
      dateObj: d,
      dateStr,
      label: `${month}-${date} ${weekChars[d.getDay()]}`,
      isToday: dateStr === new Date().toISOString().slice(0, 10),
      isSelected: dateStr === selectedScheduleDate.value
    })
  }
  return days
})

const selectScheduleDate = (day) => {
  selectedScheduleDate.value = day.dateStr
}

const scheduleTimeSlots = computed(() => {
  const slots = []
  for (let i = 0; i < 24; i++) {
    const hour = (6 + i) % 24
    slots.push(`${String(hour).padStart(2, '0')}:00`)
  }
  return slots
})

const prevScheduleWeek = () => {
  const d = new Date(scheduleWeekStart.value)
  d.setDate(d.getDate() - 7)
  scheduleWeekStart.value = d
}

const nextScheduleWeek = () => {
  const d = new Date(scheduleWeekStart.value)
  d.setDate(d.getDate() + 7)
  scheduleWeekStart.value = d
}

const currentScheduleWeek = () => {
  scheduleWeekStart.value = getWeekStart(new Date())
}

// === 计划表逻辑 ===
const scheduleBlocks = ref([])
const scheduleBlockDialogVisible = ref(false)
const editingScheduleBlock = ref({
  id: null,
  block_date: '',
  content: ''
})
const scheduleBodyRef = ref(null)
const isDraggingBlock = ref(false)
const scheduleBlockPreview = ref(null)
const scheduleBlockTimeRange = ref(['06:00', '07:00'])
const selectedBlockId = ref(null)
const quickEditBlock = ref(null)
const schedulePresetDialogVisible = ref(false)
const schedulePresetEditDialogVisible = ref(false)
const editingPresetIndex = ref(-1)
const editingPreset = ref({ name: '', items: [] })

const schedulePresets = ref([
  {
    name: '工作日',
    items: [
      { start_time: '07:30', end_time: '08:00', content: '起床洗漱' },
      { start_time: '08:00', end_time: '08:30', content: '早餐' },
      { start_time: '09:00', end_time: '12:00', content: '上午工作' },
      { start_time: '12:00', end_time: '13:00', content: '午餐午休' },
      { start_time: '14:00', end_time: '18:00', content: '下午工作' },
      { start_time: '18:30', end_time: '19:30', content: '晚餐' },
      { start_time: '20:00', end_time: '22:00', content: '学习/娱乐' },
      { start_time: '23:00', end_time: '23:30', content: '睡前准备' }
    ]
  },
  {
    name: '休息日',
    items: [
      { start_time: '09:00', end_time: '10:00', content: '起床' },
      { start_time: '10:00', end_time: '11:00', content: '早餐' },
      { start_time: '11:00', end_time: '13:00', content: '自由活动' },
      { start_time: '13:00', end_time: '14:00', content: '午餐' },
      { start_time: '15:00', end_time: '17:00', content: '运动/外出' },
      { start_time: '18:00', end_time: '19:30', content: '晚餐' },
      { start_time: '20:00', end_time: '23:00', content: '娱乐/阅读' }
    ]
  }
])

const parseTimeToMinutes = (timeStr) => {
  const [h, m] = timeStr.split(':').map(Number)
  let minutes = h * 60 + m
  if (minutes < 360) minutes += 24 * 60
  return minutes - 360
}

const minutesToTime = (minutes) => {
  let total = minutes + 360
  total = total % (24 * 60)
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

const formatTimeRange = (start, end) => `${start}~${end}`

const scheduleBlockColorPalette = [
  { bg: '#ecf5ff', border: '#409eff', text: '#303133' },
  { bg: '#f0f9eb', border: '#67c23a', text: '#303133' },
  { bg: '#fdf6ec', border: '#e6a23c', text: '#303133' },
  { bg: '#fef0f0', border: '#f56c6c', text: '#303133' },
  { bg: '#f5f0ff', border: '#9254de', text: '#303133' },
  { bg: '#e6fffb', border: '#13c2c2', text: '#303133' },
  { bg: '#fff7e6', border: '#fa8c16', text: '#303133' },
  { bg: '#fff0f6', border: '#eb2f96', text: '#303133' }
]

const getScheduleBlockColor = (content) => {
  if (!content) return scheduleBlockColorPalette[0]
  const code = content.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return scheduleBlockColorPalette[code % scheduleBlockColorPalette.length]
}

const loadScheduleBlocks = async () => {
  try {
    if (!scheduleDays.value.length) return
    const start = scheduleDays.value[0].dateStr
    const end = scheduleDays.value[6].dateStr
    const { data } = await axios.get(`${API_BASE}/plan/schedule-blocks`, {
      params: { start_date: start, end_date: end }
    })
    if (data.success) {
      scheduleBlocks.value = data.data
    }
  } catch (err) {
    console.error('Failed to load schedule blocks', err)
  }
}

const loadSchedulePresets = async () => {
  try {
    const { data } = await axios.get(`${API_BASE}/plan/schedule-presets`)
    if (!data.success || !Array.isArray(data.data)) return

    if (data.data.length > 0) {
      schedulePresets.value = data.data
      return
    }

    // 新安装数据库为空时，将当前内置预设迁移进去，之后全部以数据库为准。
    const builtinPresets = schedulePresets.value.map(({ name, items }, index) => ({
      name,
      items,
      sort_order: index
    }))
    const createdPresets = await Promise.all(
      builtinPresets.map(preset => axios.post(`${API_BASE}/plan/schedule-presets`, preset))
    )
    schedulePresets.value = createdPresets
      .filter(({ data: response }) => response.success && response.data)
      .map(({ data: response }) => response.data)
  } catch (err) {
    console.error('Failed to load schedule presets', err)
    ElMessage.error('预设加载失败，请检查服务是否正常')
  }
}

watch(scheduleWeekStart, () => {
  if (activeTab.value === 'schedule' || loadedTabs.value.schedule) {
    loadScheduleBlocks()
  }
})

const timeToMinutes = (timeStr) => {
  const [h, m] = timeStr.split(':').map(Number)
  return h * 60 + m
}

const blocksOverlap = (a, b) => {
  const aStart = timeToMinutes(a.start_time)
  const aEnd = timeToMinutes(a.end_time)
  const bStart = timeToMinutes(b.start_time)
  const bEnd = timeToMinutes(b.end_time)
  return aStart < bEnd && bStart < aEnd
}

const buildOverlapGroups = (blocks) => {
  const sorted = [...blocks].sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time))
  const groups = []
  for (const block of sorted) {
    let placed = false
    for (const group of groups) {
      if (group.some(g => blocksOverlap(g, block))) {
        group.push(block)
        placed = true
        break
      }
    }
    if (!placed) {
      groups.push([block])
    }
  }
  return groups
}

const getBlockOverlapInfo = (block, dateStr) => {
  const dayBlocks = getScheduleBlocksByDate(dateStr)
  const groups = buildOverlapGroups(dayBlocks)
  const matchingGroup = groups.find(g => g.some(b => b.id === block.id))
  if (!matchingGroup) {
    return { indexInGroup: 0, overlapCount: 1 }
  }
  const indexInGroup = matchingGroup.findIndex(b => b.id === block.id)
  return { indexInGroup, overlapCount: Math.min(matchingGroup.length, 3) }
}

const getScheduleBlockLayout = (block, dateStr) => {
  const info = getBlockOverlapInfo(block, dateStr)
  return { indexInGroup: info.indexInGroup, overlapCount: info.overlapCount }
}

const getScheduleBlockColorWithAdjacency = (block, dateStr) => {
  const info = getBlockOverlapInfo(block, dateStr)
  const baseIndex = getScheduleBlockColorIndex(block.content)
  const palette = scheduleBlockColorPalette
  const step = Math.floor(palette.length / 2)
  const colorIndex = (baseIndex + info.indexInGroup * step) % palette.length
  return palette[colorIndex]
}

const getScheduleBlockColorIndex = (content) => {
  if (!content) return 0
  const code = content.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return code % scheduleBlockColorPalette.length
}

const getScheduleBlocksByDate = (dateStr) => {
  return scheduleBlocks.value.filter(b => b.block_date === dateStr)
}

const getScheduleBlockStyle = (block, day) => {
  const start = parseTimeToMinutes(block.start_time)
  const end = parseTimeToMinutes(block.end_time)
  const duration = Math.max(end - start, 1)
  const color = getScheduleBlockColorWithAdjacency(block, day.dateStr)
  const heightPx = Math.max(duration / 60 * 50, 18)
  const layout = getScheduleBlockLayout(block, day.dateStr)
  const columnWidth = scheduleBodyRef.value?.querySelector('.schedule-day-column')?.offsetWidth || 0
  const gap = 4
  const totalGap = gap * (layout.overlapCount + 1)
  const itemWidth = (columnWidth - totalGap) / layout.overlapCount
  const left = gap + layout.indexInGroup * (itemWidth + gap)
  return {
    top: `${start / 60 * 50}px`,
    height: `${heightPx}px`,
    left: `${left}px`,
    width: `${itemWidth}px`,
    minHeight: '18px',
    backgroundColor: color.bg,
    borderLeftColor: color.border,
    '--block-color': color.border
  }
}

const isBlockHeightSmall = (block) => {
  const start = parseTimeToMinutes(block.start_time)
  const end = parseTimeToMinutes(block.end_time)
  const duration = Math.max(end - start, 1)
  return (duration / 60 * 50) < 28
}

const getScheduleBlockPreviewStyle = (preview) => {
  const start = parseTimeToMinutes(preview.start_time)
  const end = parseTimeToMinutes(preview.end_time)
  const duration = Math.max(end - start, 1)
  const dayIndex = scheduleDays.value.findIndex(d => d.dateStr === preview.block_date)
  const columnWidth = preview.columnWidth || (scheduleBodyRef.value?.querySelector('.schedule-day-column')?.offsetWidth || 0)
  const color = getScheduleBlockColorWithAdjacency(preview, preview.block_date)
  const layout = getScheduleBlockLayout(preview, preview.block_date)
  const gap = 4
  const totalGap = gap * (layout.overlapCount + 1)
  const itemWidth = (columnWidth - totalGap) / layout.overlapCount
  const leftOffset = gap + layout.indexInGroup * (itemWidth + gap)
  return {
    left: `${60 + Math.max(0, dayIndex) * columnWidth + leftOffset}px`,
    width: `${itemWidth}px`,
    top: `${start / 60 * 50}px`,
    height: `${Math.max(duration / 60 * 50, 18)}px`,
    minHeight: '18px',
    backgroundColor: color.bg,
    borderLeftColor: color.border,
    '--block-color': color.border
  }
}

const isPreviewingBlock = (blockId) => {
  return scheduleBlockPreview.value && scheduleBlockPreview.value.id === blockId
}

const isBlockSelected = (blockId) => selectedBlockId.value === blockId

const selectScheduleBlock = (block) => {
  selectedBlockId.value = block.id
}

const enterQuickEditMode = (block) => {
  if (quickEditBlock.value) return
  selectedBlockId.value = block.id
  quickEditBlock.value = { id: block.id, content: block.content, originalContent: block.content }
  nextTick(() => {
    const input = document.querySelector('.schedule-block-quick-edit input')
    if (input) {
      input.focus()
      input.select()
    }
  })
}

const exitQuickEditMode = async (shouldSave = true) => {
  if (!quickEditBlock.value) return
  const { id, content, originalContent } = quickEditBlock.value
  quickEditBlock.value = null
  if (!shouldSave) return
  if (!content.trim()) {
    ElMessage.warning('计划内容不能为空')
    loadScheduleBlocks()
    return
  }
  if (content === originalContent) return
  try {
    await axios.put(`${API_BASE}/plan/schedule-blocks/${id}`, { content })
    ElMessage.success('更新成功')
    loadScheduleBlocks()
  } catch (err) {
    ElMessage.error('更新失败')
    loadScheduleBlocks()
  }
}

const clearSelectedBlock = (event) => {
  if (quickEditBlock.value) {
    const isClickInsideInput = event && event.target && event.target.closest('.schedule-block-quick-edit')
    if (!isClickInsideInput) {
      exitQuickEditMode(true)
      selectedBlockId.value = null
      return
    }
  }
  selectedBlockId.value = null
}

const quickDeleteScheduleBlock = async (block) => {
  try {
    await axios.delete(`${API_BASE}/plan/schedule-blocks/${block.id}`)
    ElMessage.success('已删除')
    if (selectedBlockId.value === block.id) selectedBlockId.value = null
    if (quickEditBlock.value && quickEditBlock.value.id === block.id) quickEditBlock.value = null
    loadScheduleBlocks()
  } catch (err) {
    ElMessage.error('删除失败')
  }
}

const handleScheduleKeyDown = (event) => {
  if (activeTab.value !== 'schedule') return
  if (scheduleBlockDialogVisible.value || schedulePresetDialogVisible.value || schedulePresetEditDialogVisible.value) return

  if (quickEditBlock.value) {
    if (event.ctrlKey && event.key === 's') {
      event.preventDefault()
      exitQuickEditMode(true)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      exitQuickEditMode(false)
    }
    return
  }

  if (!selectedBlockId.value) return
  const block = scheduleBlocks.value.find(b => b.id === selectedBlockId.value)
  if (!block) {
    selectedBlockId.value = null
    return
  }
  if (event.key === 'Backspace') {
    event.preventDefault()
    quickDeleteScheduleBlock(block)
  } else if (event.key === 'Enter') {
    event.preventDefault()
    enterQuickEditMode(block)
  }
}

const openSchedulePresetDialog = () => {
  schedulePresetDialogVisible.value = true
}

const openAddPresetDialog = () => {
  editingPresetIndex.value = -1
  editingPreset.value = { name: '', items: [{ startTimeObj: '08:00', endTimeObj: '09:00', content: '' }] }
  schedulePresetEditDialogVisible.value = true
}

const openEditPresetDialog = (preset, index) => {
  editingPresetIndex.value = index
  editingPreset.value = {
    name: preset.name,
    items: preset.items.map(item => ({
      startTimeObj: item.start_time,
      endTimeObj: item.end_time,
      content: item.content
    }))
  }
  schedulePresetEditDialogVisible.value = true
}

const addPresetItem = () => {
  editingPreset.value.items.push({ startTimeObj: '08:00', endTimeObj: '09:00', content: '' })
}

const removePresetItem = (index) => {
  editingPreset.value.items.splice(index, 1)
}

const savePreset = async () => {
  const preset = {
    name: editingPreset.value.name.trim(),
    items: editingPreset.value.items
      .filter(item => item.content.trim())
      .map(item => ({
        start_time: item.startTimeObj || '00:00',
        end_time: item.endTimeObj || '00:00',
        content: item.content.trim()
      }))
      .sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time))
  }
  if (!preset.name) {
    ElMessage.warning('请输入预设名称')
    return
  }
  if (preset.items.length === 0) {
    ElMessage.warning('请至少添加一个时段')
    return
  }

  try {
    let response
    if (editingPresetIndex.value === -1) {
      const maxSortOrder = schedulePresets.value.reduce(
        (max, item) => Math.max(max, Number(item.sort_order) || 0),
        -1
      )
      response = await axios.post(`${API_BASE}/plan/schedule-presets`, {
        ...preset,
        sort_order: maxSortOrder + 1
      })
    } else {
      const currentPreset = schedulePresets.value[editingPresetIndex.value]
      if (!currentPreset?.id) {
        ElMessage.error('预设缺少数据库 ID，无法更新')
        return
      }
      response = await axios.put(`${API_BASE}/plan/schedule-presets/${currentPreset.id}`, {
        ...preset,
        sort_order: currentPreset.sort_order || editingPresetIndex.value
      })
    }

    if (!response.data.success) {
      throw new Error(response.data.message || '保存失败')
    }
    const savedPreset = response.data.data
    if (editingPresetIndex.value === -1) {
      schedulePresets.value.push(savedPreset)
    } else {
      schedulePresets.value[editingPresetIndex.value] = savedPreset
    }
    schedulePresetEditDialogVisible.value = false
    ElMessage.success('预设保存成功')
  } catch (err) {
    console.error('Failed to save schedule preset', err)
    ElMessage.error(`预设保存失败：${err.response?.data?.message || err.message || '网络异常'}`)
  }
}

const deleteSchedulePreset = async (index) => {
  try {
    await ElMessageBox.confirm('确定删除该预设吗？', '提示', { type: 'warning' })
    const preset = schedulePresets.value[index]
    if (!preset?.id) {
      ElMessage.error('预设缺少数据库 ID，无法删除')
      return
    }
    const { data } = await axios.delete(`${API_BASE}/plan/schedule-presets/${preset.id}`)
    if (!data.success) {
      throw new Error(data.message || '删除失败')
    }
    schedulePresets.value.splice(index, 1)
    ElMessage.success('已删除')
  } catch (err) {
    if (err !== 'cancel') {
      console.error('Failed to delete schedule preset', err)
      ElMessage.error(`删除预设失败：${err.response?.data?.message || err.message || '网络异常'}`)
    }
  }
}



const applySchedulePreset = async (preset) => {
  const targetDate = selectedScheduleDate.value
  try {
    await Promise.all(preset.items.map(item =>
      axios.post(`${API_BASE}/plan/schedule-blocks`, {
        block_date: targetDate,
        content: item.content,
        start_time: item.start_time,
        end_time: item.end_time
      })
    ))
    ElMessage.success(`已应用预设：${preset.name} 到 ${targetDate}`)
    schedulePresetDialogVisible.value = false
    currentScheduleWeek()
    loadScheduleBlocks()
  } catch (err) {
    ElMessage.error('应用预设失败')
  }
}

const clearTodaySchedule = async () => {
  const targetDate = selectedScheduleDate.value
  try {
    await ElMessageBox.confirm(`确定清空 ${targetDate} 的所有计划吗？`, '提示', { type: 'warning' })
    await axios.delete(`${API_BASE}/plan/schedule-blocks/date/${targetDate}`)
    ElMessage.success(`已清空 ${targetDate} 的计划`)
    if (selectedBlockId.value) selectedBlockId.value = null
    loadScheduleBlocks()
  } catch (err) {
    if (err !== 'cancel') {
      ElMessage.error('清空失败')
    }
  }
}

const openEditScheduleBlock = (block) => {
  if (isDraggingBlock.value) return
  editingScheduleBlock.value = { ...block }
  scheduleBlockTimeRange.value = [block.start_time, block.end_time]
  scheduleBlockDialogVisible.value = true
}

const saveScheduleBlock = async () => {
  const block = editingScheduleBlock.value
  const [startTime, endTime] = scheduleBlockTimeRange.value || []
  if (!block.content.trim()) {
    ElMessage.warning('请输入计划内容')
    return
  }
  if (!startTime || !endTime || parseTimeToMinutes(startTime) >= parseTimeToMinutes(endTime)) {
    ElMessage.warning('结束时间必须晚于开始时间')
    return
  }
  const payload = {
    ...block,
    start_time: startTime,
    end_time: endTime
  }
  try {
    if (block.id) {
      await axios.put(`${API_BASE}/plan/schedule-blocks/${block.id}`, payload)
      ElMessage.success('更新成功')
    } else {
      await axios.post(`${API_BASE}/plan/schedule-blocks`, payload)
      ElMessage.success('添加成功')
    }
    scheduleBlockDialogVisible.value = false
    loadScheduleBlocks()
  } catch (err) {
    ElMessage.error('保存失败')
  }
}

const deleteScheduleBlock = async (block) => {
  try {
    await ElMessageBox.confirm('确定删除该计划块吗？', '提示', { type: 'warning' })
    await axios.delete(`${API_BASE}/plan/schedule-blocks/${block.id}`)
    ElMessage.success('已删除')
    scheduleBlockDialogVisible.value = false
    loadScheduleBlocks()
  } catch (err) {
    if (err !== 'cancel') {
      ElMessage.error('删除失败')
    }
  }
}

const handleDayDoubleClick = (event, day) => {
  const columnEl = event.currentTarget
  const rect = columnEl.getBoundingClientRect()
  const y = event.clientY - rect.top + columnEl.scrollTop
  const minutesFromSix = Math.max(0, Math.round((y / 50) * 60))
  const totalMinutes = minutesFromSix + 360
  const normalized = totalMinutes % (24 * 60)
  const h = Math.floor(normalized / 60)
  const m = minutesFromSix % 60
  const start = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  let endTotal = totalMinutes + 60
  endTotal = endTotal % (24 * 60)
  const eh = Math.floor(endTotal / 60)
  const em = endTotal % 60
  const end = `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`

  editingScheduleBlock.value = {
    id: null,
    block_date: day.dateStr,
    content: ''
  }
  scheduleBlockTimeRange.value = [start, end]
  scheduleBlockDialogVisible.value = true
}

let dragState = null

const startDragBlock = (event, block, day) => {
  if (event.target.classList.contains('schedule-block-resize')) return
  isDraggingBlock.value = false
  const columnWidth = event.currentTarget.parentElement.offsetWidth
  dragState = {
    block,
    startX: event.clientX,
    startY: event.clientY,
    originalDate: day.dateStr,
    originalStart: parseTimeToMinutes(block.start_time),
    originalEnd: parseTimeToMinutes(block.end_time),
    columnWidth,
    rowHeight: 50
  }
  document.addEventListener('mousemove', onDragMove)
  document.addEventListener('mouseup', onDragEnd)
}

const onDragMove = (event) => {
  if (!dragState) return
  const dx = event.clientX - dragState.startX
  const dy = event.clientY - dragState.startY
  const isDrag = Math.abs(dx) > 3 || Math.abs(dy) > 3
  if (isDrag && !isDraggingBlock.value) {
    isDraggingBlock.value = true
    scheduleBlockPreview.value = {
      id: dragState.block.id,
      block_date: dragState.originalDate,
      content: dragState.block.content,
      start_time: dragState.block.start_time,
      end_time: dragState.block.end_time,
      columnWidth: dragState.columnWidth
    }
  }
  if (!scheduleBlockPreview.value) return

  const dayDelta = Math.round(dx / dragState.columnWidth)
  const minuteDelta = Math.round(dy / dragState.rowHeight * 60)

  const originalIndex = scheduleDays.value.findIndex(d => d.dateStr === dragState.originalDate)
  const newDayIndex = Math.max(0, Math.min(6, originalIndex + dayDelta))
  const newDate = scheduleDays.value[newDayIndex].dateStr

  const duration = dragState.originalEnd - dragState.originalStart
  let newStart = dragState.originalStart + minuteDelta
  newStart = Math.max(0, Math.min(newStart, 1440 - duration))
  const newEnd = newStart + duration

  scheduleBlockPreview.value = {
    ...scheduleBlockPreview.value,
    block_date: newDate,
    start_time: minutesToTime(newStart),
    end_time: minutesToTime(newEnd)
  }
}

const onDragEnd = async (event) => {
  if (!dragState) return
  document.removeEventListener('mousemove', onDragMove)
  document.removeEventListener('mouseup', onDragEnd)

  const preview = scheduleBlockPreview.value
  scheduleBlockPreview.value = null

  if (!isDraggingBlock.value) {
    dragState = null
    return
  }

  const dx = event.clientX - dragState.startX
  const dy = event.clientY - dragState.startY
  if (Math.abs(dx) < 3 && Math.abs(dy) < 3) {
    dragState = null
    isDraggingBlock.value = false
    return
  }

  if (!preview) {
    dragState = null
    isDraggingBlock.value = false
    return
  }

  const blockIndex = scheduleBlocks.value.findIndex(b => b.id === dragState.block.id)
  if (blockIndex !== -1) {
    scheduleBlocks.value[blockIndex] = {
      ...scheduleBlocks.value[blockIndex],
      block_date: preview.block_date,
      start_time: preview.start_time,
      end_time: preview.end_time
    }
  }

  try {
    await axios.put(`${API_BASE}/plan/schedule-blocks/${dragState.block.id}`, {
      block_date: preview.block_date,
      start_time: preview.start_time,
      end_time: preview.end_time
    })
    ElMessage.success('移动成功')
    loadScheduleBlocks()
  } catch (err) {
    ElMessage.error('移动失败')
    loadScheduleBlocks()
  }

  setTimeout(() => {
    dragState = null
    isDraggingBlock.value = false
  }, 0)
}

let resizeState = null

const startResizeBlock = (event, block, day) => {
  isDraggingBlock.value = false
  const columnEl = event.currentTarget.closest('.schedule-day-column')
  const columnWidth = columnEl ? columnEl.offsetWidth : 0
  resizeState = {
    block,
    startY: event.clientY,
    originalEnd: parseTimeToMinutes(block.end_time),
    rowHeight: 50,
    minDuration: 1
  }
  document.addEventListener('mousemove', onResizeMove)
  document.addEventListener('mouseup', onResizeEnd)
}

const onResizeMove = (event) => {
  if (!resizeState) return
  const dy = event.clientY - resizeState.startY
  const isResize = Math.abs(dy) > 3
  if (isResize && !isDraggingBlock.value) {
    isDraggingBlock.value = true
    scheduleBlockPreview.value = {
      id: resizeState.block.id,
      block_date: resizeState.block.block_date,
      content: resizeState.block.content,
      start_time: resizeState.block.start_time,
      end_time: resizeState.block.end_time,
      columnWidth: resizeState.columnWidth
    }
  }
  if (!scheduleBlockPreview.value) return

  const minuteDelta = Math.round(dy / resizeState.rowHeight * 60)
  const start = parseTimeToMinutes(resizeState.block.start_time)
  let newEnd = resizeState.originalEnd + minuteDelta
  newEnd = Math.max(start + resizeState.minDuration, Math.min(newEnd, 1440))

  scheduleBlockPreview.value = {
    ...scheduleBlockPreview.value,
    end_time: minutesToTime(newEnd)
  }
}

const onResizeEnd = async (event) => {
  if (!resizeState) return
  document.removeEventListener('mousemove', onResizeMove)
  document.removeEventListener('mouseup', onResizeEnd)

  const preview = scheduleBlockPreview.value
  scheduleBlockPreview.value = null

  if (!isDraggingBlock.value) {
    resizeState = null
    return
  }

  const dy = event.clientY - resizeState.startY
  if (Math.abs(dy) < 3) {
    resizeState = null
    isDraggingBlock.value = false
    return
  }

  if (!preview) {
    resizeState = null
    isDraggingBlock.value = false
    return
  }

  const blockIndex = scheduleBlocks.value.findIndex(b => b.id === resizeState.block.id)
  if (blockIndex !== -1) {
    scheduleBlocks.value[blockIndex] = {
      ...scheduleBlocks.value[blockIndex],
      end_time: preview.end_time
    }
  }

  try {
    await axios.put(`${API_BASE}/plan/schedule-blocks/${resizeState.block.id}`, {
      end_time: preview.end_time
    })
    ElMessage.success('调整成功')
    loadScheduleBlocks()
  } catch (err) {
    ElMessage.error('调整失败')
    loadScheduleBlocks()
  }

  setTimeout(() => {
    resizeState = null
    isDraggingBlock.value = false
  }, 0)
}

const vFocus = {
  mounted: (el) => {
    const input = el.querySelector('input') || el
    input.focus()
  }
}

// === 待办与备忘逻辑 ===
const currentDate = ref(new Date())
const events = ref([])
const selectedDate = ref(new Date().toISOString().slice(0, 10))

const memoDialogVisible = ref(false)
const newMemoDate = ref('')
const newMemoContent = ref('')

const editingEventId = ref(null)
const editEventContent = ref('')

// 流程数据
const allProcesses = ref([])
const processDialogVisible = ref(false)
const newProcess = ref({ name: '', start_time: '', deadline: '' })
const editProcessDialogVisible = ref(false)
const editingProcess = ref({ id: null, name: '', start_time: '', deadline: '' })

const activeProcesses = computed(() => {
  return allProcesses.value.filter(p => p.status === 0 || p.status === 1)
})

const archivedProcesses = computed(() => {
  return allProcesses.value.filter(p => p.status === 2)
})

// 任务编辑相关
const newTaskInput = ref({})
const editingTaskId = ref(null)
const editTaskName = ref('')

// 任务列表拖拽排序相关
const taskListRefs = ref({})
const sortableInstances = ref({})

const setTaskListRef = (el, processId) => {
  if (el) {
    taskListRefs.value[processId] = el
  }
}

// 初始化任务列表拖拽排序
const initTaskSortable = (processId) => {
  const el = taskListRefs.value[processId]
  if (!el) return

  // 如果已存在实例，先销毁
  if (sortableInstances.value[processId]) {
    sortableInstances.value[processId].destroy()
  }

  sortableInstances.value[processId] = new Sortable(el, {
    handle: '.drag-handle',
    animation: 150,
    ghostClass: 'sortable-ghost',
    chosenClass: 'sortable-chosen',
    dragClass: 'sortable-drag',
    onEnd: async (evt) => {
      const process = allProcesses.value.find(p => p.id === processId)
      if (!process || !process.tasks) return

      // 获取新的任务顺序
      const newTasks = [...process.tasks]
      const [movedItem] = newTasks.splice(evt.oldIndex, 1)
      newTasks.splice(evt.newIndex, 0, movedItem)

      // 更新本地数据
      process.tasks = newTasks

      // 准备更新的数据
      const updateData = newTasks.map((task, index) => ({
        id: task.id,
        sort_order: index + 1
      }))

      // 调用 API 更新排序
      try {
        await axios.put(`${API_BASE}/processes/${processId}/tasks/sort`, { tasks: updateData })
        ElMessage.success('排序已更新')
      } catch (err) {
        ElMessage.error('排序更新失败')
        // 重新加载数据
        loadProcesses()
      }
    }
  })
}

// 习惯打卡相关
const selectedHabit = ref(null)
const habitCalendarDate = ref(new Date())

const loadEvents = async () => {
  try {
    const { data } = await axios.get(`${API_BASE}/plan/events`)
    if (data.success) {
      events.value = data.data
    }
  } catch (err) {
    console.error('Failed to load events', err)
  }
}

const loadProcesses = async () => {
  try {
    const { data } = await axios.get(`${API_BASE}/processes`)
    if (data.success) {
      allProcesses.value = data.data
      // 等待 DOM 更新后初始化拖拽排序
      nextTick(() => {
        data.data.forEach(process => {
          if (process.tasks && process.tasks.length > 1) {
            initTaskSortable(process.id)
          }
        })
      })
    }
  } catch (err) {
    console.error('Failed to load processes', err)
  }
}

// 获取指定日期的事项（备忘+流程+习惯）
const getEventsByDate = (dateStr) => {
  const items = []
  
  // 备忘事件
  events.value.filter(e => e.event_date.startsWith(dateStr)).forEach(e => {
    items.push({ ...e, type: 'memo', content: e.content, is_completed: e.is_completed })
  })
  
  // 流程（日期范围包含该日期）
  allProcesses.value.filter(p => p.status !== 2).forEach(p => {
    const processStart = p.start_time ? p.start_time.slice(0, 10) : null
    const processEnd = p.deadline ? p.deadline.slice(0, 10) : null
    const checkDate = dateStr
    
    // 流程包含该日期：开始时间 <= 日期 <= 截止时间
    const isInRange = (!processStart || processStart <= checkDate) && 
                      (!processEnd || processEnd >= checkDate)
    
    if (isInRange) {
      items.push({
        id: `process-${p.id}`,
        type: 'process',
        content: p.name,
        status: p.status
      })
    }
  })
  
  // 习惯打卡（已打卡的习惯）
  habits.value.forEach(h => {
    if (isHabitChecked(h.id, dateStr)) {
      items.push({
        id: `habit-${h.id}`,
        type: 'habit',
        content: h.name,
        icon: h.icon
      })
    }
  })
  
  return items
}

const selectedDateItems = computed(() => {
  return getEventsByDate(selectedDate.value)
})

const selectedDateMemos = computed(() => {
  return events.value.filter(e => e.event_date.startsWith(selectedDate.value))
})

const selectedDateProcesses = computed(() => {
  const checkDate = selectedDate.value
  return allProcesses.value.filter(p => {
    if (p.status === 2) return false // 排除已归档
    const processStart = p.start_time ? p.start_time.slice(0, 10) : null
    const processEnd = p.deadline ? p.deadline.slice(0, 10) : null
    return (!processStart || processStart <= checkDate) && 
           (!processEnd || processEnd >= checkDate)
  })
})

// 获取选中日期的习惯打卡状态
const selectedDateHabits = computed(() => {
  return habits.value.map(h => ({
    ...h,
    checked: isHabitChecked(h.id, selectedDate.value)
  }))
})

const handleDateClick = (data) => {
  selectedDate.value = data.day
}

const showAddMemoDialog = () => {
  newMemoDate.value = selectedDate.value
  newMemoContent.value = ''
  memoDialogVisible.value = true
}

const saveMemo = async () => {
  try {
    const { data } = await axios.post(`${API_BASE}/plan/events`, {
      event_date: newMemoDate.value,
      content: newMemoContent.value
    })
    if (data.success) {
      ElMessage.success('保存备忘成功')
      memoDialogVisible.value = false
      loadEvents()
    }
  } catch (err) {
    ElMessage.error('保存备忘失败')
  }
}

const startEditEvent = (e) => {
  editingEventId.value = e.id
  editEventContent.value = e.content
}

const saveEditEvent = async (id) => {
  if (!editingEventId.value) return
  const newContent = editEventContent.value.trim()
  editingEventId.value = null
  editEventContent.value = ''
  
  if (!newContent) return
  try {
    await axios.put(`${API_BASE}/plan/events/${id}`, { content: newContent })
    loadEvents()
  } catch (err) {
    ElMessage.error('修改备忘失败')
  }
}

const deleteEvent = async (id) => {
  try {
    await axios.delete(`${API_BASE}/plan/events/${id}`)
    ElMessage.success('已删除')
    loadEvents()
  } catch (err) {
    ElMessage.error('删除失败')
  }
}

// 切换备忘完成状态
const toggleMemoComplete = async (memo, val) => {
  try {
    await axios.put(`${API_BASE}/plan/events/${memo.id}`, { is_completed: val })
    memo.is_completed = val ? 1 : 0
    ElMessage.success(val ? '已完成' : '已取消')
  } catch (err) {
    ElMessage.error('操作失败')
  }
}

// === 流程操作 ===
const saveProcess = async () => {
  try {
    const { data } = await axios.post(`${API_BASE}/processes`, newProcess.value)
    if (data.success) {
      ElMessage.success('创建成功')
      processDialogVisible.value = false
      newProcess.value = { name: '', start_time: '', deadline: '' }
      loadProcesses()
    }
  } catch (err) {
    ElMessage.error('创建失败')
  }
}

const openEditProcessDialog = (process) => {
  editingProcess.value = {
    id: process.id,
    name: process.name,
    start_time: process.start_time,
    deadline: process.deadline
  }
  editProcessDialogVisible.value = true
}

const updateProcess = async () => {
  try {
    const { data } = await axios.put(`${API_BASE}/processes/${editingProcess.value.id}`, {
      name: editingProcess.value.name,
      start_time: editingProcess.value.start_time,
      deadline: editingProcess.value.deadline
    })
    if (data.success) {
      ElMessage.success('更新成功')
      editProcessDialogVisible.value = false
      loadProcesses()
    }
  } catch (err) {
    ElMessage.error('更新失败')
  }
}

const archiveProcess = async (id) => {
  try {
    await axios.put(`${API_BASE}/processes/${id}/archive`)
    ElMessage.success('已归档')
    loadProcesses()
  } catch (err) {
    ElMessage.error('归档失败')
  }
}

const unarchiveProcess = async (id) => {
  try {
    await axios.put(`${API_BASE}/processes/${id}/unarchive`)
    ElMessage.success('已还原流程')
    loadProcesses()
  } catch (err) {
    ElMessage.error('还原失败')
  }
}

const deleteProcess = async (id) => {
  try {
    await ElMessageBox.confirm('确定要删除此流程及其所有子任务？', '提示', { type: 'warning' })
    await axios.delete(`${API_BASE}/processes/${id}`)
    ElMessage.success('已删除')
    ElMessage.success('已删除')
    loadProcesses()
  } catch (err) {
    if (err !== 'cancel') ElMessage.error('删除失败')
  }
}

const addTask = async (processId) => {
  const name = newTaskInput.value[processId]?.trim()
  if (!name) return
  try {
    const { data } = await axios.post(`${API_BASE}/processes/${processId}/tasks`, { name })
    if (data.success) {
      newTaskInput.value[processId] = ''
      loadProcesses()
    }
  } catch (err) {
    ElMessage.error('添加任务失败')
  }
}

// 任务更新状态锁，防止快速点击造成状态不同步
const updatingTaskIds = ref(new Set())

const toggleTaskStatus = async (task) => {
  // 如果该任务正在更新中，忽略此次点击
  if (updatingTaskIds.value.has(task.id)) return

  try {
    updatingTaskIds.value.add(task.id)
    // 根据当前状态切换 - 使用 Number 转换确保类型正确
    const currentStatus = Number(task.is_completed) === 1 ? 1 : 0
    const newStatus = currentStatus === 1 ? 0 : 1
    const updateData = { is_completed: newStatus }

    if (newStatus === 1) {
      // 标记为完成：添加完成时间到任务名称
      const now = new Date()
      const timeStr = `${String(now.getFullYear()).slice(-2)}-${now.getMonth() + 1}-${now.getDate()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      // 检查是否已经有完成时间标记，避免重复添加
      if (!task.name.includes(' --- ')) {
        updateData.name = `${task.name} --- ${timeStr}`
      }
    } else {
      // 标记为未完成：删除任务名称中的完成时间
      if (task.name.includes(' --- ')) {
        updateData.name = task.name.split(' --- ')[0]
      }
    }

    await axios.put(`${API_BASE}/processes/tasks/${task.id}`, updateData)
    await loadProcesses()
  } catch (err) {
    ElMessage.error('更新状态失败')
  } finally {
    updatingTaskIds.value.delete(task.id)
  }
}

const startEditTask = (t) => {
  editingTaskId.value = t.id
  editTaskName.value = t.name
}

const saveEditTask = async (taskId) => {
  if (!editingTaskId.value) return
  
  const newName = editTaskName.value.trim()
  editingTaskId.value = null
  editTaskName.value = ''
  
  if (!newName) return
  
  try {
    await axios.put(`${API_BASE}/processes/tasks/${taskId}`, { name: newName })
    loadProcesses()
  } catch (err) {
    ElMessage.error('修改任务名称失败')
  }
}

const deleteTask = async (taskId) => {
  try {
    await axios.delete(`${API_BASE}/processes/tasks/${taskId}`)
    loadProcesses()
  } catch (err) {
    ElMessage.error('删除任务失败')
  }
}

// === 习惯打卡逻辑 ===
const habits = ref([])
const habitLogs = ref([])
const habitDialogVisible = ref(false)
const editHabitDialogVisible = ref(false)
const presetIcons = ref(['🌟', '🏃', '💧', '📚', '🍎', '🛏️'])
const newHabit = ref({ name: '', icon: '🌟', description: '' })
const editingHabit = ref({ id: '', name: '', icon: '🌟', description: '' })

const updateHabitSort = async () => {
  const updatedSortOrders = habits.value.map((h, index) => ({
    id: h.id,
    sort_order: index + 1
  }))
  try {
    await axios.put(`${API_BASE}/plan/habits/sort/update`, { habits: updatedSortOrders })
  } catch (err) {
    ElMessage.error('排序更新失败，请刷新重试')
  }
}

const moveHabitUp = async (habit, index) => {
  if (index === 0) return
  const temp = habits.value[index - 1]
  habits.value[index - 1] = habits.value[index]
  habits.value[index] = temp
  await updateHabitSort()
}

const moveHabitDown = async (habit, index) => {
  if (index === habits.value.length - 1) return
  const temp = habits.value[index + 1]
  habits.value[index + 1] = habits.value[index]
  habits.value[index] = temp
  await updateHabitSort()
}

const loadIcons = async () => {
  try {
    const { data } = await axios.get(`${API_BASE}/upload/habit-icons`)
    if (data.success && data.urls) {
      // 保持基础图标，追加从服务器获取的图标
      const baseIcons = ['🌟', '🏃', '💧', '📚', '🍎', '🛏️']
      presetIcons.value = [...baseIcons, ...data.urls]
    }
  } catch (err) {
    console.error('Failed to load icons', err)
  }
}

const handleUploadIconSuccess = (res) => {
  if (res.success) {
    ElMessage.success('图标上传成功')
    presetIcons.value.push(res.url)
  } else {
    ElMessage.error(res.message || '上传失败')
  }
}

const beforeUploadIcon = (file) => {
  const isImage = file.type.startsWith('image/')
  const isLt2M = file.size / 1024 / 1024 < 2

  if (!isImage) {
    ElMessage.error('上传的图标只能是图片格式!')
  }
  if (!isLt2M) {
    ElMessage.error('上传的图标大小不能超过 2MB!')
  }
  return isImage && isLt2M
}

const last7Days = computed(() => {
  const result = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const dtz = new Date(d.getTime() - (d.getTimezoneOffset() * 60000))
    result.push(dtz.toISOString().slice(0, 10))
  }
  return result
})

const loadHabits = async () => {
  try {
    const { data } = await axios.get(`${API_BASE}/plan/habits`)
    if (data.success) {
      habits.value = data.data.habits
      habitLogs.value = data.data.logs
      // 默认选中第一个习惯
      if (habits.value.length > 0 && !selectedHabit.value) {
        selectedHabit.value = habits.value[0]
      }
    }
  } catch (err) {
    console.error('Failed to load habits', err)
  }
}

// 选择习惯
const selectHabit = (habit) => {
  selectedHabit.value = habit
}

// 获取习惯总打卡次数
const getTotalCheckCount = (habitId) => {
  return habitLogs.value.filter(log => log.habit_id === habitId).length
}

// 获取习惯当月打卡次数
const getMonthCheckCount = (habitId) => {
  const currentMonth = new Date().toISOString().slice(0, 7)
  return habitLogs.value.filter(log => 
    log.habit_id === habitId && log.check_date.startsWith(currentMonth)
  ).length
}

// 获取习惯当月完成率
const getMonthCompletionRate = (habitId) => {
  const now = new Date()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const currentDay = now.getDate()
  const monthChecks = getMonthCheckCount(habitId)
  // 按已过天数计算完成率
  return Math.round((monthChecks / currentDay) * 100)
}

// 获取当前连续打卡天数
const getCurrentStreak = (habitId) => {
  const sortedLogs = habitLogs.value
    .filter(log => log.habit_id === habitId)
    .map(log => log.check_date.slice(0, 10))
    .sort((a, b) => new Date(b) - new Date(a))
  
  if (sortedLogs.length === 0) return 0
  
  let streak = 0
  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  
  // 如果今天没打卡，检查昨天是否有打卡
  let checkDate = sortedLogs.includes(today) ? today : yesterday
  if (!sortedLogs.includes(checkDate)) return 0
  
  for (let i = 0; i < sortedLogs.length; i++) {
    if (sortedLogs[i] === checkDate) {
      streak++
      // 计算前一天
      const prevDate = new Date(new Date(checkDate).getTime() - 86400000)
      checkDate = prevDate.toISOString().slice(0, 10)
    } else {
      break
    }
  }
  return streak
}

// 习惯日历相关
const habitCalendarYear = computed(() => habitCalendarDate.value.getFullYear())
const habitCalendarMonth = computed(() => habitCalendarDate.value.getMonth())

const habitCalendarDays = computed(() => {
  const year = habitCalendarYear.value
  const month = habitCalendarMonth.value
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const daysInMonth = lastDay.getDate()
  const startingDay = firstDay.getDay()
  
  const days = []
  const today = new Date().toISOString().slice(0, 10)
  
  // 上个月的日期
  const prevMonth = new Date(year, month, 0)
  const daysInPrevMonth = prevMonth.getDate()
  for (let i = startingDay - 1; i >= 0; i--) {
    const date = daysInPrevMonth - i
    days.push({ date, isCurrentMonth: false, isChecked: false, isToday: false })
  }
  
  // 当前月的日期
  for (let i = 1; i <= daysInMonth; i++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`
    const isChecked = selectedHabit.value ? isHabitChecked(selectedHabit.value.id, dateStr) : false
    days.push({ 
      date: i, 
      isCurrentMonth: true, 
      isChecked, 
      isToday: dateStr === today,
      dateStr
    })
  }
  
  // 下个月的日期
  const totalCells = Math.ceil((startingDay + daysInMonth) / 7) * 7
  const remainingCells = totalCells - days.length
  for (let i = 1; i <= remainingCells; i++) {
    days.push({ date: i, isCurrentMonth: false, isChecked: false, isToday: false })
  }
  
  return days
})

const changeHabitMonth = (delta) => {
  habitCalendarDate.value = new Date(habitCalendarYear.value, habitCalendarMonth.value + delta, 1)
}

const isHabitChecked = (habitId, dateStr) => {
  return habitLogs.value.some(log => log.habit_id === habitId && log.check_date.startsWith(dateStr))
}

const toggleCheck = async (habitId, dateStr) => {
  const isChecked = isHabitChecked(habitId, dateStr)
  
  if (isChecked) {
    habitLogs.value = habitLogs.value.filter(log => !(log.habit_id === habitId && log.check_date.startsWith(dateStr)))
  } else {
    habitLogs.value.push({
      habit_id: habitId,
      check_date: dateStr
    })
  }

  try {
    if (isChecked) {
      await axios.post(`${API_BASE}/plan/habits/uncheck`, { habit_id: habitId, check_date: dateStr })
    } else {
      await axios.post(`${API_BASE}/plan/habits/check`, { habit_id: habitId, check_date: dateStr })
    }
  } catch (err) {
    ElMessage.error('打卡状态更新失败')
    loadHabits()
  }
}

const saveHabit = async () => {
  try {
    const { data } = await axios.post(`${API_BASE}/plan/habits`, newHabit.value)
    if (data.success) {
      ElMessage.success('添加习惯成功')
      habitDialogVisible.value = false
      newHabit.value = { name: '', icon: '', description: '' }
      loadHabits()
    }
  } catch (err) {
    ElMessage.error('添加习惯失败')
  }
}

// 打开编辑习惯弹窗
const openEditHabitDialog = (habit) => {
  editingHabit.value = { ...habit }
  editHabitDialogVisible.value = true
}

// 更新习惯
const updateHabit = async () => {
  try {
    const { data } = await axios.put(`${API_BASE}/plan/habits/${editingHabit.value.id}`, {
      name: editingHabit.value.name,
      icon: editingHabit.value.icon,
      description: editingHabit.value.description
    })
    if (data.success) {
      ElMessage.success('修改习惯成功')
      editHabitDialogVisible.value = false
      // 更新本地数据
      const index = habits.value.findIndex(h => h.id === editingHabit.value.id)
      if (index !== -1) {
        habits.value[index] = { ...editingHabit.value }
      }
      // 更新选中的习惯
      if (selectedHabit.value?.id === editingHabit.value.id) {
        selectedHabit.value = { ...editingHabit.value }
      }
    }
  } catch (err) {
    ElMessage.error('修改习惯失败')
  }
}

// 删除习惯
const deleteHabit = async (habit) => {
  try {
    await ElMessageBox.confirm(`确定要删除习惯"${habit.name}"吗？相关的打卡记录也会被删除。`, '提示', { type: 'warning' })
    const { data } = await axios.delete(`${API_BASE}/plan/habits/${habit.id}`)
    if (data.success) {
      ElMessage.success('删除习惯成功')
      // 如果删除的是当前选中的习惯，清空选中
      if (selectedHabit.value?.id === habit.id) {
        selectedHabit.value = null
      }
      loadHabits()
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除习惯失败')
    }
  }
}

// 格式化短日期（如 3-21）
const formatShortDate = (dateStr) => {
  const parts = dateStr.split('-')
  return `${parseInt(parts[1])}-${parseInt(parts[2])}`
}

// === 通用方法 ===
const getLunarInfo = (dateStr) => {
  try {
    const parts = dateStr.split('-')
    const d = new Date(parts[0], parseInt(parts[1])-1, parts[2])
    const lunar = Lunar.fromDate(d)
    const holiday = HolidayUtil.getHoliday(d.getFullYear(), d.getMonth() + 1, d.getDate())
    
    let text = ''
    let colorClass = ''

    if (holiday) {
      text = holiday.getName()
      if (holiday.isWork()) {
        text += '(班)'
        colorClass = 'is-work'
      } else {
        colorClass = 'is-holiday'
      }
    } else {
      const festivals = lunar.getFestivals()
      const jieQi = lunar.getJieQi()
      if (festivals.length > 0) {
        text = festivals[0]
        colorClass = 'is-festival'
      } else if (jieQi) {
        text = jieQi
        colorClass = 'is-festival'
      } else {
        const day = lunar.getDayInChinese()
        text = day === '初一' ? lunar.getMonthInChinese() + '月' : day
      }
    }
    return { text, colorClass }
  } catch (e) {
    return { text: '', colorClass: '' }
  }
}

const formatDate = (dateStr) => {
  if (!dateStr) return ''
  return dateStr.slice(0, 10)
}

const loadedTabs = ref({
  schedule: false,
  calendar: false,
  habits: false,
  processes: false,
  diet: false,
  alarms: false
})

const handleTabChange = (tabName) => {
  if ((tabName === 'schedule' || tabName === 'calendar') && !loadedTabs.value[tabName]) {
    loadEvents()
    if (!loadedTabs.value.habits) loadHabits()
    if (!loadedTabs.value.processes) loadProcesses()
    loadScheduleBlocks()
    loadSchedulePresets()
    loadedTabs.value[tabName] = true
  } else if (tabName === 'habits' && !loadedTabs.value.habits) {
    loadHabits()
    loadIcons()
    loadedTabs.value.habits = true
  } else if ((tabName === 'active' || tabName === 'archived') && !loadedTabs.value.processes) {
    loadProcesses()
    loadedTabs.value.processes = true
  } else if (tabName === 'diet' && !loadedTabs.value.diet) {
    loadDietRecords()
    loadLedgerCategories()
    loadedTabs.value.diet = true
  } else if (tabName === 'alarms' && !loadedTabs.value.alarms) {
    loadAlarms()
    loadCountdownDays()
    loadUserWeight()
    loadWaterRecords()
    loadedTabs.value.alarms = true
  }
}

// === 日常饮食逻辑 ===
const dietDate = ref(new Date())
const selectedDietDate = ref(new Date().toISOString().slice(0, 10))
const mealTypes = [
  { key: 'breakfast', label: '早餐' },
  { key: 'lunch', label: '午餐' },
  { key: 'dinner', label: '晚餐' },
  { key: 'snack', label: '夜宵' }
]

const dietRecords = ref([])
const dietForms = ref({}) // { '2023-01-01': { '早餐': { content, category, shop_name, id } } }
const currentDayForms = ref({
  '早餐': { content: '', category: '', shop_name: '' },
  '午餐': { content: '', category: '', shop_name: '' },
  '晚餐': { content: '', category: '', shop_name: '' },
  '夜宵': { content: '', category: '', shop_name: '' }
})
const favoriteShops = ref([]) // 所有店铺列表，带收藏标记 { name: string, is_favorite: boolean }

// === 不知道吃什么弹窗相关 ===
const randomPickerVisible = ref(false)
const isRolling = ref(false)
const rolledShop = ref('')
const rollingShop = ref('')
const shopChartRef = ref(null)
let shopChartInstance = null

// 打开不知道吃什么弹窗
const openRandomPicker = () => {
  randomPickerVisible.value = true
  rolledShop.value = ''
  rollingShop.value = ''
}

// 开始抽奖
const startRoll = () => {
  if (favoriteShops.value.length === 0) {
    ElMessage.warning('没有收藏的店铺可以抽奖')
    return
  }
  
  isRolling.value = true
  rolledShop.value = ''
  
  // 只从收藏的店铺中抽取
  const favoriteShopsList = favoriteShops.value.filter(s => s.is_favorite)
  if (favoriteShopsList.length === 0) {
    ElMessage.warning('没有收藏的店铺可以抽奖，请先收藏店铺')
    isRolling.value = false
    return
  }
  
  let rollCount = 0
  const maxRolls = 20 // 滚动次数
  const rollInterval = setInterval(() => {
    const randomIndex = Math.floor(Math.random() * favoriteShopsList.length)
    rollingShop.value = favoriteShopsList[randomIndex].name
    rollCount++
    
    if (rollCount >= maxRolls) {
      clearInterval(rollInterval)
      const finalIndex = Math.floor(Math.random() * favoriteShopsList.length)
      rolledShop.value = favoriteShopsList[finalIndex].name
      isRolling.value = false
    }
  }, 100) // 每100ms切换一次
}

// 使用抽中的店铺 - 复制到剪贴板
const useRolledShop = async () => {
  if (!rolledShop.value) return
  
  try {
    await navigator.clipboard.writeText(rolledShop.value)
    ElMessage.success(`「${rolledShop.value}」已复制到剪贴板`)
    randomPickerVisible.value = false
  } catch (err) {
    ElMessage.error('复制失败，请手动复制')
  }
}

// 初始化店铺统计图表
const initShopChart = () => {
  if (!shopChartRef.value) return
  
  // 销毁旧实例
  if (shopChartInstance) {
    shopChartInstance.dispose()
  }
  
  // 统计各店铺消费次数
  const shopCountMap = new Map()
  dietRecords.value.forEach(r => {
    if (r.shop_name && (r.category === '外卖' || r.category === '饭店')) {
      const count = shopCountMap.get(r.shop_name) || 0
      shopCountMap.set(r.shop_name, count + 1)
    }
  })
  
  // 排序并取前10
  const sortedShops = Array.from(shopCountMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
  
  if (sortedShops.length === 0) {
    // 没有数据时显示提示
    shopChartRef.value.innerHTML = '<div style="text-align: center; padding-top: 100px; color: #999;">暂无店铺消费数据</div>'
    return
  }
  
  const shopNames = sortedShops.map(item => item[0])
  const shopCounts = sortedShops.map(item => item[1])
  
  // 创建图表
  shopChartInstance = echarts.init(shopChartRef.value)
  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: function(params) {
        const data = params[0]
        return `<div style="font-weight:bold;margin-bottom:4px;">${data.name}</div>
                <div>消费次数：<span style="color:#409EFF;font-weight:bold;">${data.value}</span> 次</div>`
      }
    },
    grid: {
      left: '15%',
      right: '15%',
      bottom: '8%',
      top: '5%',
      containLabel: false
    },
    xAxis: {
      type: 'value',
      minInterval: 1,
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: {
        lineStyle: {
          color: '#E0E6ED',
          type: 'dashed'
        }
      },
      axisLabel: {
        color: '#909399'
      }
    },
    yAxis: {
      type: 'category',
      data: shopNames.reverse(),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: '#606266',
        fontWeight: 500,
        fontSize: 13,
        width: 90,
        overflow: 'truncate',
        formatter: function(value) {
          const isFavorite = favoriteShops.value.some(s => s.name === value && s.is_favorite)
          return isFavorite ? '⭐ ' + value : value
        }
      }
    },
    series: [{
      type: 'bar',
      data: shopCounts.reverse(),
      barWidth: '55%',
      itemStyle: {
        borderRadius: [0, 8, 8, 0],
        color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
          { offset: 0, color: '#74b9ff' },
          { offset: 1, color: '#0984e3' }
        ])
      },
      emphasis: {
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: '#fdcb6e' },
            { offset: 1, color: '#e17055' }
          ])
        }
      },
      label: {
        show: true,
        position: 'right',
        distance: 10,
        formatter: '{c} 次',
        color: '#409EFF',
        fontWeight: 'bold',
        fontSize: 13
      }
    }]
  }
  
  shopChartInstance.setOption(option)
}

// 销毁图表实例
const destroyShopChart = () => {
  if (shopChartInstance) {
    shopChartInstance.dispose()
    shopChartInstance = null
  }
}

const handleSelectDietDate = (dateStr) => {
  selectedDietDate.value = dateStr
  syncCurrentDayForms()
}

const syncCurrentDayForms = () => {
  const dateStr = selectedDietDate.value
  const forms = dietForms.value[dateStr] || {}
  mealTypes.forEach(m => {
    // 直接修改属性而不是替换整个对象，避免重新渲染
    currentDayForms.value[m.label].content = forms[m.label]?.content || ''
    currentDayForms.value[m.label].category = forms[m.label]?.category || ''
    currentDayForms.value[m.label].shop_name = forms[m.label]?.shop_name || ''
  })
}

// 使用缓存判断是否显示店铺选择器
const showShopSelectCache = ref({})
const showShopSelect = (mealLabel) => {
  const category = currentDayForms.value[mealLabel]?.category
  const shouldShow = category === '外卖' || category === '饭店'
  // 缓存结果避免频繁重新计算
  if (showShopSelectCache.value[mealLabel] !== shouldShow) {
    showShopSelectCache.value[mealLabel] = shouldShow
  }
  return shouldShow
}

const updateFavoriteShops = () => {
  // 收集所有店铺及其收藏状态（按店铺名去重，保留收藏状态）
  const shopMap = new Map()
  dietRecords.value.forEach(r => {
    if (r.shop_name && (r.category === '外卖' || r.category === '饭店')) {
      // 如果该店铺有任何一条记录被收藏，则标记为收藏
      if (!shopMap.has(r.shop_name) || r.is_favorite) {
        shopMap.set(r.shop_name, {
          name: r.shop_name,
          is_favorite: r.is_favorite ? 1 : 0
        })
      }
    }
  })
  favoriteShops.value = Array.from(shopMap.values())
}

const ledgerDialogVisible = ref(false)
const ledgerForm = ref({ type: 2, amount: 0, category: '', remark: '', record_date: '' })
const ledgerCategories = ref([])

const loadDietRecords = async () => {
  try {
    const { data } = await axios.get(`${API_BASE}/plan/diet`)
    if (data.success) {
      // 获取账本流水数据，用于检测是否已记账
      const ledgerRes = await axios.get(`${API_BASE}/ledgers`)
      const ledgerRecords = ledgerRes.data.success ? ledgerRes.data.data : []
      
      // 确保 is_favorite 是数字类型，cost 转为数字
      const records = data.data.map(r => {
        // 检测是否已记账：日期相同、分类匹配、备注匹配"时间-店名"格式
        const isRecorded = ledgerRecords.some(l => {
          const remarkMatch = l.remark === `${r.meal_time}-${r.shop_name}`
          const dateMatch = l.record_date === r.record_date
          const categoryMatch = l.category === r.category
          return dateMatch && categoryMatch && remarkMatch
        })
        
        return { 
          ...r, 
          isEditing: false,
          is_favorite: r.is_favorite ? 1 : 0,
          cost: r.cost === null || r.cost === undefined ? null : Number(r.cost),
          is_recorded: isRecorded ? 1 : 0
        }
      })
      dietRecords.value = records
      
      // 解析到 dietForms 供左侧使用
      const forms = {}
      records.forEach(r => {
        if (!forms[r.record_date]) forms[r.record_date] = {}
        forms[r.record_date][r.meal_time] = {
          id: r.id,
          content: r.content,
          category: r.category,
          shop_name: r.shop_name,
          is_favorite: r.is_favorite ? 1 : 0
        }
      })
      dietForms.value = forms
      syncCurrentDayForms()
      updateFavoriteShops()
    }
  } catch (err) {
    ElMessage.error('加载饮食记录失败')
  }
}

const saveDietForm = async (mealLabel) => {
  const dateStr = selectedDietDate.value
  const form = currentDayForms.value[mealLabel]
  
  // 根据类别决定保存逻辑
  const isHome = form.category === '在家'
  
  const dataToSave = {
    record_date: dateStr,
    meal_time: mealLabel,
    content: form.content || '',
    category: form.category,
    shop_name: isHome ? '' : (form.shop_name || ''),
    review: '',
    cost: 0
  }

  // 如果没有类别和内容（在家）或没有类别和店铺（外卖/饭店），则不保存
  if (!form.category) return
  if (isHome && !form.content) return
  if (!isHome && !form.shop_name && !form.content) return

  try {
    await axios.post(`${API_BASE}/plan/diet`, dataToSave)
    // 为了刷新右侧表格
    loadDietRecords()
    ElMessage.success('更新成功')
  } catch (err) {
    ElMessage.error('更新失败')
  }
}

const addDietRecord = () => {
  dietRecords.value.unshift({
    id: 'temp-' + Date.now(),
    record_date: selectedDietDate.value,
    meal_time: '午餐',
    shop_name: '',
    category: '外卖',
    review: '',
    cost: 0,
    isEditing: true,
    isNew: true,
    is_favorite: 0,
    is_recorded: 0
  })
}

const saveDietRecord = async (row, index) => {
  try {
    if (!row.record_date || !row.meal_time) {
      ElMessage.warning('日期和时间必填')
      return
    }
    
    // 取出现有的左侧文本内容（如果存在），以避免被覆盖为空
    let existingContent = ''
    if (dietForms.value[row.record_date]?.[row.meal_time]) {
      existingContent = dietForms.value[row.record_date][row.meal_time].content || ''
    }

    if (row.isNew) {
      await axios.post(`${API_BASE}/plan/diet`, {
        record_date: row.record_date,
        meal_time: row.meal_time,
        content: existingContent,
        category: row.category,
        shop_name: row.shop_name,
        review: row.review,
        cost: row.cost
      })
    } else {
      await axios.put(`${API_BASE}/plan/diet/${row.id}`, {
        record_date: row.record_date,
        meal_time: row.meal_time,
        content: row.content, // 保留原有的内容
        category: row.category,
        shop_name: row.shop_name,
        review: row.review,
        cost: row.cost
      })
    }
    ElMessage.success('保存记录成功')
    loadDietRecords()
  } catch (err) {
    ElMessage.error('保存记录失败')
  }
}

const cancelEditDietRecord = (row, index) => {
  if (row.isNew) {
    dietRecords.value.splice(index, 1)
  } else {
    loadDietRecords() // 简单重载恢复原数据
  }
}

const editDietRecord = (row) => {
  row.isEditing = true
}

const toggleDietFavorite = async (row) => {
  if (row.isNew) return
  const originalState = row.is_favorite
  const newState = originalState ? 0 : 1
  
  console.log('Toggle favorite:', row.shop_name, 'from', originalState, 'to', newState)
  
  try {
    // 更新该店铺所有记录的收藏状态
    const shopName = row.shop_name
    if (shopName) {
      // 前端先更新所有相同店铺的记录
      dietRecords.value.forEach(r => {
        if (r.shop_name === shopName) {
          r.is_favorite = newState
        }
      })
      
      // 同时更新 dietForms 中的收藏状态
      Object.keys(dietForms.value).forEach(date => {
        Object.keys(dietForms.value[date]).forEach(meal => {
          const form = dietForms.value[date][meal]
          if (form.shop_name === shopName) {
            form.is_favorite = newState
          }
        })
      })
      
      // 调用后端更新该店铺所有记录的收藏状态
      console.log('Sending request to backend:', { shop_name: shopName, is_favorite: newState })
      const { data } = await axios.put(`${API_BASE}/plan/diet/shop/favorite`, {
        shop_name: shopName,
        is_favorite: newState
      })
      
      console.log('Backend response:', data)
      
      if (!data.success) {
        throw new Error(data.message)
      }
      
      // 更新店铺列表的收藏状态
      updateFavoriteShops()
      
      ElMessage.success(newState ? '已收藏店铺' : '已取消收藏')
    }
  } catch (err) {
    console.error('Toggle favorite error:', err)
    // 恢复所有相同店铺的记录状态
    dietRecords.value.forEach(r => {
      if (r.shop_name === row.shop_name) {
        r.is_favorite = originalState
      }
    })
    // 恢复 dietForms 中的状态
    Object.keys(dietForms.value).forEach(date => {
      Object.keys(dietForms.value[date]).forEach(meal => {
        const form = dietForms.value[date][meal]
        if (form.shop_name === row.shop_name) {
          form.is_favorite = originalState
        }
      })
    })
    updateFavoriteShops()
    ElMessage.error('操作失败')
  }
}

const deleteDietRecord = async (id) => {
  if (String(id).startsWith('temp-')) return
  try {
    await ElMessageBox.confirm('确定删除此条记录？', '提示', { type: 'warning' })
    await axios.delete(`${API_BASE}/plan/diet/${id}`)
    ElMessage.success('已删除')
    loadDietRecords()
  } catch (err) {
    if (err !== 'cancel') ElMessage.error('删除失败')
  }
}

// 记账功能
const loadLedgerCategories = async () => {
  try {
    const { data } = await axios.get(`${API_BASE}/ledgers/categories`)
    if (data.success) {
      ledgerCategories.value = data.data
    }
  } catch (err) {
    console.error('Failed to load ledger categories', err)
  }
}

const openLedgerDialog = (row) => {
  // 备注格式：时间-店名，如"晚餐-熊仔面汤店"
  const remark = row.shop_name ? `${row.meal_time}-${row.shop_name}` : ''
  ledgerForm.value = {
    type: 2, // 默认支出
    amount: row.cost || 0,
    category: row.category || '外卖',
    remark: remark,
    record_date: row.record_date || new Date().toISOString().slice(0, 10),
    diet_record_id: row.id // 记录关联的饮食记录ID
  }
  ledgerDialogVisible.value = true
}

const saveLedgerRecord = async () => {
  try {
    const { data } = await axios.post(`${API_BASE}/ledgers`, ledgerForm.value)
    if (data.success) {
      // 标记该饮食记录已记账
      if (ledgerForm.value.diet_record_id) {
        const record = dietRecords.value.find(r => r.id === ledgerForm.value.diet_record_id)
        if (record) {
          record.is_recorded = 1
        }
      }
      ElMessage.success('记账成功')
      ledgerDialogVisible.value = false
    }
  } catch (err) {
    ElMessage.error('记账失败')
  }
}

// === 闹钟与提醒 ===
const alarmsList = ref([])
const alarmDialogVisible = ref(false)
const editingAlarm = ref({
  id: '',
  timeObj: null,
  content: '',
  daysArr: ['1','2','3','4','5'],
  is_active: true
})

// === 倒数日 ===
const countdownDaysList = ref([])
const countdownDayDialogVisible = ref(false)
const editingCountdownDay = ref({
  id: '',
  label: '',
  start_date: '',
  end_date: ''
})

const loadCountdownDays = async () => {
  try {
    const stored = localStorage.getItem('lifeFlow_countdownDays')
    if (stored) {
      countdownDaysList.value = JSON.parse(stored)
    }
  } catch (err) {
    console.error('Failed to load countdown days', err)
  }
}

const saveCountdownDaysToStorage = () => {
  localStorage.setItem('lifeFlow_countdownDays', JSON.stringify(countdownDaysList.value))
}

const showAddCountdownDialog = () => {
  editingCountdownDay.value = { id: '', label: '', start_date: '', end_date: '' }
  countdownDayDialogVisible.value = true
}

const editCountdownDay = (item) => {
  editingCountdownDay.value = {
    id: item.id,
    label: item.label,
    start_date: item.start_date,
    end_date: item.end_date
  }
  countdownDayDialogVisible.value = true
}

const saveCountdownDay = () => {
  const { id, label, start_date, end_date } = editingCountdownDay.value
  if (!label || !start_date || !end_date) return

  const s = new Date(start_date)
  const e = new Date(end_date)
  const totalDays = Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1

  if (id) {
    const idx = countdownDaysList.value.findIndex(i => i.id === id)
    if (idx > -1) {
      countdownDaysList.value[idx] = { ...countdownDaysList.value[idx], label, start_date, end_date, total_days: totalDays }
    }
    ElMessage.success('倒数日已更新')
  } else {
    countdownDaysList.value.push({
      id: Date.now().toString(),
      label,
      start_date,
      end_date,
      total_days: totalDays
    })
    ElMessage.success('倒数日已添加')
  }
  saveCountdownDaysToStorage()
  countdownDayDialogVisible.value = false
}

const deleteCountdownDay = async (id) => {
  try {
    await ElMessageBox.confirm('确定要删除这个倒数日吗？', '提示', { type: 'warning' })
    countdownDaysList.value = countdownDaysList.value.filter(i => i.id !== id)
    saveCountdownDaysToStorage()
    ElMessage.success('已删除')
  } catch {
    // cancelled
  }
}

const getRemainingDays = (item) => {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const end = new Date(item.end_date)
  end.setHours(0, 0, 0, 0)
  const diff = Math.round((end - now) / (1000 * 60 * 60 * 24))
  if (diff < 0) return `已过期 ${Math.abs(diff)} 天`
  if (diff === 0) return '今天'
  return `剩余 ${diff} 天`
}

const loadAlarms = async () => {
  try {
    const { data } = await axios.get(`${API_BASE}/alarm-water/alarms`)
    if (data.success) {
      alarmsList.value = data.data.map(a => ({
        ...a,
        is_active: !!a.is_active,
        days: a.days ? a.days.split(',') : []
      }))
    }
  } catch (err) {
    console.error('Failed to load alarms', err)
  }
}

const showAddAlarmDialog = () => {
  editingAlarm.value = {
    id: '',
    timeObj: new Date(),
    content: '',
    daysArr: ['1','2','3','4','5'],
    is_active: true
  }
  alarmDialogVisible.value = true
}

const editAlarm = (alarm) => {
  const t = new Date()
  const [h, m] = alarm.time.split(':')
  t.setHours(h, m, 0)
  editingAlarm.value = {
    id: alarm.id,
    timeObj: t,
    content: alarm.content,
    daysArr: [...alarm.days],
    is_active: alarm.is_active
  }
  alarmDialogVisible.value = true
}

const saveAlarm = async () => {
  try {
    const t = editingAlarm.value.timeObj
    const timeStr = `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`
    const payload = {
      time: timeStr,
      content: editingAlarm.value.content,
      days: editingAlarm.value.daysArr.join(','),
      is_active: editingAlarm.value.is_active
    }
    if (editingAlarm.value.id) {
      await axios.put(`${API_BASE}/alarm-water/alarms/${editingAlarm.value.id}`, payload)
      ElMessage.success('闹钟已更新')
    } else {
      await axios.post(`${API_BASE}/alarm-water/alarms`, payload)
      ElMessage.success('闹钟已添加')
    }
    alarmDialogVisible.value = false
    loadAlarms()
  } catch (err) {
    ElMessage.error('保存闹钟失败')
  }
}

const deleteAlarm = async (id) => {
  try {
    await ElMessageBox.confirm('确定要删除该闹钟吗？', '提示', { type: 'warning' })
    await axios.delete(`${API_BASE}/alarm-water/alarms/${id}`)
    ElMessage.success('已删除')
    loadAlarms()
  } catch (err) {
    if (err !== 'cancel') ElMessage.error('删除失败')
  }
}

const toggleAlarm = async (alarm) => {
  try {
    await axios.put(`${API_BASE}/alarm-water/alarms/${alarm.id}`, {
      time: alarm.time,
      content: alarm.content,
      days: alarm.days.join(','),
      is_active: alarm.is_active
    })
  } catch (err) {
    alarm.is_active = !alarm.is_active
    ElMessage.error('切换状态失败')
  }
}

const toggleAlarmDay = async (alarm, day) => {
  try {
    const index = alarm.days.indexOf(day)
    if (index > -1) {
      alarm.days.splice(index, 1)
    } else {
      alarm.days.push(day)
    }
    await axios.put(`${API_BASE}/alarm-water/alarms/${alarm.id}`, {
      time: alarm.time,
      content: alarm.content,
      days: alarm.days.join(','),
      is_active: alarm.is_active
    })
    ElMessage.success('重复设置已更新')
  } catch (err) {
    ElMessage.error('更新失败')
  }
}

const getAlarmNextTimeStr = (alarm) => {
  if (!alarm.is_active) return '已关闭'
  const now = new Date()
  const [h, m] = alarm.time.split(':')
  let alarmTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), parseInt(h), parseInt(m), 0)
  
  // if no days selected, it's a one-time alarm
  if (!alarm.days || alarm.days.length === 0) {
    if (alarmTime <= now) alarmTime.setDate(alarmTime.getDate() + 1)
    const diff = alarmTime - now
    const hh = Math.floor(diff / 3600000)
    const mm = Math.floor((diff % 3600000) / 60000)
    return `${hh}小时${mm}分钟内`
  }

  // Find next valid day
  let found = false
  for (let i = 0; i < 8; i++) {
    if (i === 0 && alarmTime <= now) continue;
    const day = alarmTime.getDay()
    if (alarm.days.includes(String(day))) {
      found = true
      break
    }
    alarmTime.setDate(alarmTime.getDate() + 1)
  }
  
  if (found) {
    const diff = alarmTime - now
    const hh = Math.floor(diff / 3600000)
    const mm = Math.floor((diff % 3600000) / 60000)
    return `${hh}小时${mm}分钟内`
  }
  return '无生效日'
}

// === 报警提示音效 ===
const playAlarmSound = () => {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    if (audioCtx.state === 'suspended') {
      audioCtx.resume()
    }
    for (let i = 0; i < 3; i++) {
      const oscillator = audioCtx.createOscillator()
      const gainNode = audioCtx.createGain()
      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(800, audioCtx.currentTime + i * 0.5)
      gainNode.gain.setValueAtTime(0, audioCtx.currentTime + i * 0.5)
      gainNode.gain.linearRampToValueAtTime(1, audioCtx.currentTime + i * 0.5 + 0.1)
      gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + i * 0.5 + 0.4)
      oscillator.connect(gainNode)
      gainNode.connect(audioCtx.destination)
      oscillator.start(audioCtx.currentTime + i * 0.5)
      oscillator.stop(audioCtx.currentTime + i * 0.5 + 0.5)
    }
  } catch (e) {
    console.error('Audio play failed', e)
  }
}

// 闹钟检测逻辑
let checkAlarmsInterval = null
let scheduleKeyDownHandler = null
let lastCheckedMinute = -1

const checkAlarms = () => {
  const now = new Date()
  const currentMinute = now.getMinutes()
  
  if (currentMinute === lastCheckedMinute) return
  lastCheckedMinute = currentMinute

  const currentHourStr = String(now.getHours()).padStart(2, '0')
  const currentMinStr = String(currentMinute).padStart(2, '0')
  const currentTimeStr = `${currentHourStr}:${currentMinStr}`
  const currentDayStr = String(now.getDay())

  alarmsList.value.forEach(alarm => {
    if (!alarm.is_active) return
    if (alarm.time === currentTimeStr) {
      if (!alarm.days || alarm.days.length === 0 || alarm.days.includes(currentDayStr)) {
        playAlarmSound()
        ElMessageBox.alert(alarm.content || '时间到了！', '⏰ 闹钟提醒', { type: 'success' })
        if (Notification.permission === 'granted') {
          new Notification('⏰ 闹钟提醒', { body: alarm.content || '时间到了！' })
        }
      }
    }
  })
}

// === 倒计时与计时器 ===
const countdown = ref({
  inputMinutes: 10,
  remainingSeconds: 600,
  isRunning: false,
  isPaused: false,
  timerId: null
})

const timer = ref({
  elapsedSeconds: 0,
  isRunning: false,
  timerId: null
})

const formatDuration = (secs) => {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  if (h > 0) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

const startCountdown = () => {
  countdown.value.remainingSeconds = countdown.value.inputMinutes * 60
  countdown.value.isRunning = true
  countdown.value.isPaused = false
  if (countdown.value.timerId) clearInterval(countdown.value.timerId)
  countdown.value.timerId = setInterval(() => {
    if (countdown.value.remainingSeconds > 0) {
      countdown.value.remainingSeconds--
    } else {
      stopCountdown()
      playAlarmSound()
      ElMessageBox.alert('倒计时结束！', '提醒', { type: 'success' })
      // HTML5 Notification could be used here
      if (Notification.permission === 'granted') {
        new Notification('倒计时结束', { body: '您的倒计时已经到了！' })
      }
    }
  }, 1000)
}

const pauseCountdown = () => {
  countdown.value.isRunning = false
  countdown.value.isPaused = true
  if (countdown.value.timerId) clearInterval(countdown.value.timerId)
}

const resumeCountdown = () => {
  countdown.value.isRunning = true
  countdown.value.isPaused = false
  if (countdown.value.timerId) clearInterval(countdown.value.timerId)
  countdown.value.timerId = setInterval(() => {
    if (countdown.value.remainingSeconds > 0) {
      countdown.value.remainingSeconds--
    } else {
      stopCountdown()
      playAlarmSound()
      ElMessageBox.alert('倒计时结束！', '提醒', { type: 'success' })
      if (Notification.permission === 'granted') {
        new Notification('倒计时结束', { body: '您的倒计时已经到了！' })
      }
    }
  }, 1000)
}

const stopCountdown = () => {
  countdown.value.isRunning = false
  countdown.value.isPaused = false
  if (countdown.value.timerId) clearInterval(countdown.value.timerId)
}

const startTimer = () => {
  timer.value.isRunning = true
  if (timer.value.timerId) clearInterval(timer.value.timerId)
  timer.value.timerId = setInterval(() => {
    timer.value.elapsedSeconds++
  }, 1000)
}

const pauseTimer = () => {
  timer.value.isRunning = false
  if (timer.value.timerId) clearInterval(timer.value.timerId)
}

const resumeTimer = () => {
  startTimer()
}

const resetTimer = () => {
  pauseTimer()
  timer.value.elapsedSeconds = 0
}

// === 喝水记录 ===
const userWeight = ref(73.5)
const targetWaterMin = computed(() => Math.round(userWeight.value * 30))
const targetWaterMax = computed(() => Math.round(userWeight.value * 35))
const targetWaterAvg = computed(() => Math.round(userWeight.value * 32.5))
const waterDate = ref(new Date().toISOString().slice(0, 10))
const waterRecords = ref([])
const addWaterAmount = ref(200)

const todayWaterAmount = computed(() => {
  return waterRecords.value.reduce((sum, r) => sum + r.amount, 0)
})

const waterLevelPercentage = computed(() => {
  const p = (todayWaterAmount.value / targetWaterAvg.value) * 100
  return Math.min(100, Math.max(0, p))
})

const loadUserWeight = async () => {
  try {
    const { data } = await axios.get(`${API_BASE}/settings`)
    if (data.success && data.data.user_weight) {
      userWeight.value = parseFloat(data.data.user_weight) || 73.5
    }
  } catch (err) {
    console.error('Failed to load weight')
  }
}

const saveUserWeight = async () => {
  try {
    await axios.put(`${API_BASE}/settings`, { key: 'user_weight', value: String(userWeight.value) })
  } catch (err) {
    console.error('Failed to save weight')
  }
}

const loadWaterRecords = async () => {
  try {
    const { data } = await axios.get(`${API_BASE}/alarm-water/water?date=${waterDate.value}`)
    if (data.success) {
      waterRecords.value = data.data.map(r => ({ ...r, isEditing: false }))
    }
  } catch (err) {
    console.error('Failed to load water records')
  }
}

const submitWaterRecord = async () => {
  try {
    const now = new Date()
    // if selected date is today, use current time, otherwise use selected date at 12:00:00
    const isToday = waterDate.value === new Date().toISOString().slice(0, 10)
    let recordTime = now
    if (!isToday) {
      recordTime = new Date(`${waterDate.value}T12:00:00`)
    }
    
    // adjust for local timezone offset manually when sending
    const tzOffset = recordTime.getTimezoneOffset() * 60000
    const localTimeStr = new Date(recordTime.getTime() - tzOffset).toISOString().slice(0, 19).replace('T', ' ')

    await axios.post(`${API_BASE}/alarm-water/water`, {
      amount: addWaterAmount.value,
      record_time: localTimeStr
    })
    ElMessage.success('打卡成功')
    loadWaterRecords()
  } catch (err) {
    ElMessage.error('打卡失败')
  }
}

const saveEditWater = async (row) => {
  try {
    await axios.put(`${API_BASE}/alarm-water/water/${row.id}`, {
      amount: row.amount,
      record_time: row.record_time
    })
    ElMessage.success('已保存修改')
    loadWaterRecords()
  } catch (err) {
    ElMessage.error('保存修改失败')
  }
}

const cancelEditWater = (row) => {
  row.isEditing = false
  loadWaterRecords() // reload to discard changes
}

const deleteWaterRecord = async (id) => {
  try {
    await ElMessageBox.confirm('确定要删除这条记录吗？', '提示', { type: 'warning' })
    await axios.delete(`${API_BASE}/alarm-water/water/${id}`)
    ElMessage.success('已删除')
    loadWaterRecords()
  } catch (err) {
    if (err !== 'cancel') ElMessage.error('删除失败')
  }
}

const formatWaterTime = (isoString) => {
  if (!isoString) return ''
  const d = new Date(isoString)
  return `${d.getMonth() + 1}-${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

onMounted(() => {
  handleTabChange(activeTab.value)
  if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
    Notification.requestPermission()
  }
  checkAlarmsInterval = setInterval(checkAlarms, 1000)
  document.addEventListener('keydown', handleScheduleKeyDown)
})

onUnmounted(() => {
  if (checkAlarmsInterval) {
    clearInterval(checkAlarmsInterval)
  }
  document.removeEventListener('keydown', handleScheduleKeyDown)
})
</script>

<style scoped>
.plan-container {
  height: 100%;
}

/* 修复 Tab 切换区域 hover 时鼠标闪烁问题 */
.plan-container :deep(.el-tabs__header) {
  cursor: default;
}

.plan-container :deep(.el-tabs__item) {
  cursor: pointer;
  user-select: none;
}

.plan-container :deep(.el-tabs__nav-wrap),
.plan-container :deep(.el-tabs__nav-scroll),
.plan-container :deep(.el-tabs__nav) {
  cursor: default;
}
/* 日历视图 - 拉高样式 */
.tall-calendar :deep(.el-calendar-table .el-calendar-day) {
  height: 140px;
  padding: 4px;
  cursor: pointer;
}

.tall-calendar :deep(.el-calendar-table) {
  cursor: default;
}

.tall-calendar :deep(.el-calendar-table td) {
  height: 140px;
}

.calendar-cell {
  height: 100%;
  min-height: 130px;
  position: relative;
  display: flex;
  flex-direction: column;
  cursor: pointer;
}
.calendar-day-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 5px;
}
.solar-day {
  font-size: 14px;
}
.lunar-day {
  font-size: 12px;
  color: #909399;
}
.lunar-day.is-festival {
  color: #E6A23C;
}
.lunar-day.is-holiday {
  color: #F56C6C;
}
.lunar-day.is-work {
  color: #909399;
}
.is-today {
  color: #409EFF;
  font-weight: bold;
}
.events-list {
  flex: 1;
  font-size: 12px;
  padding: 2px 5px;
  overflow-x: hidden;
  overflow-y: scroll;
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE 10+ */
}

.events-list::-webkit-scrollbar {
  display: none; /* Chrome, Safari, Edge */
}
.event-badge {
  border-radius: 2px;
  padding: 2px 4px;
  margin-bottom: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 16px;
}
.memo-badge {
  background-color: #f0f9eb;
  color: #67c23a;
}
.memo-badge.completed {
  background-color: #e4e7ed;
  color: #909399;
  text-decoration: line-through;
}
.process-badge {
  background-color: #ecf5ff;
  color: #409eff;
}
.habit-badge {
  background-color: #fdf6ec;
  color: #e6a23c;
}
.more-badge {
  font-size: 11px;
  color: #909399;
  text-align: center;
  padding: 2px;
}
.event-items {
  max-height: calc(100vh - 280px);
  overflow-y: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.event-items::-webkit-scrollbar {
  display: none;
}

/* 习惯项横向溢出换行处理 */
.habit-item {
  flex-wrap: wrap;
  overflow-x: hidden;
}

.section-title {
  font-size: 12px;
  color: #909399;
  margin-bottom: 8px;
  padding-bottom: 5px;
  border-bottom: 1px solid #ebeef5;
}
.event-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px;
  border-bottom: 1px solid var(--el-border-color-light, #EBEEF5);
  transition: background-color 0.2s;
  color: var(--el-text-color-primary, #303133);
}
.event-item:hover {
  background-color: var(--el-fill-color-light, #FAFAFA);
}
.memo-item {
  border-left: 3px solid #67c23a;
  padding-left: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}
.memo-item.completed .memo-content {
  text-decoration: line-through;
  color: var(--el-text-color-secondary);
}
.memo-content {
  flex: 1;
  cursor: pointer;
}
.process-item {
  border-left: 3px solid #409eff;
  padding-left: 8px;
  flex-direction: column;
  align-items: flex-start;
}
.process-info {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}
.process-name {
  font-weight: bold;
}

/* 习惯项横向溢出换行处理 */
.habit-item {
  flex-wrap: wrap;
  overflow-x: hidden;
}
.process-date {
  font-size: 12px;
  color: #909399;
}
.event-actions {
  display: flex;
  gap: 10px;
  opacity: 1;
  transition: opacity 0.2s;
}
.habit-actions {
  cursor: pointer;
}
.action-icon {
  color: #909399;
  font-size: 16px;
  cursor: inherit;
}
.action-icon:hover {
  color: #409EFF;
}
.action-icon.danger:hover {
  color: #F56C6C;
}

.habit-checks {
  display: flex;
  gap: 10px;
}
.habit-checks {
  cursor: pointer;
}

.check-box {
  width: 36px;
  height: 50px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  cursor: inherit;
  background-color: #f4f4f5;
  color: #909399;
  transition: background-color 0.2s, color 0.2s, border-color 0.2s;
}
.check-box:hover {
  background-color: #e9e9eb;
}
.check-box.checked {
  background-color: #f0f9eb;
  color: #67c23a;
  border: 1px solid #e1f3d8;
}
.date-label {
  font-size: 12px;
  margin-bottom: 4px;
}

/* 习惯项样式 */
.habit-item {
  border-left: 3px solid #e6a23c;
  padding-left: 8px;
  cursor: pointer;
  transition: all 0.2s;
}
.habit-item:hover {
  background-color: var(--el-fill-color-light, #f5f7fa);
  transform: translateX(4px);
}
.habit-info {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  max-width: 100%;
}
.habit-icon {
  font-size: 16px;
}
.habit-name {
  font-weight: bold;
}

/* 习惯打卡页面布局 */
.habit-container {
  display: flex;
  gap: 40px;
  height: 100%;
}

.habit-list-section {
  flex: 0 0 55%;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.habit-list-header {
  margin-bottom: 15px;
  display: flex;
  align-items: center;
  gap: 15px;
}



.habit-list {
  flex: 1;
  overflow-y: auto;
}

.habit-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--el-bg-color, #fff);
  border-radius: 12px;
  margin-bottom: 12px;
  transition: all 0.3s;
  border: 2px solid transparent;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  user-select: none;
  -webkit-user-select: none;
  cursor: pointer;
}

.habit-row:active {
  background: var(--el-fill-color-light, #f5f7fa);
}

.habit-row:hover {
  box-shadow: 0 4px 16px rgba(0,0,0,0.08);
  transform: translateY(-1px);
}

.habit-row.active {
  border-color: #409eff;
  background: var(--el-fill-color-light, #f5f7fa);
}

.habit-info-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.habit-actions {
  display: flex;
  gap: 8px;
  opacity: 1;
  transition: opacity 0.2s;
  flex: 1;
  padding-left: 16px;
}

.habit-icon-large {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  flex-shrink: 0;
  cursor: inherit;
  transition: transform 0.2s;
}

.habit-icon-large:hover {
  transform: scale(1.05);
}

.habit-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.habit-name-large {
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary, #303133);
  cursor: inherit;
}

.habit-stats {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: var(--el-text-color-secondary, #909399);
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.habit-week-checks {
  display: flex;
  gap: 6px;
  cursor: pointer;
}

.week-check-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  cursor: inherit;
}

.week-check-dot {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--el-fill-color, #f0f0f0);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  color: var(--el-text-color-secondary, #909399);
}

.week-check-dot:hover {
  background: var(--el-fill-color-darker, #e0e0e0);
}

.week-check-dot.checked {
  background: #67c23a;
  color: #fff;
}

.week-check-date {
  font-size: 10px;
  color: var(--el-text-color-secondary, #909399);
  white-space: nowrap;
}

/* 习惯详情面板 */
.habit-detail-section {
  flex: 0 0 40%;
  background: var(--el-bg-color, #fff);
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.06);
  overflow-y: auto;
  height: 100%;
  box-sizing: border-box;
}

.habit-detail-section.empty {
  display: flex;
  align-items: center;
  justify-content: center;
}

@media (max-height: 800px) {
  .habit-detail-section {
    max-height: calc(100vh - 160px);
    padding: 12px;
  }
  
  .detail-stats {
    margin-bottom: 12px;
  }
  
  .stat-card {
    padding: 8px;
  }
  
  .detail-calendar {
    padding: 8px;
  }
}

.detail-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--el-border-color-light, #ebeef5);
}

.detail-icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
}

.detail-name {
  font-size: 18px;
  font-weight: 600;
  color: var(--el-text-color-primary, #303133);
}

.detail-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 20px;
}

.stat-card {
  background: var(--el-fill-color-light, #f8f9fa);
  border-radius: 12px;
  padding: 12px;
  text-align: center;
}

.stat-icon {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #e6f7e6;
  color: #67c23a;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 6px;
  font-size: 16px;
}

.stat-icon.blue {
  background: #ecf5ff;
  color: #409eff;
}

.stat-icon.orange {
  background: #fdf6ec;
  color: #e6a23c;
}

.stat-icon.red {
  background: #fef0f0;
  color: #f56c6c;
}

.stat-label {
  font-size: 11px;
  color: var(--el-text-color-secondary, #909399);
  margin-bottom: 2px;
}

.stat-value {
  font-size: 18px;
  font-weight: 600;
  color: var(--el-text-color-primary, #303133);
}

/* 迷你日历 */
.detail-calendar {
  background: var(--el-fill-color-light, #f8f9fa);
  border-radius: 12px;
  padding: 12px;
}

.calendar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.calendar-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary, #303133);
}

.nav-arrow {
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: background 0.2s;
  color: var(--el-text-color-secondary, #909399);
}

.nav-arrow:hover {
  background: var(--el-fill-color, #e0e0e0);
}

.week-header {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
  margin-bottom: 6px;
}

.week-day {
  text-align: center;
  font-size: 11px;
  color: var(--el-text-color-secondary, #909399);
  padding: 2px;
}

.days-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}

.day-cell {
  aspect-ratio: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  cursor: pointer;
  position: relative;
  transition: all 0.2s;
}

.day-cell:hover:not(.other-month) {
  background: var(--el-fill-color, #e0e0e0);
}

.day-cell.other-month {
  color: var(--el-text-color-placeholder, #c0c4cc);
  cursor: default;
}

.day-cell.today {
  border: 2px solid #409eff;
}

.day-cell.checked {
  background: #67c23a;
  color: #fff;
}

.day-num {
  font-size: 13px;
  font-weight: 500;
}

.check-mark {
  font-size: 9px;
  position: absolute;
  bottom: 1px;
}
.icon-selector {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.icon-item {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  border-radius: 8px;
  cursor: pointer;
  background: #f4f4f5;
  transition: all 0.2s;
  border: 2px solid transparent;
  position: relative;
}
.icon-item:hover {
  background: #e9e9eb;
  transform: scale(1.05);
}
.icon-item.active {
  background: #409eff;
  border-color: #1a6fc4;
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.4);
}
.icon-item.active .icon-content {
  filter: brightness(0) invert(1);
}
.icon-content {
  display: block;
  line-height: 1;
}
.icon-content-img {
  width: 24px;
  height: 24px;
  object-fit: contain;
}
.dashed-btn {
  border: 2px dashed #dcdfe6;
  background: transparent;
  color: #8c939d;
}
.dashed-btn:hover {
  border-color: #409eff;
  color: #409eff;
  background: transparent;
}
.icon-upload-btn {
  display: inline-block;
}

.habit-icon-img {
  width: 16px;
  height: 16px;
  object-fit: contain;
}
.habit-icon-large-img {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  object-fit: cover;
  background: #f4f4f5;
  cursor: inherit;
  transition: transform 0.2s;
  flex-shrink: 0;
}
.habit-icon-large-img:hover {
  transform: scale(1.05);
}
.detail-icon-img {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
  background: #f4f4f5;
}

.process-card {
  margin-bottom: 20px;
  min-height: 250px;
  display: flex;
  flex-direction: column;
  transition: box-shadow 0.2s;
}
.process-card:hover {
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}
.process-card.is-completed {
  border-left: 4px solid #67C23A;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.process-name {
  font-weight: bold;
  font-size: 16px;
}
.process-meta {
  font-size: 12px;
  color: #909399;
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
}
.task-list {
  flex: 1;
  min-height: 100px;
  max-height: 280px;
  overflow-y: auto;
  overflow-x: hidden;
  margin-bottom: 10px;
  padding-right: 5px;
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.task-list::-webkit-scrollbar {
  display: none;
}
.task-item {
  display: flex;
  justify-content: flex-start;
  align-items: flex-start;
  padding: 8px 5px;
  border-bottom: 1px dashed #EBEEF5;
  border-radius: 4px;
  transition: background-color 0.2s;
  gap: 8px;
  overflow-x: hidden;
}

.task-item .el-checkbox {
  flex: 1;
  min-width: 0;
  white-space: normal;
  word-break: break-all;
  line-height: 1.5;
  height: auto;
  align-items: flex-start;
}
.task-item .el-checkbox__label {
  white-space: normal;
  word-break: break-all;
  line-height: 1.8;
  padding-top: 1px;
}
.task-item:hover {
  background-color: rgba(64, 158, 255, 0.1);
}
.task-done {
  text-decoration: line-through;
  color: #909399;
}
/* 完成时间标记显示为红色 */
.task-time-mark {
  color: #F56C6C;
  font-weight: 500;
}
.task-actions {
  display: flex;
  gap: 8px;
  cursor: pointer;
}
.edit-task-icon,
.delete-task-icon {
  color: #909399;
  font-size: 14px;
  opacity: 1;
  transition: opacity 0.2s, color 0.2s;
  cursor: pointer;
}
.edit-task-icon:hover {
  color: #409EFF;
}
.delete-task-icon:hover {
  color: #F56C6C;
}
.add-task-box {
  margin-top: auto;
}

/* 拖拽排序相关样式 */
.drag-handle {
  cursor: move;
  color: #C0C4CC;
  margin-right: 4px;
  font-size: 14px;
  transition: color 0.2s;
}

.task-index {
  color: #909399;
  font-size: 13px;
  margin-right: 4px;
  min-width: 20px;
  text-align: right;
}
.drag-handle:hover {
  color: #409EFF;
}
.sortable-ghost {
  opacity: 0.5;
  background-color: #F5F7FA;
  border: 1px dashed #409EFF;
}
.sortable-chosen {
  background-color: #ecf5ff;
}
.sortable-drag {
  opacity: 0.9;
  background-color: #fff;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
}

/* === 日常饮食样式 === */
.diet-container {
  display: flex;
  gap: 20px;
  height: 100%;
}

.diet-left {
  flex: 0 0 320px;
  display: flex;
  flex-direction: column;
}

.diet-calendar {
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 12px 0 rgba(0,0,0,0.1);
}

.diet-calendar :deep(.el-calendar-table .el-calendar-day) {
  height: 40px;
  padding: 0;
  cursor: pointer;
}

.diet-cal-cell {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.3s;
  cursor: pointer;
}

.diet-cal-cell.is-selected {
  background-color: #409EFF;
  color: #fff;
  font-weight: bold;
}

.diet-cal-cell.is-selected .is-today {
  color: #fff;
}

.diet-cal-cell .is-today {
  color: #409EFF;
  font-weight: bold;
}

.diet-meals-box {
  margin-top: 20px;
  background: var(--el-bg-color, #fff);
  padding: 16px;
  border-radius: 8px;
  box-shadow: 0 2px 12px 0 rgba(0,0,0,0.1);
}

.diet-meals-title {
  margin-top: 0;
  margin-bottom: 16px;
  font-size: 16px;
  color: var(--el-text-color-primary, #303133);
}

.diet-meal-item {
  margin-bottom: 16px;
}

.diet-meal-item:last-child {
  margin-bottom: 0;
}

.diet-meal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.diet-meal-label {
  font-weight: bold;
  font-size: 14px;
  color: var(--el-text-color-regular, #606266);
}

.diet-right {
  flex: 1;
  background: var(--el-bg-color, #fff);
  padding: 16px;
  border-radius: 8px;
  box-shadow: 0 2px 12px 0 rgba(0,0,0,0.1);
  display: flex;
  flex-direction: column;
}

.diet-right-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.diet-right-header h4 {
  margin: 0;
  font-size: 16px;
  color: var(--el-text-color-primary, #303133);
}

.diet-right-actions {
  display: flex;
  gap: 8px;
}

/* 不知道吃什么弹窗样式 */
.random-picker-section {
  padding: 20px 0;
}

.random-picker-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: var(--el-color-warning);
  margin-bottom: 20px;
}

.random-picker-box {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 16px;
  height: 140px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin-bottom: 24px;
  box-shadow: 0 8px 32px rgba(102, 126, 234, 0.3);
  transition: all 0.3s ease;
}

.random-picker-box.is-rolling {
  animation: pulse 0.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.02); }
}

.random-picker-placeholder {
  color: rgba(255, 255, 255, 0.7);
  font-size: 18px;
}

.random-picker-rolling {
  color: #fff;
  font-size: 28px;
  font-weight: bold;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  animation: rollText 0.1s linear;
}

@keyframes rollText {
  0% { opacity: 0.5; transform: translateY(-10px); }
  100% { opacity: 1; transform: translateY(0); }
}

.random-picker-result {
  text-align: center;
}

.result-shop {
  color: #fff;
  font-size: 32px;
  font-weight: bold;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  margin-bottom: 8px;
}

.result-label {
  color: rgba(255, 255, 255, 0.9);
  font-size: 14px;
  background: rgba(255, 255, 255, 0.2);
  padding: 4px 16px;
  border-radius: 20px;
}

.random-picker-actions {
  display: flex;
  justify-content: center;
  gap: 12px;
}

.random-picker-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 40px 0;
  color: #999;
  font-size: 14px;
}

.random-picker-empty .el-icon {
  font-size: 48px;
  color: #ddd;
}

.shop-stats-section {
  padding: 15px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
}

.shop-stats-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 1px solid #ebeef5;
}

.shop-chart-container {
  width: 100%;
  height: 320px;
}

/* === 闹钟与喝水样式 === */
.alarms-water-container {
  display: flex;
  gap: 20px;
  height: 100%;
}

.alarms-section {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
.section-header h4 {
  margin: 0;
  font-size: 18px;
  color: var(--el-text-color-primary);
}

.tools-bar {
  display: flex;
  gap: 15px;
  margin-bottom: 20px;
}

.tool-card {
  flex: 1;
  border-radius: 12px;
}
.tool-header {
  font-size: 16px;
  font-weight: bold;
  color: #606266;
  margin-bottom: 10px;
}
.tool-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}
.countdown-input, .countdown-display {
  display: flex;
  align-items: center;
  justify-content: center;
}
.time-large {
  font-size: 28px;
  font-family: 'Courier New', Courier, monospace;
  font-weight: bold;
  color: #409EFF;
}
.tool-actions {
  display: flex;
  gap: 10px;
}

.alarms-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 15px;
  overflow-y: auto;
  max-height: calc(100vh - 350px);
  padding-right: 5px;
}
.alarm-card {
  border-radius: 12px;
  position: relative;
  transition: all 0.3s;
}
.alarm-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}
.alarm-main {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.alarm-time-group {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.alarm-time {
  font-size: 36px;
  font-weight: bold;
  color: #303133;
  line-height: 1;
}
.alarm-countdown {
  font-size: 14px;
  color: #E6A23C;
  margin-bottom: 4px;
}
.alarm-content {
  font-size: 16px;
  color: #606266;
  font-weight: 500;
}
.alarm-days {
  display: flex;
  gap: 4px;
  margin-top: 5px;
  cursor: pointer;
}
.day-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  font-size: 14px;
  background-color: #F4F4F5;
  color: #C0C4CC;
  cursor: inherit;
  transition: all 0.2s;
}
.day-badge.active {
  background-color: #ECF5FF;
  color: #409EFF;
}
.day-badge:hover {
  transform: scale(1.1);
  box-shadow: 0 2px 6px rgba(0,0,0,0.15);
}
.alarm-actions {
  position: absolute;
  bottom: 15px;
  right: 15px;
  display: flex;
  gap: 5px;
  opacity: 1;
  transition: opacity 0.2s;
}

.water-section {
  flex: 0 0 380px;
  background: var(--el-bg-color);
  padding: 20px;
  border-radius: 12px;
  box-shadow: 0 2px 12px 0 rgba(0,0,0,0.05);
  display: flex;
  flex-direction: column;
}
.water-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}
.water-header h4 {
  margin: 0;
  font-size: 18px;
  color: var(--el-text-color-primary);
}
.weight-input {
  font-size: 16px;
  color: #606266;
}

.water-tips {
  background-color: #f8f9fa;
  padding: 10px 15px;
  border-radius: 8px;
  font-size: 14px;
  color: #909399;
  line-height: 1.5;
  margin-bottom: 20px;
}
.water-tips p {
  margin: 2px 0;
}

.water-display-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 20px;
}
.water-cup-container {
  width: 140px;
  height: 140px;
  border-radius: 50%;
  border: 4px solid #ECF5FF;
  position: relative;
  overflow: hidden;
  box-shadow: 0 8px 16px rgba(64, 158, 255, 0.2);
  margin-bottom: 15px;
  background-color: #fff;
}
.water-level {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  background: linear-gradient(180deg, #74b9ff 0%, #0984e3 100%);
  transition: height 1s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
.water-wave {
  position: absolute;
  top: -10px;
  left: 0;
  width: 200%;
  height: 20px;
  background: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 320"><path fill="%2374b9ff" fill-opacity="1" d="M0,160L48,170.7C96,181,192,203,288,197.3C384,192,480,160,576,165.3C672,171,768,213,864,224C960,235,1056,213,1152,192C1248,171,1344,149,1392,138.7L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path></svg>') repeat-x;
  background-size: 140px 20px;
  animation: wave 2s linear infinite;
}
@keyframes wave {
  0% { transform: translateX(0); }
  100% { transform: translateX(-140px); }
}
.water-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  z-index: 10;
  color: #303133;
  text-shadow: 0 0 4px rgba(255,255,255,0.8);
}
.water-today {
  font-size: 28px;
  font-weight: bold;
}
.water-unit {
  font-size: 16px;
}
.water-target-label {
  font-size: 14px;
}
.water-target-info {
  text-align: center;
  font-size: 16px;
  color: #606266;
}

.water-action {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: 20px;
}

.water-records-area {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.water-records-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}
.water-records-header h4 {
  margin: 0;
  font-size: 16px;
  color: #303133;
}

/* === 倒数日样式 === */
.countdown-days-section {
  margin-top: 20px;
}
.countdown-days-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}
.countdown-days-title {
  margin: 0;
  font-size: 15px;
  color: #606266;
  border-left: 3px solid #67C23A;
  padding-left: 10px;
}
.countdown-days-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}
.countdown-day-card {
  border-radius: 12px;
  transition: all 0.3s;
}
.countdown-day-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}
.countdown-day-main {
  display: flex;
  align-items: center;
  gap: 14px;
}
.countdown-day-remaining {
  font-size: 32px;
  font-weight: bold;
  color: #67C23A;
  min-width: 80px;
  text-align: center;
  white-space: nowrap;
}
.countdown-day-info {
  flex: 1;
  min-width: 0;
}
.countdown-day-label {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.countdown-day-range {
  font-size: 13px;
  color: #909399;
  margin-top: 3px;
}
.countdown-day-total {
  font-size: 12px;
  color: #C0C4CC;
  margin-top: 2px;
}
.countdown-day-actions {
  display: flex;
  justify-content: flex-end;
  gap: 4px;
  margin-top: 8px;
}

/* 计划表 */
.schedule-view {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 160px);
}

.schedule-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  flex-shrink: 0;
}

.schedule-nav-group {
  display: flex;
  gap: 6px;
}

.schedule-nav-btn {
  border-radius: 6px;
  font-weight: 500;
}

.schedule-nav-primary {
  background: linear-gradient(135deg, #409eff 0%, #66b1ff 100%);
  color: #fff;
  border: none;
}

.schedule-nav-primary:hover {
  background: linear-gradient(135deg, #66b1ff 0%, #409eff 100%);
  color: #fff;
}

.schedule-action-group {
  display: flex;
  gap: 8px;
}

.schedule-action-btn {
  border-radius: 6px;
  font-weight: 500;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
}

.schedule-grid {
  flex: 1;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--el-border-color-light, #e4e7ed);
  border-radius: 8px;
  overflow: hidden;
}

.schedule-header {
  display: grid;
  grid-template-columns: 60px repeat(7, 1fr);
  background-color: var(--el-fill-color-light, #f5f7fa);
  border-bottom: 1px solid var(--el-border-color-light, #e4e7ed);
}

.schedule-time-header,
.schedule-day-header {
  padding: 10px 4px;
  text-align: center;
  font-size: 13px;
  font-weight: 500;
  color: var(--el-text-color-regular, #606266);
  border-right: 1px solid var(--el-border-color-light, #e4e7ed);
}

.schedule-day-header:last-child {
  border-right: none;
}

.schedule-day-header.today {
  color: #409EFF;
  font-weight: bold;
  background-color: #ecf5ff;
}

.schedule-day-header.selected {
  background-color: #d9ecff;
  box-shadow: inset 0 -3px 0 #409eff;
  color: #303133;
  font-weight: 600;
}

.schedule-day-header.today.selected {
  background-color: #c6e2ff;
  box-shadow: inset 0 -3px 0 #409eff;
  color: #1677ff;
  font-weight: bold;
}

.schedule-body {
  position: relative;
  flex: 1;
  display: grid;
  grid-template-columns: 60px repeat(7, 1fr);
  overflow-y: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.schedule-body::-webkit-scrollbar {
  display: none;
}

.schedule-time-column {
  display: grid;
  grid-template-rows: repeat(24, 50px);
  background-color: var(--el-fill-color-light, #f5f7fa);
  border-right: 1px solid var(--el-border-color-light, #e4e7ed);
}

.schedule-time-cell {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary, #909399);
  border-bottom: 1px solid var(--el-border-color-lighter, #ebeef5);
}

.schedule-day-column {
  position: relative;
  display: grid;
  grid-template-rows: repeat(24, 50px);
  border-right: 1px solid var(--el-border-color-lighter, #ebeef5);
}

.schedule-day-column:last-child {
  border-right: none;
}

.schedule-cell {
  border-bottom: 1px solid var(--el-border-color-lighter, #ebeef5);
}

.schedule-block {
  position: absolute;
  padding: 4px 6px;
  border-radius: 4px;
  font-size: 12px;
  line-height: 1.3;
  color: #303133;
  border-left: 3px solid var(--block-color, #409eff);
  cursor: grab;
  user-select: none;
  overflow: hidden;
  z-index: 1;
  box-sizing: border-box;
  transition: opacity 0.15s ease, box-shadow 0.15s ease;
}

.schedule-block.schedule-block-previewing {
  opacity: 0.25;
}

.schedule-block.schedule-block-selected {
  box-shadow: 0 0 0 2px var(--block-color, #409eff), 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 5;
}

.schedule-block-preview {
  position: absolute;
  left: 4px;
  right: 4px;
  padding: 4px 6px;
  border-radius: 4px;
  font-size: 12px;
  line-height: 1.3;
  color: #303133;
  border-left: 3px solid var(--block-color, #409eff);
  user-select: none;
  overflow: hidden;
  z-index: 100;
  box-sizing: border-box;
  box-shadow: 0 4px 14px rgba(64, 158, 255, 0.35);
  opacity: 0.95;
  pointer-events: none;
  transition: none;
}

.schedule-block:active {
  cursor: grabbing;
  z-index: 10;
  opacity: 0.9;
}

.schedule-block-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow: hidden;
  pointer-events: none;
}

.schedule-block-content-horizontal {
  flex-direction: row;
  align-items: center;
  gap: 6px;
}

.schedule-block-content-horizontal .schedule-block-time {
  flex-shrink: 0;
}

.schedule-block-content-horizontal .schedule-block-text {
  flex: 1;
  min-width: 0;
}

.schedule-block-time {
  font-size: 11px;
  font-weight: 600;
  color: var(--block-color, #409eff);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex-shrink: 0;
}

.schedule-block-text {
  font-size: 12px;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.3;
}

.schedule-block-resize {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 8px;
  cursor: ns-resize;
  background: transparent;
  z-index: 2;
}

.schedule-block-resize:hover {
  background: rgba(64, 158, 255, 0.25);
}

.schedule-block-preview .schedule-block-resize {
  display: none;
}

.schedule-block-preview .schedule-block-time {
  color: var(--block-color, #409eff);
}

/* 预设配置弹窗样式 */
.schedule-preset-item {
  border: 1px solid var(--el-border-color-light, #e4e7ed);
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 12px;
  background-color: var(--el-fill-color-lighter, #fafafa);
}

.schedule-preset-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.schedule-preset-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary, #303133);
}

.schedule-preset-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.schedule-preset-slot {
  font-size: 13px;
  color: var(--el-text-color-regular, #606266);
  padding: 2px 0;
}

.schedule-preset-list {
  max-height: 400px;
  overflow-y: auto;
}

.schedule-preset-add {
  display: flex;
  justify-content: center;
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px dashed var(--el-border-color-light, #e4e7ed);
}

.schedule-preset-actions {
  display: flex;
  gap: 6px;
}

.schedule-preset-edit-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 320px;
  overflow-y: auto;
  padding-right: 4px;
}

.schedule-preset-edit-row {
  display: flex;
  align-items: center;
  gap: 0;
  padding: 6px 8px;
  border-radius: 6px;
  cursor: default;
  transition: background-color 0.15s ease;
}

.schedule-preset-edit-row:hover {
  background-color: var(--el-fill-color-light, #f5f7fa);
}

.schedule-preset-edit-row :deep(.el-input__wrapper),
.schedule-preset-edit-row :deep(.el-input__wrapper:hover),
.schedule-preset-edit-row :deep(.el-input__wrapper.is-focus),
.schedule-preset-edit-row :deep(.el-textarea__inner),
.schedule-preset-edit-row :deep(.el-textarea__inner:hover),
.schedule-preset-edit-row :deep(.el-textarea__inner:focus) {
  transition: none;
}

.schedule-preset-edit-row:hover :deep(.el-input__wrapper),
.schedule-preset-edit-row:hover :deep(.el-input__wrapper:hover) {
  background-color: transparent;
}

.preset-edit-dialog :deep(.el-dialog) {
  display: flex;
  flex-direction: column;
  height: 70vh;
  max-height: 90vh;
  overflow: hidden;
}

.preset-edit-dialog :deep(.el-dialog__body) {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.preset-edit-dialog .schedule-preset-edit-list {
  flex: 1;
  min-height: 120px;
  max-height: none;
}


</style>
