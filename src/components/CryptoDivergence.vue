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
    
    const { topDivergence, bottomDivergence, j } = cryptoService.calculateIndicators(klines);

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
    const zip = new JSZip()
    
    // 创建一个文件夹来存储Excel文件
    const folder = zip.folder(`${selectedSymbol.value}_${selectedYear}`)
    
    // 处理12个月的数据
    for (let month = 0; month < 12; month++) {
      message.info(`正在处理 ${month + 1} 月数据...`)
      
      // 计算每个月的起止时间
      const startTime = new Date(selectedYear, month, 1).getTime()
      const endTime = new Date(selectedYear, month + 1, 0, 23, 59, 59, 999).getTime()
      
      // 如果是未来的月份，跳过
      if (startTime > Date.now()) {
        continue
      }
      
      // 获取所有时间周期的数据
      const intervals = ['1h', '2h', '4h', '6h', '12h', '1d', '1w'] as const
      const periodMilliseconds = {
        '1h': 60 * 60 * 1000,
        '2h': 2 * 60 * 60 * 1000,
        '4h': 4 * 60 * 60 * 1000,
        '6h': 6 * 60 * 60 * 1000,
        '12h': 12 * 60 * 60 * 1000,
        '1d': 24 * 60 * 60 * 1000,
        '1w': 7 * 24 * 60 * 60 * 1000
      } as const

      const allData = await Promise.all(intervals.map(async interval => {
        const klines = await cryptoService.getKlinesWithTime(
          selectedSymbol.value,
          interval,
          startTime,
          endTime
        )
        const indicators = cryptoService.calculateIndicators(klines)
        return { klines, indicators, interval }
      }))

      // 准备导出数据
      const exportRows: any[] = []
      
      // 使用1小时数据作为基准
      const baseData = allData[0] // 1小时数据
      
      // 为其他周期创建时间映射
      const periodDataMaps = new Map()
      
      // 创建每个周期的数据映射
      allData.slice(1).forEach((periodData, index) => {
        const period = intervals[index + 1]
        const periodMs = periodMilliseconds[period]
        const dataMap = new Map()
        
        periodData.klines.forEach((kline, idx) => {
          // 对于周线数据，需要特殊处理时间对齐
          let periodTimestamp
          if (period === '1w') {
            // 获取这个时间戳所在的周一凌晨时间
            const date = new Date(kline.openTime)
            const day = date.getDay() || 7 // 将周日的0转换为7
            const mondayTime = new Date(date.getTime() - (day - 1) * 24 * 60 * 60 * 1000)
            mondayTime.setHours(0, 0, 0, 0)
            periodTimestamp = mondayTime.getTime()
          } else {
            // 其他周期按原来的方式处理
            periodTimestamp = Math.floor(kline.openTime / periodMs) * periodMs
          }
          
          dataMap.set(periodTimestamp, {
            kline,
            index: idx
          })
        })
        
        periodDataMaps.set(period, dataMap)
      })
      
      // 遍历1小时数据
      for (let i = 0; i < baseData.klines.length; i++) {
        const kline1h = baseData.klines[i]
        const time = new Date(kline1h.openTime)
        
        const row: any = {
          '时间': time.toLocaleString(),
          '1小时价格': parseFloat(kline1h.close).toFixed(8),
          '1小时J值': baseData.indicators.j[i].toFixed(2),
          '1小时背离': baseData.indicators.bottomDivergence[i] ? '底背离' : 
                      (baseData.indicators.topDivergence[i] ? '顶背离' : '')
        }
        
        // 添加其他周期的数据
        intervals.slice(1).forEach((period, index) => {
          let periodTimestamp
          if (period === '1w') {
            // 对于周线，找到对应的周一凌晨时间
            const day = time.getDay() || 7
            const mondayTime = new Date(time.getTime() - (day - 1) * 24 * 60 * 60 * 1000)
            mondayTime.setHours(0, 0, 0, 0)
            periodTimestamp = mondayTime.getTime()
          } else {
            const periodMs = periodMilliseconds[period]
            periodTimestamp = Math.floor(kline1h.openTime / periodMs) * periodMs
          }
          
          const periodData = periodDataMaps.get(period).get(periodTimestamp)
          
          row[`${period}价格`] = periodData ? parseFloat(periodData.kline.close).toFixed(8) : ''
          row[`${period}J值`] = periodData ? 
            allData[index + 1].indicators.j[periodData.index].toFixed(2) : ''
          row[`${period}背离`] = periodData ? (
            allData[index + 1].indicators.bottomDivergence[periodData.index] ? '底背离' : 
            allData[index + 1].indicators.topDivergence[periodData.index] ? '顶背离' : ''
          ) : ''
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
      intervals.forEach(period => {
        colWidths.push(
          { wch: 15 }, // 价格
          { wch: 12 }, // J值
          { wch: 10 }  // 背离
        )
      })
      
      ws['!cols'] = colWidths
      
      // 添加工作表到工作簿
      XLSX.utils.book_append_sheet(wb, ws, '背离数据')
      
      // 将Excel文件添加到zip
      const monthStr = String(month + 1).padStart(2, '0')
      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
      folder?.file(`${selectedSymbol.value}_divergence_${selectedYear}${monthStr}.xlsx`, excelBuffer)
      
      // 添加延迟以避免API限制
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
    
    // 生成zip文件
    const zipContent = await zip.generateAsync({ type: 'blob' })
    const zipFileName = `${selectedSymbol.value}_${selectedYear}_divergence.zip`
    saveAs(zipContent, zipFileName)
    
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
