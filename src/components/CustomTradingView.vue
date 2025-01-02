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
import { Indicators } from '@/utils/indicators'

// 配置 dayjs 插件
dayjs.extend(utc)
dayjs.extend(timezone)

// 设置默认时区为本地时区
dayjs.tz.setDefault(dayjs.tz.guess())

// 设置 dayjs 语言为中文
dayjs.locale('zh-cn')

// 添加图表配置
const chartConfig = {
  candlestick: {
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
  },
  volume: {
    upColor: '#26a69a',
    downColor: '#ef5350',
    scaleMargins: {
      top: 0.5,
      bottom: 0.3,
    }
  },
  macd: {
    colors: {
      macdLine: '#2196F3',
      signalLine: '#FF9800',
      histogram: {
        positive: '#26a69a',
        negative: '#ef5350'
      }
    },
    scaleMargins: {
      top: 0.7,
      bottom: 0,
    }
  },
  grid: {
    color: '#f0f0f0'
  },
  crosshair: {
    color: '#C4C4C4',
    labelBackgroundColor: '#f0f0f0'
  }
}

const chartContainerRef = ref<HTMLElement | null>(null)
const selectedInterval = ref<Period>('1m')
const indicators = ref(['MA', 'Volume'])
let chart: IChartApi | null = null
let candlestickSeries: ISeriesApi<"Candlestick"> | null = null
let volumeSeries: ISeriesApi<"Histogram"> | null = null
let wsService: SinglePeriodWebsocketService | null = null
const historyService = new CryptoHistoryService()
let macdSeries: ISeriesApi<"Line"> | null = null
let signalSeries: ISeriesApi<"Line"> | null = null
let histogramSeries: ISeriesApi<"Histogram"> | null = null
let bullishMarkers: ISeriesApi<"Line"> | null = null
let bearishMarkers: ISeriesApi<"Line"> | null = null

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

// 添加防抖函数
const debounce = (fn: Function, delay: number) => {
  let timer: number | null = null
  return (...args: any[]) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      fn.apply(null, args)
    }, delay) as unknown as number
  }
}

// 添加数据缓存
const chartDataCache = ref<{
  candles: CandlestickData[],
  volumes: HistogramData[],
  macd: MACD[]
}>({
  candles: [],
  volumes: [],
  macd: []
})

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
      vertLines: { color: chartConfig.grid.color },
      horzLines: { color: chartConfig.grid.color },
    },
    crosshair: {
      mode: CrosshairMode.Normal,
      vertLine: {
        labelBackgroundColor: chartConfig.crosshair.labelBackgroundColor,
        color: chartConfig.crosshair.color,
        labelVisible: true,
      },
      horzLine: {
        labelBackgroundColor: chartConfig.crosshair.labelBackgroundColor,
        color: chartConfig.crosshair.color,
      }
    },
    rightPriceScale: {
      borderColor: '#f0f0f0',
      scaleMargins: {
        top: 0.1,
        bottom: 0.5,
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
      rightBarStaysOnScroll: true,
      shiftVisibleRangeOnNewBar: true,
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
  candlestickSeries = chart.addCandlestickSeries(chartConfig.candlestick)

  // 添加成交量
  volumeSeries = chart.addHistogramSeries({
    color: chartConfig.volume.upColor,
    priceFormat: {
      type: 'volume',
      precision: 3,
    },
    priceScaleId: 'volume',
  })

  // 设置成交量的显示区域
  chart.priceScale('volume').applyOptions({
    scaleMargins: chartConfig.volume.scaleMargins,
    visible: true,
  })

  // 添加MACD指标
  macdSeries = chart.addLineSeries({
    color: chartConfig.macd.colors.macdLine,
    lineWidth: 2,
    priceScaleId: 'macd',
    title: 'MACD',
  })

  signalSeries = chart.addLineSeries({
    color: chartConfig.macd.colors.signalLine,
    lineWidth: 2,
    priceScaleId: 'macd',
    title: 'Signal',
  })

  histogramSeries = chart.addHistogramSeries({
    color: chartConfig.macd.colors.histogram.positive,
    priceScaleId: 'macd',
    title: 'Histogram',
  })

  // 设置MACD的显示区域
  chart.priceScale('macd').applyOptions({
    scaleMargins: chartConfig.macd.scaleMargins,
    visible: true
  })

  // 添加背离标记
  bullishMarkers = chart.addLineSeries({
    lastValueVisible: false,
    priceLineVisible: false,
    crosshairMarkerVisible: false,
    lineVisible: false,  // 使用lineVisible替代lineWidth
    priceScaleId: 'macd'
  })

  bearishMarkers = chart.addLineSeries({
    lastValueVisible: false,
    priceLineVisible: false,
    crosshairMarkerVisible: false,
    lineVisible: false,  // 使用lineVisible替代lineWidth
    priceScaleId: 'macd'
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
    

  })

  // 处理窗口大小变化
  const handleResize = debounce(() => {
    if (chart && chartContainerRef.value) {
      chart.applyOptions({
        width: chartContainerRef.value.clientWidth,
      })
    }
  }, 200)

  window.addEventListener('resize', handleResize)

  // 监听时间轴滚动
  chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
    if (!range) return
    
    // 当滚动到左侧20%的位置时，加载更多历史数据
    const visibleBars = range.to - range.from
    const leftEdgePos = range.from / visibleBars

    if (leftEdgePos <= 0.2 && !isLoading.value) {
      loadMoreHistoricalData()
    }
  })
}

const updateChart = (data: any) => {
  if (!candlestickSeries || !volumeSeries || !data.kline) return

  try {
    const timestamp = Math.floor(Number(data.kline.t) / 1000)
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
      color: parseFloat(data.kline.c) >= parseFloat(data.kline.o) ? 
        chartConfig.candlestick.upColor : 
        chartConfig.candlestick.downColor
    }

    if (data.kline.x) {
      // 使用缓存更新数据
      const existingCandleIndex = chartDataCache.value.candles.findIndex(d => d.time === timestamp)
      
      if (existingCandleIndex !== -1) {
        chartDataCache.value.candles[existingCandleIndex] = candleData
        chartDataCache.value.volumes[existingCandleIndex] = volumeData
      } else {
        chartDataCache.value.candles.push(candleData)
        chartDataCache.value.volumes.push(volumeData)
      }

      // 批量更新图表
      debouncedUpdateChartData()
    } else {
      // 实时更新最新的K线
      candlestickSeries.update(candleData)
      volumeSeries.update(volumeData)
    }
  } catch (error) {
    console.error('更新图表数据失败:', error)
  }
}

// 批量更新图表数据的防抖函数
const debouncedUpdateChartData = debounce(() => {
  if (!chartDataCache.value.candles.length) return

  const sortedCandles = [...chartDataCache.value.candles].sort((a, b) => 
    Number(a.time) - Number(b.time)
  )
  const sortedVolumes = [...chartDataCache.value.volumes].sort((a, b) => 
    Number(a.time) - Number(b.time)
  )

  candlestickSeries?.setData(sortedCandles)
  volumeSeries?.setData(sortedVolumes)
  updateMACD(sortedCandles)
}, 100)

// 优化MACD更新函数
const updateMACD = (data: CandlestickData[]) => {
  if (!macdSeries || !signalSeries || !histogramSeries || !data.length) return

  try {
    const closePrices = data.map(d => d.close)
    const macdResult = Indicators.calculateMACD(closePrices)
    
    if (!macdResult.length) return

    // 缓存MACD数据
    chartDataCache.value.macd = macdResult

    // 批量更新MACD数据
    const macdData = macdResult.map((d, i) => ({
      time: data[i].time,
      value: d.macd,
      signal: d.signal,
      histogram: d.histogram
    }))

    // 使用requestAnimationFrame优化渲染
    requestAnimationFrame(() => {
      macdSeries?.setData(macdData.map(d => ({
        time: d.time,
        value: d.value
      })))

      signalSeries?.setData(macdData.map(d => ({
        time: d.time,
        value: d.signal
      })))

      histogramSeries?.setData(macdData.map(d => ({
        time: d.time,
        value: d.histogram,
        color: d.histogram >= 0 ? 
          chartConfig.macd.colors.histogram.positive : 
          chartConfig.macd.colors.histogram.negative
      })))

      updateDivergenceMarkers(data, macdResult)
    })
  } catch (error) {
    console.error('更新MACD失败:', error)
  }
}

// 分离背离标记更新逻辑
const updateDivergenceMarkers = (data: CandlestickData[], macdResult: MACD[]) => {
  if (!bullishMarkers || !bearishMarkers) return

  try {
    const divergences = Indicators.detectDivergence(
      data.map(d => d.close),
      macdResult,
      20
    )

    if (!divergences) return

    requestAnimationFrame(() => {
      if (bullishMarkers && bearishMarkers) {  // 添加空检查
        bullishMarkers.setMarkers(divergences.bullish.map(i => ({
          time: data[i].time,
          position: 'belowBar' as const,
          color: chartConfig.macd.colors.histogram.positive,
          shape: 'arrowUp' as const,
          text: '底背离',
          size: 3
        })))

        bearishMarkers.setMarkers(divergences.bearish.map(i => ({
          time: data[i].time,
          position: 'aboveBar' as const,
          color: chartConfig.macd.colors.histogram.negative,
          shape: 'arrowDown' as const,
          text: '顶背离',
          size: 3
        })))
      }
    })
  } catch (error) {
    console.error('更新背离标记失败:', error)
  }
}

// 优化历史数据加载
const loadMoreHistoricalData = async () => {
  if (isLoading.value) return
  
  try {
    isLoading.value = true
    const newData = await historyService.getKlines(
      'BTCUSDT',
      selectedInterval.value,
      pageSize,
      ++currentPage.value
    )

    if (!newData.length) return

    // 使用缓存更新数据
    const candleData = newData.map(k => ({
      time: Math.floor(k.time) as Time,
      open: k.open,
      high: k.high,
      low: k.low,
      close: k.close
    }))

    const volumeData = newData.map(k => ({
      time: Math.floor(k.time) as Time,
      value: k.volume,
      color: k.close >= k.open ? 
        chartConfig.candlestick.upColor : 
        chartConfig.candlestick.downColor
    }))

    chartDataCache.value.candles = [...candleData, ...chartDataCache.value.candles]
    chartDataCache.value.volumes = [...volumeData, ...chartDataCache.value.volumes]

    // 批量更新图表
    debouncedUpdateChartData()
  } catch (error) {
    console.error('加载历史数据失败:', error)
    currentPage.value--
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
      color: k.close >= k.open ? 
        chartConfig.volume.upColor : 
        chartConfig.volume.downColor
    }))

    // 清除缓存数据
    chartDataCache.value = {
      candles: candleData,
      volumes: volumeData,
      macd: []
    }

    // 设置新数据
    candlestickSeries.setData(candleData)
    volumeSeries.setData(volumeData)

    // 更新MACD
    updateMACD(candleData)

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
  // 移除所有日志输出
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
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  .card-header {
    h3 {
      margin: 0;
      font-size: 1.2rem;
    }
  }
  
  .chart-container {
    margin: 1rem 0;
    height: 600px;
    min-height: 600px;
    background: #ffffff;
    border-radius: 4px;
    overflow-y: auto;
    
    #chart {
      height: 100%;
      min-height: 600px;
    }
  }
  
  .controls {
    margin-top: 1rem;
  }
}
</style>
