<template>
  <div class="multi-period-analysis">
    <n-card class="settings-card">
      <template #header>
        <div class="card-header">
          <h3>多周期分析</h3>
          <n-tag v-if="signalCount > 0" class="signal-count">
            发现 {{ signalCount }} 个信号
          </n-tag>
        </div>
      </template>

      <div class="settings">
        <div class="select-group">
          <n-select
            v-model:value="selectedSymbol"
            :options="symbolOptions"
            placeholder="选择或搜索交易对"
            class="select-width"
            :loading="loadingSymbols"
            filterable
            clearable
            @update:value="handleSymbolChange"
          />
          <n-input-number
            v-model:value="days"
            :min="1"
            :max="60"
            class="days-input"
            @update:value="fetchAllData"
          >
            <template #prefix>
              分析天数
            </template>
            <template #suffix>
              天
            </template>
          </n-input-number>
        </div>
      </div>
    </n-card>

    <!-- 分析结果网格 -->
    <div class="content-scroll">
      <div class="analysis-grid">
        <!-- BTC和ETH的分析结果 -->
        <n-card 
          v-for="symbol in mainSymbols" 
          :key="symbol" 
          class="analysis-card" 
          :title="symbol"
        >
          <div class="table-container">
            <!-- PC端表格 -->
            <n-data-table
              v-if="!isMobile"
              :columns="columns"
              :data="getSymbolData(symbol)"
              :loading="loadingMap[symbol]"
              :scroll-x="800"
              :max-height="500"
              virtual-scroll
            />
            <!-- 移动端列表 -->
            <div v-else class="mobile-list">
              <n-spin :show="loadingMap[symbol]">
                <n-list>
                  <n-list-item v-for="item in getSymbolData(symbol)" :key="`${item.period}-${item.time}`">
                    <n-space vertical>
                      <n-space justify="space-between" align="center">
                        <n-tag size="small" :type="item.period.includes('d') ? 'success' : 'warning'">
                          {{ item.period }}
                        </n-tag>
                        <n-text :style="{ color: item.type === 'top' ? '#d03050' : '#18a058' }">
                          {{ item.type === 'top' ? '顶背离' : '底背离' }}
                        </n-text>
                      </n-space>
                      <n-space justify="space-between" align="center">
                        <n-text depth="3">{{ item.time }}</n-text>
                        <n-text>{{ parseFloat(item.price).toFixed(2) }}</n-text>
                      </n-space>
                    </n-space>
                  </n-list-item>
                </n-list>
              </n-spin>
            </div>
          </div>
        </n-card>

        <!-- PEPE的分析结果 -->
        <n-card 
          v-if="selectedSymbol && !mainSymbols.includes(selectedSymbol)" 
          class="analysis-card"
          :title="selectedSymbol"
        >
          <div class="table-container">
            <!-- PC端表格 -->
            <n-data-table
              v-if="!isMobile"
              :columns="columns"
              :data="getSymbolData(selectedSymbol)"
              :loading="loadingMap[selectedSymbol]"
              :scroll-x="800"
              :max-height="500"
              virtual-scroll
            />
            <!-- 移动端列表 -->
            <div v-else class="mobile-list">
              <n-spin :show="loadingMap[selectedSymbol]">
                <n-list>
                  <n-list-item v-for="item in getSymbolData(selectedSymbol)" :key="`${item.period}-${item.time}`">
                    <n-space vertical>
                      <n-space justify="space-between" align="center">
                        <n-tag size="small" :type="item.period.includes('d') ? 'success' : 'warning'">
                          {{ item.period }}
                        </n-tag>
                        <n-text :style="{ color: item.type === 'top' ? '#d03050' : '#18a058' }">
                          {{ item.type === 'top' ? '顶背离' : '底背离' }}
                        </n-text>
                      </n-space>
                      <n-space justify="space-between" align="center">
                        <n-text depth="3">{{ item.time }}</n-text>
                        <n-text>{{ parseFloat(item.price).toFixed(2) }}</n-text>
                      </n-space>
                    </n-space>
                  </n-list-item>
                </n-list>
              </n-spin>
            </div>
          </div>
        </n-card>
      </div>

      <!-- 信号分布图 -->
      <n-card class="timeline-card" title="信号分布图">
        <div class="heatmap">
          <div class="time-labels">
            <div v-for="hour in 24" :key="hour" class="hour-label">
              {{ hour - 1 }}:00
            </div>
          </div>
          <div class="heatmap-grid">
            <div v-for="(day, dayIndex) in daysArray" :key="dayIndex" class="day-column">
              <div class="day-label">{{ formatDate(day) }}</div>
              <div class="hour-cells">
                <div 
                  v-for="hour in 24" 
                  :key="hour"
                  class="cell"
                  :class="getCellClass(day, hour - 1)"
                  @mouseenter="showTooltip($event, day, hour - 1)"
                  @mouseleave="hideTooltip"
                >
                  <template v-if="isActiveCell(day, hour - 1)">
                    <div class="signal-indicators">
                      <div v-for="(signals, symbol) in getGroupedSignals(day, hour - 1)" :key="symbol" class="symbol-signals">
                        <span class="symbol-label">{{ getShortSymbol(symbol) }}</span>
                        <span v-if="signals.top" class="top-signal">顶</span>
                        <span v-if="signals.bottom" class="bottom-signal">底</span>
                      </div>
                    </div>
                  </template>
                </div>
              </div>
            </div>
          </div>
        </div>
        <!-- 悬浮提示 -->
        <div v-if="tooltipVisible" class="tooltip" :style="tooltipStyle">
          <div class="tooltip-header">{{ tooltipContent.time }}</div>
          <div v-for="signal in tooltipContent.signals" :key="signal.id" class="tooltip-item">
            <span :style="{ color: signal.type === 'top' ? '#d03050' : '#18a058' }">
              {{ signal.symbol }}
            </span>
            <span>({{ signal.period }})</span>
            <span>{{ signal.type === 'top' ? '顶背离' : '底背离' }}</span>
          </div>
        </div>
      </n-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import * as echarts from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { ScatterChart } from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TimelineComponent,
} from 'echarts/components'
import { use } from 'echarts/core'
import VChart from 'vue-echarts'
import { ref, computed, onMounted, h } from 'vue'
import { useMessage } from 'naive-ui'
import type { DataTableColumns } from 'naive-ui'
import { MultiPeriodService } from '../services/multiPeriodService'

const message = useMessage()
const multiPeriodService = new MultiPeriodService()

// 主要币种列表
const mainSymbols = ['BTCUSDT', 'ETHUSDT']
const selectedSymbol = ref('PEPEUSDT')
const days = ref(7)  // 添加天数状态
const loadingMap = ref<Record<string, boolean>>({})
const resultsMap = ref<Record<string, any[]>>({})

// 获取指定币种的数据
const getSymbolData = (symbol: string) => {
  return resultsMap.value[symbol] || []
}

// 计算总信号数
const signalCount = computed(() => {
  return Object.values(resultsMap.value).reduce((total, results) => total + results.length, 0)
})

// 处理币种选择变化
const handleSymbolChange = async (value: string) => {
  if (value && !mainSymbols.includes(value)) {
    await fetchData(value)
  }
}

// 获取单个币种的分析数据
const fetchData = async (symbol: string) => {
  if (!symbol) return

  try {
    loadingMap.value[symbol] = true
    const results = await multiPeriodService.analyze(symbol, days.value)
    resultsMap.value[symbol] = results
  } catch (error) {
    message.error(`分析${symbol}失败`)
    console.error(error)
  } finally {
    loadingMap.value[symbol] = false
  }
}

// 获取所有需要分析的币种的数据
const fetchAllData = async () => {
  // 分析主要币种
  await Promise.all(mainSymbols.map(symbol => fetchData(symbol)))
  
  // 如果选择了其他币种，也进行分析
  if (selectedSymbol.value && !mainSymbols.includes(selectedSymbol.value)) {
    await fetchData(selectedSymbol.value)
  }
}

// 初始化
onMounted(async () => {
  await initSymbols()
  // 先分析主要币种
  await Promise.all(mainSymbols.map(symbol => fetchData(symbol)))
  // 然后分析 PEPE
  if (selectedSymbol.value) {
    await fetchData(selectedSymbol.value)
  }
})

// 状态
const loading = ref(false)
const loadingSymbols = ref(false)
const symbolOptions = ref<Array<{
  label: string
  value: string
  volume?: string  // 可选的交易量信息
}>>([])

// 表格列定义
const columns: DataTableColumns = [
  {
    title: '周期',
    key: 'period',
    width: 100,
    sorter: 'default'
  },
  {
    title: '类型',
    key: 'type',
    width: 100,
    render: (row) => {
      const color = row.type === 'top' ? '#d03050' : '#18a058'
      const text = row.type === 'top' ? '顶背离' : '底背离'
      return h('span', { style: { color } }, text)
    },
    sorter: 'default'
  },
  {
    title: '时间',
    key: 'time',
    width: 200,
    sorter: (row1: any, row2: any) => {
      return new Date(row1.time).getTime() - new Date(row2.time).getTime()
    }
  },
  {
    title: '价格',
    key: 'price',
    width: 150,
    render: (row) => {
      return h('span', {}, parseFloat(row.price).toFixed(2))
    },
    sorter: (row1: any, row2: any) => {
      return parseFloat(row1.price) - parseFloat(row2.price)
    }
  }
]

// 初始化交易对列表
const initSymbols = async () => {
  try {
    loadingSymbols.value = true
    const symbols = await multiPeriodService.getSymbols()
    
    // 获取24小时交易量数据
    const response = await fetch('https://api.binance.com/api/v3/ticker/24hr')
    const tickers = await response.json()
    const volumeMap = new Map(
      tickers.map((ticker: any) => [
        ticker.symbol,
        parseFloat(ticker.volume).toLocaleString()
      ])
    )
    
    symbolOptions.value = symbols.map(symbol => ({
      label: `${symbol} ${volumeMap.get(symbol) ? `(24h量: ${volumeMap.get(symbol)})` : ''}`,
      value: symbol
    }))
  } catch (error) {
    message.error('获取交易对列表失败')
    console.error(error)
  } finally {
    loadingSymbols.value = false
  }
}

// 添加移动端检测
const isMobile = computed(() => {
  return window.innerWidth <= 768
})

// 监听窗口大小变化
window.addEventListener('resize', () => {
  // 触发响应式更新
  isMobile.value = window.innerWidth <= 768
})

// 添加合并信号的计算属性
const mergedSignals = computed(() => {
  const signals: Array<{
    symbol: string
    period: string
    type: 'top' | 'bottom'
    time: string
    price: string
  }> = []

  // 合并主要币种的信号
  mainSymbols.forEach(symbol => {
    const data = getSymbolData(symbol)
    signals.push(...data.map(item => ({
      symbol,
      ...item
    })))
  })

  // 添加选中币种的信号
  if (selectedSymbol.value && !mainSymbols.includes(selectedSymbol.value)) {
    const data = getSymbolData(selectedSymbol.value)
    signals.push(...data.map(item => ({
      symbol: selectedSymbol.value,
      ...item
    })))
  }

  // 按时间降序排序
  return signals.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
})

// 注册必要的 ECharts 组件
use([
  CanvasRenderer,
  ScatterChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TimelineComponent,
])

// 添加热力图相关的状态和方法
const tooltipVisible = ref(false)
const tooltipStyle = ref({
  top: '0px',
  left: '0px'
})
const tooltipContent = ref({
  time: '',
  signals: []
})

// 获取最近7天的日期
const daysArray = computed(() => {
  const result = []
  const today = new Date()
  for (let i = 6; i >= 0; i--) {
    const date = new Date()
    date.setDate(today.getDate() - i)
    date.setHours(0, 0, 0, 0)
    result.push(date)
  }
  return result
})

// 格式化日期
const formatDate = (date: Date) => {
  return `${date.getMonth() + 1}/${date.getDate()}`
}

// 检查单元格是否有信号
const isActiveCell = (day: Date, hour: number) => {
  const signals = getSignalsForHour(day, hour)
  return signals.length > 0
}

// 获取指定时间的信号数量
const getSignalCount = (day: Date, hour: number) => {
  const signals = getSignalsForHour(day, hour)
  return signals.length
}

// 获取单元格的类名
const getCellClass = (day: Date, hour: number) => {
  const signals = getSignalsForHour(day, hour)
  if (signals.length === 0) return 'empty'
  if (signals.length <= 2) return 'low'
  if (signals.length <= 4) return 'medium'
  return 'high'
}

// 获取指定时间的信号
const getSignalsForHour = (day: Date, hour: number) => {
  return mergedSignals.value.filter(signal => {
    const signalDate = new Date(signal.time)
    return signalDate.getDate() === day.getDate() &&
           signalDate.getMonth() === day.getMonth() &&
           signalDate.getHours() === hour
  })
}

// 显示提示框
const showTooltip = (event: MouseEvent, day: Date, hour: number) => {
  const signals = getSignalsForHour(day, hour)
  if (signals.length === 0) return

  const rect = (event.target as HTMLElement).getBoundingClientRect()
  tooltipStyle.value = {
    top: `${rect.top - 10}px`,
    left: `${rect.right + 10}px`
  }
  tooltipContent.value = {
    time: `${formatDate(day)} ${hour}:00`,
    signals
  }
  tooltipVisible.value = true
}

// 隐藏提示框
const hideTooltip = () => {
  tooltipVisible.value = false
}

// 添加检查顶底背离的方法
const hasTopDivergence = (day: Date, hour: number) => {
  const signals = getSignalsForHour(day, hour)
  return signals.some(signal => signal.type === 'top')
}

const hasBottomDivergence = (day: Date, hour: number) => {
  const signals = getSignalsForHour(day, hour)
  return signals.some(signal => signal.type === 'bottom')
}

// 获取币种的简短显示
const getShortSymbol = (symbol: string) => {
  return symbol.replace('USDT', '')
}

// 获取按币种分组的信号
const getGroupedSignals = (day: Date, hour: number) => {
  const signals = getSignalsForHour(day, hour)
  const grouped: Record<string, { top: boolean; bottom: boolean }> = {}
  
  signals.forEach(signal => {
    if (!grouped[signal.symbol]) {
      grouped[signal.symbol] = { top: false, bottom: false }
    }
    if (signal.type === 'top') {
      grouped[signal.symbol].top = true
    } else {
      grouped[signal.symbol].bottom = true
    }
  })
  
  return grouped
}
</script>

<style scoped>
/* 主容器样式 */
.multi-period-analysis {
  height: 100vh;
  display: flex;
  flex-direction: column;
  padding: 16px;
}

/* 设置卡片样式 */
.settings-card {
  flex-shrink: 0;
  margin-bottom: 16px;
}

/* 内容滚动区域 */
.content-scroll {
  flex: 1;
  min-height: 0;  /* 关键：允许内容区域收缩 */
  overflow-y: auto;
  padding-right: 8px;
}

/* 分析网格 */
.analysis-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 16px;
}

/* 时间轴卡片 */
.timeline-card {
  margin-bottom: 16px;
  display: flex;
  flex-direction: column;
}

/* 热力图容器 */
.heatmap {
  display: flex;
  /* padding: 20px; */
  height: 1200px;  /* 增加高度 */
}

/* 时间标签列 */
.time-labels {
  display: flex;
  flex-direction: column;
  margin-right: 10px;
  flex-shrink: 0;
  height: 100%;
}

.hour-label {
  height: 45px;  /* 固定高度，不使用 flex */
  font-size: 13px;
  color: #666;
  display: flex;
  align-items: center;
}

/* 热力图网格 */
.heatmap-grid {
  display: flex;
  gap: 8px;
  flex: 1;
  height: 100%;
}

.day-column {
  display: flex;
  flex-direction: column;
  min-width: 100px;
  flex: 1;
}

.day-label {
  text-align: center;
  font-size: 14px;
  font-weight: 500;
  color: #666;
  padding: 8px 0;
  background: white;
}

.hour-cells {
  display: flex;
  flex-direction: column;
  gap: 4px;
  height: calc(100% - 40px);  /* 减去日期标签的高度 */
}

/* 单元格样式 */
.cell {
  height: 45px;
  min-height: 45px;
  border-radius: 4px;
  background-color: #f5f5f5;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: #666;
  padding: 4px;
}

.signal-indicators {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
}

.symbol-signals {
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: 11px;
}

.symbol-label {
  color: #666;
  font-size: 10px;
  min-width: 24px;
}

.top-signal {
  color: #d03050;
  font-weight: bold;
}

.bottom-signal {
  color: #18a058;
  font-weight: bold;
}

/* 单元格颜色样式 */
.cell.empty {
  background-color: #f5f5f5;
}

.cell.low {
  background-color: #f9f9f9;  /* 减淡背景色 */
}

.cell.medium {
  background-color: #f9f9f9;
}

.cell.high {
  background-color: #f9f9f9;
  color: #666;
}

/* 确保卡片内容可以完整显示 */
:deep(.n-card-content) {
  height: auto !important;
  overflow: visible !important;
  display: flex;
  flex-direction: column;
  flex: 1;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .multi-period-analysis {
    padding: 8px;
  }

  .heatmap {
    height: 1000px;
  }

  .hour-label,
  .cell {
    height: 38px;
    min-height: 38px;
  }

  .signal-indicators {
    gap: 2px;
  }

  .top-signal,
  .bottom-signal {
    font-size: 11px;  /* 移动端更小的字体 */
  }

  .symbol-signals {
    font-size: 10px;
  }

  .symbol-label {
    font-size: 9px;
    min-width: 20px;
  }
}
</style> 