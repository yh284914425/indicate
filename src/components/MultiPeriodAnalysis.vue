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

    <!-- 修改分析结果的展示部分 -->
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
  </div>
</template>

<script setup lang="ts">
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
</script>

<style scoped>
.multi-period-analysis {
  padding: 16px;
  height: 100%;
}

.settings-card {
  margin-bottom: 16px;
  background-color: var(--card-background);
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 0;
}

.card-header h3 {
  margin: 0;
  font-size: 20px;
  color: var(--text-color);
  font-weight: 600;
}

.signal-count {
  color: #666;
  font-size: 14px;
  background: #f3f4f6;
  padding: 4px 12px;
  border-radius: 16px;
}

.settings {
  padding: 20px 0;
}

.select-group {
  display: flex;
  gap: 20px;
  align-items: center;
  flex-wrap: wrap;
}

.select-width {
  width: 260px;
}

.fetch-button {
  min-width: 120px;
  height: 34px;
}

.signals-card {
  background-color: var(--card-background);
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  height: calc(100% - 140px);
}

.table-container {
  height: 100%;
  padding: 10px 0;
}

:deep(.n-data-table) {
  height: 100%;
}

:deep(.n-data-table-base-table) {
  height: 100%;
}

:deep(.n-scrollbar) {
  height: 100%;
}

:deep(.n-scrollbar-container) {
  height: 100%;
}

:deep(.n-scrollbar.horizontal) {
  height: auto !important;
}

:deep(.n-scrollbar.vertical) {
  width: auto !important;
}

.days-input {
  width: 160px;
}

/* 移动端样式 */
.mobile-list {
  height: 100%;
  overflow-y: auto;
}

@media (max-width: 768px) {
  .multi-period-analysis {
    padding: 8px;
  }

  .settings-card {
    margin-bottom: 8px;
  }

  .select-group {
    gap: 8px;
  }

  .select-width {
    width: 100%;
  }

  .days-input {
    width: 100%;
  }

  .signals-card {
    height: calc(100% - 180px);
  }

  .table-container {
    padding: 0;
  }

  :deep(.n-list-item) {
    padding: 8px !important;
  }

  :deep(.n-space) {
    width: 100%;
  }
}

/* 确保移动端的滚动条正常工作 */
:deep(.n-list) {
  max-height: calc(100vh - 300px);
  overflow-y: auto;
}

/* 优化移动端的间距 */
:deep(.n-card-header) {
  padding: 12px !important;
}

:deep(.n-card__content) {
  padding: 8px !important;
}

/* 调整卡片间距 */
.signals-card + .signals-card {
  margin-top: 16px;
}

@media (max-width: 768px) {
  .signals-card + .signals-card {
    margin-top: 8px;
  }
}

/* 添加网格布局样式 */
.analysis-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-top: 16px;
  height: calc(100% - 140px);
}

.analysis-card {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.table-container {
  flex: 1;
  overflow: hidden;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .analysis-grid {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .analysis-card {
    height: 400px; /* 在移动端给定固定高度 */
  }
}

/* 调整表格样式 */
:deep(.n-data-table) {
  height: 100%;
}

:deep(.n-scrollbar-container) {
  height: 100%;
}

/* 确保内容可以滚动 */
:deep(.n-card-content) {
  height: calc(100% - 44px); /* 44px 是卡片标题的高度 */
  overflow: hidden;
}

/* 调整列宽度以适应三列布局 */
:deep(.n-data-table-td) {
  padding: 8px !important;
}

/* 优化表格在小屏幕上的显示 */
:deep(.n-data-table-th) {
  padding: 8px !important;
  white-space: nowrap;
}
</style> 