<template>
  <div class="custom-trading-view">
    <n-card>
      <template #header>
        <div class="card-header">
          <h3>BTC/USDT 行情图表</h3>
        </div>
      </template>
      
      <div class="chart-container" ref="chartContainerRef">
        <div id="chart"></div>
      </div>
      
      <div class="controls">
        <n-space>
          <n-select
            v-model:value="selectedInterval"
            :options="intervalOptions"
            placeholder="选择时间周期"
            @update:value="changeInterval"
            style="width: 120px"
          />
          <n-space>
            <n-tag
              v-for="indicator in indicators"
              :key="indicator"
              :bordered="false"
              type="info"
            >
              {{ indicator }}
            </n-tag>
          </n-space>
        </n-space>
      </div>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { SinglePeriodWebsocketService, type Period } from '@/services/singlePeriodWebsocketService'
import { CryptoHistoryService } from '@/services/cryptoHistoryService'
import { NCard, NSelect, NSpace, NTag } from 'naive-ui'
import type { SelectOption } from 'naive-ui'
import { createChart, ColorType, CrosshairMode } from 'lightweight-charts'
import type { 
  IChartApi, 
  ISeriesApi, 
  CandlestickData, 
  HistogramData,
  Time 
} from 'lightweight-charts'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

// 配置 dayjs 插件
dayjs.extend(utc)
dayjs.extend(timezone)

// 设置默认时区为本地时区
dayjs.tz.setDefault(dayjs.tz.guess())

// 设置 dayjs 语言为中文
dayjs.locale('zh-cn')

const chartContainerRef = ref<HTMLElement | null>(null)
const selectedInterval = ref<Period>('1m')
const indicators = ref(['MA', 'Volume'])
let chart: IChartApi | null = null
let candlestickSeries: ISeriesApi<"Candlestick"> | null = null
let volumeSeries: ISeriesApi<"Histogram"> | null = null
let wsService: SinglePeriodWebsocketService | null = null
const historyService = new CryptoHistoryService()

const intervalOptions: SelectOption[] = [
  { label: '1分钟', value: '1m' },
  { label: '5分钟', value: '5m' },
  { label: '15分钟', value: '15m' },
  { label: '1小时', value: '1h' },
  { label: '4小时', value: '4h' },
  { label: '1天', value: '1d' }
]

const formatChartTime = (timestamp: number): string => {
  return dayjs.unix(timestamp).format('MM-DD HH:mm')
}

const formatTooltipTime = (timestamp: number): string => {
  return dayjs.unix(timestamp).format('YYYY-MM-DD HH:mm:ss')
}

// 添加加载状态和分页变量
const isLoading = ref(false)
const currentPage = ref(1)
const pageSize = 500

const initChart = () => {
  const container = document.getElementById('chart')
  if (!container) return

  // 创建图表
  chart = createChart(container, {
    width: container.clientWidth,
    height: 600,
    layout: {
      background: { type: ColorType.Solid, color: '#ffffff' },
      textColor: '#333333',
      fontSize: 12,
    },
    grid: {
      vertLines: { color: '#f0f0f0' },
      horzLines: { color: '#f0f0f0' },
    },
    crosshair: {
      mode: CrosshairMode.Normal,
      vertLine: {
        labelBackgroundColor: '#f0f0f0',
        color: '#C4C4C4',
        labelVisible: true,
      },
      horzLine: {
        labelBackgroundColor: '#f0f0f0',
        color: '#C4C4C4',
      }
    },
    rightPriceScale: {
      borderColor: '#f0f0f0',
      scaleMargins: {
        top: 0.1,
        bottom: 0.3,
      },
    },
    timeScale: {
      borderColor: '#f0f0f0',
      timeVisible: true,
      secondsVisible: false,
      barSpacing: 20,
      minBarSpacing: 10,
      rightOffset: 12,
      fixLeftEdge: false,
      fixRightEdge: false,
      tickMarkFormatter: (time: number) => {
        const date = new Date(time * 1000)
        const hours = String(date.getHours()).padStart(2, '0')
        const minutes = String(date.getMinutes()).padStart(2, '0')
        return `${hours}:${minutes}`
      }
    },
    localization: {
      locale: 'zh-CN',
      dateFormat: 'yyyy/MM/dd',
      timeFormatter: (timestamp: number) => {
        const utc8Time = timestamp 
        const date = new Date(utc8Time * 1000)
        const hours = String(date.getHours()).padStart(2, '0')
        const minutes = String(date.getMinutes()).padStart(2, '0')
        return `${hours}:${minutes}`
      },
      priceFormatter: (price: number) => price.toFixed(2),
    },
  })

  // 添加K线图
  candlestickSeries = chart.addCandlestickSeries({
    upColor: '#26a69a',
    downColor: '#ef5350',
    borderVisible: false,
    wickUpColor: '#26a69a',
    wickDownColor: '#ef5350',
    priceFormat: {
      type: 'price',
      precision: 2,
      minMove: 0.01,
    }
  })

  // 添加成交量
  const volumeOptions = {
    color: '#26a69a',
    priceFormat: {
      type: 'volume' as const,
      precision: 3,
    },
    priceScaleId: 'volume',
    base: 0,
  }
  volumeSeries = chart.addHistogramSeries(volumeOptions)

  // 设置成交量的显示区域
  chart.priceScale('volume').applyOptions({
    scaleMargins: {
      top: 0.7,
      bottom: 0.0,
    },
    visible: true,
    autoScale: true,
  })

  // 设置工具提示
  chart.subscribeCrosshairMove(param => {
    if (!param.time || param.point === undefined) {
      return
    }

    const data = param.seriesData.get(candlestickSeries!)
    if (!data) {
      return
    }

    const price = (data as CandlestickData).close
    const timestamp = param.time as number
    const utc8Timestamp = timestamp 
    const date = new Date(utc8Timestamp * 1000)
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    
    console.log('光标时间信息:', {
      原始时间戳: timestamp,
      UTC时间: date.toISOString(),
      本地时间: date.toLocaleString('zh-CN'),
      显示时间: `${hours}:${minutes}`
    })
  })

  // 处理窗口大小变化
  const handleResize = () => {
    if (chart && container) {
      chart.applyOptions({
        width: container.clientWidth,
      })
    }
  }

  window.addEventListener('resize', handleResize)

  // 监听时间轴滚动
  chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
    if (!range) return
    
    // 当滚动到左侧20%的位置时，加载更多历史数据
    if (range.from <= range.to * 0.2 && !isLoading.value) {
      loadMoreHistoricalData()
    }
  })
}

const updateChart = (data: any) => {
  if (!candlestickSeries || !volumeSeries || !data.kline) return

  try {
    const timestamp = Math.floor(Number(data.kline.t) / 1000)
    const date = new Date(timestamp * 1000)
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    
    console.log('K线时间信息:', {
      原始时间戳: timestamp,
      UTC时间: date.toISOString(),
      本地时间: date.toLocaleString('zh-CN'),
      显示时间: `${hours}:${minutes}`
    })
    
    const candleData: CandlestickData = {
      time: timestamp as Time,
      open: parseFloat(data.kline.o),
      high: parseFloat(data.kline.h),
      low: parseFloat(data.kline.l),
      close: parseFloat(data.kline.c)
    }

    const volumeData: HistogramData = {
      time: timestamp as Time,
      value: parseFloat(data.kline.v),
      color: parseFloat(data.kline.c) >= parseFloat(data.kline.o) ? '#26a69a' : '#ef5350'
    }

    if (data.kline.x) {
      candlestickSeries.update(candleData)
      volumeSeries.update(volumeData)
    } else {
      candlestickSeries.update(candleData)
    }
  } catch (error) {
    console.error('更新图表数据失败:', error)
  }
}

// 加载更多历史数据
const loadMoreHistoricalData = async () => {
  if (isLoading.value || !candlestickSeries || !volumeSeries) return

  try {
    isLoading.value = true
    currentPage.value++
    
    console.log('加载更多历史数据:', {
      页码: currentPage.value,
      每页数量: pageSize
    })

    const klines = await historyService.getKlines(
      'BTCUSDT', 
      selectedInterval.value,
      pageSize,
      currentPage.value
    )
    
    if (klines.length === 0) {
      console.log('没有更多历史数据了')
      return
    }

    // 转换K线数据
    const candleData = klines.map(k => ({
      time: Math.floor(k.time) as Time,
      open: k.open,
      high: k.high,
      low: k.low,
      close: k.close
    }))
    
    // 转换成交量数据
    const volumeData = klines.map(k => ({
      time: Math.floor(k.time) as Time,
      value: k.volume,
      color: k.close >= k.open ? '#26a69a' : '#ef5350'
    }))

    // 获取现有数据
    const existingData = await candlestickSeries.data()
    const existingVolume = await volumeSeries.data()

    // 合并并排序数据
    const newCandleData = [...candleData, ...existingData].sort((a, b) => 
      Number(a.time) - Number(b.time)
    )
    const newVolumeData = [...volumeData, ...existingVolume].sort((a, b) => 
      Number(a.time) - Number(b.time)
    )

    // 更新数据
    candlestickSeries.setData(newCandleData)
    volumeSeries.setData(newVolumeData)

  } catch (error) {
    console.error('加载更多历史数据失败:', error)
  } finally {
    isLoading.value = false
  }
}

const loadHistoricalData = async () => {
  if (!candlestickSeries || !volumeSeries) return

  try {
    isLoading.value = true
    currentPage.value = 1
    
    const klines = await historyService.getKlines(
      'BTCUSDT', 
      selectedInterval.value,
      pageSize,
      currentPage.value
    )
    
    // 设置历史K线数据
    const candleData = klines.map(k => ({
      time: Math.floor(k.time) as Time,
      open: k.open,
      high: k.high,
      low: k.low,
      close: k.close
    }))
    
    // 设置历史成交量数据
    const volumeData = klines.map(k => ({
      time: Math.floor(k.time) as Time,
      value: k.volume,
      color: k.close >= k.open ? '#26a69a' : '#ef5350'
    }))

    // 清除旧数据
    candlestickSeries.setData([])
    volumeSeries.setData([])

    // 设置新数据
    candlestickSeries.setData(candleData)
    volumeSeries.setData(volumeData)

    // 调整视图以显示所有数据
    chart?.timeScale().fitContent()
  } catch (error) {
    console.error('加载历史数据失败:', error)
  } finally {
    isLoading.value = false
  }
}

const updateTimeScaleFormat = () => {
  chart?.applyOptions({
    timeScale: {
      tickMarkFormatter: formatChartTime
    }
  })
}

const changeInterval = async () => {
  try {
    // 先断开旧的WebSocket连接
    if (wsService) {
      wsService.disconnect()
      wsService = null
    }

    // 清除现有数据
    if (candlestickSeries && volumeSeries) {
      candlestickSeries.setData([])
      volumeSeries.setData([])
    }

    // 更新时间轴格式
    updateTimeScaleFormat()

    // 加载历史数据
    await loadHistoricalData()
    
    // 建立新的WebSocket连接
    wsService = new SinglePeriodWebsocketService(
      'BTCUSDT',
      selectedInterval.value,
      (data) => {
        logKlineData(data)
        updateChart(data)
      }
    )
    wsService.connect()
  } catch (error) {
    console.error('切换周期失败:', error)
  }
}

const logKlineData = (data: any) => {
  console.log('当前计算机时间'+dayjs().format('YYYY-MM-DD HH:mm:ss'))
  const timestamp = Math.floor(Number(data.kline.t) / 1000)
  const date = new Date(timestamp * 1000)
  console.log(`接收到新的K线数据 [${data.period}]:`, {
    时间: date.toLocaleString('zh-CN'),
    开盘价: data.kline.o,
    最高价: data.kline.h,
    最低价: data.kline.l,
    收盘价: data.kline.c,
    成交量: data.kline.v,
    是否完成: data.kline.x ? '是' : '否'
  })
}

onMounted(async () => {
  initChart()
  
  // 先加载历史数据
  await loadHistoricalData()
  
  // 然后建立WebSocket连接
  wsService = new SinglePeriodWebsocketService(
    'BTCUSDT',
    selectedInterval.value,
    (data) => {
      logKlineData(data)
      updateChart(data)
    }
  )
  wsService.connect()
})

onBeforeUnmount(() => {
  if (wsService) {
    wsService.disconnect()
  }
  if (chart) {
    chart.remove()
  }
})
</script>

<style lang="scss" scoped>
.custom-trading-view {
  .card-header {
    h3 {
      margin: 0;
      font-size: 1.2rem;
    }
  }
  
  .chart-container {
    margin: 1rem 0;
    height: 600px;
    background: #1a1a1a;
    border-radius: 4px;
    
    #chart {
      height: 100%;
    }
  }
  
  .controls {
    margin-top: 1rem;
  }
}
</style>
