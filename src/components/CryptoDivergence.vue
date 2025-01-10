<!-- CryptoDivergence.vue -->
<template>
  <div class="crypto-divergence">
    <n-card class="settings-card">
      <template #header>
        <div class="card-header">
          <h3>单币种分析</h3>
        </div>
      </template>
      <div class="settings">
        <div class="select-group">
          <n-select
            v-model:value="selectedSymbol"
            :options="symbolOptions"
            placeholder="选择交易对"
            class="select-width"
            filterable
            :loading="loading"
            @update:value="fetchData"
          />
          <n-select
            v-model:value="selectedInterval"
            :options="intervalOptions"
            placeholder="选择时间间隔"
            class="select-width"
            @update:value="fetchData"
          />
          <n-select
            v-model:value="selectedLimit"
            :options="limitOptions"
            placeholder="选择K线数量"
            class="select-width"
            @update:value="fetchData"
          />
        </div>
        
        <div class="export-group">
          <n-date-picker
            v-model:value="selectedMonth"
            type="year"
            :is-date-disabled="disableFutureMonth"
            placeholder="选择年份"
            class="export-month"
          />
          <n-button
            type="primary"
            :loading="exporting"
            @click="exportData"
            class="export-button"
          >
            导出年度数据
          </n-button>
        </div>
      </div>
    </n-card>

    <n-card v-if="signals.length > 0" class="signals-card">
      <template #header>
        <div class="card-header">
          <h3>背离信号</h3>
          <span class="signal-count">共 {{ signals.length }} 个信号</span>
        </div>
      </template>
      <n-data-table
        :columns="columns"
        :data="signals"
        :bordered="false"
        :single-line="false"
        :loading="loading"
        class="signal-table"
        size="large"
        :pagination="false"
        :max-height="600"
      />
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, h } from 'vue'
import { 
  useMessage,
  NCard,
  NSelect,
  NButton,
  NDataTable,
  NInputNumber,
  NDatePicker
} from 'naive-ui'
import type { DataTableColumns } from 'naive-ui'
import type { KlineData } from '../services/cryptoService'
import { CryptoService } from '../services/cryptoService'
import { MultiSymbolService } from '../services/multiSymbolService'
import { saveAs } from 'file-saver'
import * as XLSX from 'xlsx'
import JSZip from 'jszip'

const message = useMessage()
const cryptoService = new CryptoService()
const multiSymbolService = new MultiSymbolService()

const selectedSymbol = ref('BTCUSDT')
const selectedInterval = ref('1h')
const signals = ref<any[]>([])
const loading = ref(false)

// 修改为动态获取的交易对列表
const symbolOptions = ref<Array<{ label: string, value: string }>>([])

// 获取所有交易对
const initSymbols = async () => {
  try {
    loading.value = true
    const symbols = await multiSymbolService.getAllSymbols()
    symbolOptions.value = symbols.map(symbol => ({
      label: symbol,
      value: symbol
    }))
  } catch (error) {
    console.error('获取交易对列表失败:', error)
    message.error('获取交易对列表失败')
  } finally {
    loading.value = false
  }
}

const intervalOptions = [
  { label: '15分钟', value: '15m' },
  { label: '30分钟', value: '30m' },
  { label: '1小时', value: '1h' },
  { label: '2小时', value: '2h' },
  { label: '4小时', value: '4h' },
  { label: '6小时', value: '6h' },
  { label: '8小时', value: '8h' },
  { label: '12小时', value: '12h' },
  { label: '1天', value: '1d' },
  { label: '3天', value: '3d' },
  { label: '1周', value: '1w' },
  { label: '1月', value: '1M' }
]

const selectedLimit = ref(1000)
const limitOptions = [
{ label: '100根', value: 100 },

  { label: '1000根', value: 1000 },
  { label: '2000根', value: 2000 },
  { label: '3000根', value: 3000 },
  { label: '4000根', value: 4000 },
  { label: '5000根', value: 5000 }
]

const columns: DataTableColumns = [
  {
    title: '时间',
    key: 'time'
  },
  {
    title: '类型',
    key: 'type',
    render(row: any) {
      return h(
        'div',
        {
          style: {
            color: row.type === '顶背离' ? '#d03050' : '#18a058',
            fontWeight: 'bold'
          }
        },
        row.type
      )
    }
  },
  {
    title: '价格',
    key: 'price',
    render(row: any) {
      return h(
        'div',
        {
          style: {
            color: row.type === '顶背离' ? '#d03050' : '#18a058',
            fontWeight: 'bold'
          }
        },
        row.price
      )
    }
  },
  {
    title: 'J值',
    key: 'j',
    render(row: any) {
      return h(
        'div',
        {
          style: {
            color: row.type === '顶背离' ? '#d03050' : '#18a058'
          }
        },
        row.j
      )
    }
  }
]

const fetchData = async () => {
  if (!selectedSymbol.value || !selectedInterval.value) {
    return;
  }
  
  try {
    loading.value = true;
    const klines = await cryptoService.getExtendedKlines(
      selectedSymbol.value,
      selectedInterval.value,
      selectedLimit.value
    );
    
    const { topDivergence, bottomDivergence, j } = cryptoService.calculateIndicators_KDJ(klines);

    const newSignals = [];
    for (let i = 0; i < klines.length; i++) {
      if (topDivergence[i] || bottomDivergence[i]) {
        newSignals.push({
          time: new Date(klines[i].openTime).toLocaleString(),
          type: topDivergence[i] ? '顶背离' : '底背离',
          price: parseFloat(klines[i].close).toFixed(2),
          j: j[i].toFixed(2)
        });
      }
    }

    signals.value = newSignals.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
    
    if (newSignals.length === 0) {
      message.info('当前时间范围内未发现背离信号');
    } else {
      message.success(`发现 ${newSignals.length} 个背离信号`);
    }
  } catch (error) {
    console.error('Error:', error);
    message.error(error instanceof Error ? error.message : '获取数据失败');
  } finally {
    loading.value = false;
  }
};

const selectedMonth = ref<number | null>(null)

// 禁用未来月份
const disableFutureMonth = (ts: number) => {
  return ts > Date.now()
}

const exporting = ref(false)

// 修改导出数据函数
const exportData = async () => {
  if (!selectedSymbol.value) {
    message.error('请选择交易对')
    return
  }

  if (!selectedMonth.value) {
    message.error('请选择年份')
    return
  }

  try {
    exporting.value = true
    const selectedYear = new Date(selectedMonth.value).getFullYear()
    const startTime = new Date(selectedYear, 0, 1).getTime()
    const endTime = new Date(selectedYear + 1, 0, 1).getTime()
    
    // 显示进度
    const progressBar = message.loading('正在获取数据...', { duration: 0 })
    
    // 获取并合成所有周期的数据
    const allData = await cryptoService.getYearlyData(
      selectedSymbol.value,
      startTime,
      endTime,
      (progress) => {
        progressBar.content = `正在获取数据... ${Math.floor(progress)}%`
      }
    )
    
    progressBar.destroy()
    message.info('正在处理数据...')
    
    // 使用15分钟数据作为基准时间线
    const baseKlines = allData['15m'].klines
    const exportRows: any[] = []
    
    // 遍历每个15分钟数据点
    for (let i = 0; i < baseKlines.length; i++) {
      const time = new Date(baseKlines[i].openTime)
      const row: any = {
        '时间': time.toLocaleString(),
        '15分钟价格': parseFloat(baseKlines[i].close).toFixed(8),
        '15分钟J值': allData['15m'].indicators.j[i].toFixed(2),
        '15分钟背离': allData['15m'].indicators.bottomDivergence[i] ? '底背离' : 
                    (allData['15m'].indicators.topDivergence[i] ? '顶背离' : '')
      }
      
      // 添加其他周期的数据
      Object.entries(allData).forEach(([period, data]) => {
        if (period === '15m') return // 跳过15分钟数据，因为已经添加过了
        
        // 找到对应的数据点
        const periodData = data.klines.find(k => 
          k.openTime <= baseKlines[i].openTime && 
          k.closeTime >= baseKlines[i].closeTime
        )
        
        if (periodData) {
          row[`${period}价格`] = parseFloat(periodData.close).toFixed(8)
          const index = data.klines.indexOf(periodData)
          if (index !== -1) {
            row[`${period}J值`] = data.indicators.j[index].toFixed(2)
            row[`${period}背离`] = data.indicators.bottomDivergence[index] ? '底背离' : 
                                  (data.indicators.topDivergence[index] ? '顶背离' : '')
          }
        } else {
          row[`${period}价格`] = ''
          row[`${period}J值`] = ''
          row[`${period}背离`] = ''
        }
      })
      
      exportRows.push(row)
    }
    
    // 创建工作簿
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(exportRows)
    
    // 设置列宽
    const colWidths = [
      { wch: 20 } // 时间
    ]
    
    // 为每个周期添加列宽
    Object.keys(allData).forEach(() => {
      colWidths.push(
        { wch: 15 }, // 价格
        { wch: 12 }, // J值
        { wch: 10 }  // 背离
      )
    })
    
    ws['!cols'] = colWidths
    
    // 添加工作表到工作簿
    XLSX.utils.book_append_sheet(wb, ws, '背离数据')
    
    // 导出文件
    const fileName = `${selectedSymbol.value}_${selectedYear}_all_periods.xlsx`
    XLSX.writeFile(wb, fileName)
    
    message.success('导出成功')
  } catch (error) {
    console.error('导出失败:', error)
    message.error('导出失败')
  } finally {
    exporting.value = false
  }
}

onMounted(async () => {
  await initSymbols(); // 先获取所有交易对
  fetchData();
});
</script>

<style scoped>
.crypto-divergence {
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
  width: 240px;
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
  overflow: auto;
}

.signal-table {
  height: 100%;
}

:deep(.n-data-table .n-data-table-td) {
  padding: 16px;
}

:deep(.n-data-table .n-data-table-th) {
  padding: 16px;
  background-color: #f9fafb;
  font-weight: 600;
  font-size: 14px;
}

:deep(.n-card-header) {
  padding: 20px 24px;
  border-bottom: 1px solid var(--border-color);
}

:deep(.n-card__content) {
  padding: 24px;
}

:deep(.n-button) {
  font-weight: 500;
}

:deep(.n-select) {
  .n-base-selection {
    border-radius: 8px;
  }
}

:deep(.n-data-table) {
  max-height: none !important;
}

.export-group {
  display: flex;
  gap: 20px;
  align-items: center;
  margin-top: 20px;
}

.export-month {
  width: 160px;
}

.export-button {
  min-width: 120px;
}

@media (max-width: 768px) {
  .crypto-divergence {
    padding: 8px;
    height: calc(100vh - 140px);
    overflow: auto;
  }

  .settings-card {
    margin-bottom: 12px;
  }

  .select-width {
    width: 100%;
  }

  .select-group {
    flex-direction: column;
    gap: 12px;
  }

  .signals-card {
    height: calc(100% - 180px);
  }

  :deep(.n-data-table-wrapper) {
    overflow: auto;
  }

  :deep(.n-card-header) {
    padding: 12px 16px;
  }

  :deep(.n-card__content) {
    padding: 12px;
  }

  .export-group {
    flex-direction: column;
    gap: 12px;
  }
  
  .export-month {
    width: 100%;
  }
  
  .export-button {
    width: 100%;
  }
}
</style>
