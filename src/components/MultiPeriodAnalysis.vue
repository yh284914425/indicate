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
            @update:value="fetchData"
          />
          <n-input-number
            v-model:value="days"
            :min="1"
            :max="60"
            class="days-input"
            @update:value="fetchData"
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

    <n-card class="signals-card">
      <div class="table-container">
        <n-data-table
          :columns="columns"
          :data="tableData"
          :loading="loading"
          :scroll-x="1200"
          :max-height="500"
          virtual-scroll
        />
      </div>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, h } from 'vue'
import { useMessage } from 'naive-ui'
import type { DataTableColumns } from 'naive-ui'
import { MultiPeriodService } from '../services/multiPeriodService'

const message = useMessage()
const multiPeriodService = new MultiPeriodService()

// 状态
const selectedSymbol = ref('BTCUSDT')
const loading = ref(false)
const loadingSymbols = ref(false)
const symbolOptions = ref<Array<{
  label: string
  value: string
  volume?: string  // 可选的交易量信息
}>>([])
const analysisResults = ref<Array<{
  period: string
  type: 'top' | 'bottom'
  time: string
  price: string
}>>([])
const days = ref(7)

// 计算属性
const signalCount = computed(() => analysisResults.value.length)

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

const tableData = computed(() => {
  return analysisResults.value.map(result => ({
    ...result,
    time: new Date(result.time).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }))
})

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

// 获取分析数据
const fetchData = async () => {
  if (!selectedSymbol.value) return

  try {
    loading.value = true
    const results = await multiPeriodService.analyze(selectedSymbol.value, days.value)
    analysisResults.value = results
  } catch (error) {
    message.error('分析失败')
    console.error(error)
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await initSymbols()
  await fetchData()
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
</style> 