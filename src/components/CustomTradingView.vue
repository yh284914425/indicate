<template>
  <div class="custom-trading-view">
    <n-card class="chart-card">
      <template #header>
        <div class="card-header">
          <h3>自定义图表</h3>
          <div class="header-controls">
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
            <n-select
              v-model:value="selectedInterval"
              :options="intervalOptions"
              placeholder="选择时间周期"
              class="interval-select"
              @update:value="handleIntervalChange"
            />
          </div>
        </div>
      </template>

      <!-- 图表容器 -->
      <div ref="chartContainer" class="chart-container"></div>

      <!-- 指标选择区域 -->
      <div class="indicators-panel">
        <n-space>
          <n-checkbox v-model:checked="showRSI">RSI</n-checkbox>
          <n-checkbox v-model:checked="showMACD">MACD</n-checkbox>
          <n-checkbox v-model:checked="showVolume">成交量</n-checkbox>
        </n-space>
      </div>

      <!-- 图例容器 -->
      <div ref="legendContainer" class="legend-container"></div>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { createChart, ColorType, CrosshairMode } from 'lightweight-charts'
import { useMessage } from 'naive-ui'
import { CryptoService } from '../services/cryptoService'
import { WebSocketService } from '../services/websocketService'

const message = useMessage()
const cryptoService = new CryptoService()

interface TimeRange {
  from: number;
  to: number;
}

interface VisibleTimeRange {
  from: number | undefined;
  to: number | undefined;
}

// 状态
const chartContainer = ref<HTMLElement | null>(null)
const chart = ref<any>(null)
const candlestickSeries = ref<any>(null)
const volumeSeries = ref<any>(null)
const rsiSeries = ref<any>(null)
const macdSeries = ref<any[]>([])
const maSeries = ref<any[]>([])
const selectedSymbol = ref('BTCUSDT')
const selectedInterval = ref('1h')
const loadingSymbols = ref(false)

// 指标状态
const showMA = ref(false)
const showRSI = ref(false)
const showMACD = ref(false)
const showVolume = ref(true)

// 指标参数
const indicatorParams = ref({
  ma: {
    periods: [7, 25, 99]
  },
  rsi: {
    period: 14,
    overbought: 70,
    oversold: 30
  },
  macd: {
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9
  }
})

// 时间周期选项
const intervalOptions = [
  { label: '1分钟', value: '1m' },
  { label: '5分钟', value: '5m' },
  { label: '15分钟', value: '15m' },
  { label: '30分钟', value: '30m' },
  { label: '1小时', value: '1h' },
  { label: '4小时', value: '4h' },
  { label: '1天', value: '1d' },
]

// 交易对选项
const symbolOptions = ref<Array<{
  label: string
  value: string
}>>([])

// WebSocket相关
const wsService = ref<WebSocketService | null>(null)
const wsEnabled = ref(true)

// 添加数据范围追踪
const currentDataRange = ref<TimeRange>({
  from: 0,
  to: 0
})

// 初始化WebSocket
const initWebSocket = () => {
  if (!wsEnabled.value) return
  
  // 关闭旧的连接
  if (wsService.value) {
    wsService.value.disconnect()
  }

  // 创建新的WebSocket连接
  wsService.value = new WebSocketService((data: { 
    symbol: string; 
    period: string; 
    kline: { 
      t: number;    // 开盘时间
      o: string;    // 开盘价
      h: string;    // 最高价
      l: string;    // 最低价
      c: string;    // 收盘价
      v: string;    // 成交量
    } 
  }) => {
    if (!candlestickSeries.value) return
    
    // 检查是否是当前选中的交易对和时间周期
    if (data.symbol.toLowerCase() !== selectedSymbol.value.toLowerCase() || 
        data.period !== selectedInterval.value) {
      return
    }

    const kline = {
      time: data.kline.t / 1000,
      open: parseFloat(data.kline.o),
      high: parseFloat(data.kline.h),
      low: parseFloat(data.kline.l),
      close: parseFloat(data.kline.c),
      volume: parseFloat(data.kline.v)
    }

    // 更新K线数据
    candlestickSeries.value.update(kline)

    // 更新成交量
    if (volumeSeries.value && showVolume.value) {
      volumeSeries.value.update({
        time: kline.time,
        value: kline.volume,
        color: kline.close >= kline.open ? '#26a69a' : '#ef5350'
      })
    }

    // 实时更新指标
    if (showMA.value) {
      updateMAReal(kline)
    }
    if (showRSI.value) {
      updateRSIReal(kline)
    }
    if (showMACD.value) {
      updateMACDReal(kline)
    }
  })

  // 连接WebSocket
  wsService.value.connect([selectedSymbol.value])
}

// 实时更新MA
const updateMAReal = (newKline: any) => {
  if (!maSeries.value.length) return

  // 获取当前所有数据
  const currentData = candlestickSeries.value.data()
  const lastData = [...currentData, newKline]

  // 更新MA数据
  const periods = indicatorParams.value.ma.periods
  periods.forEach((period, index) => {
    if (lastData.length >= period) {
      const sum = lastData.slice(-period).reduce((acc, curr) => acc + curr.close, 0)
      const ma = sum / period
      maSeries.value[index]?.update({
        time: newKline.time,
        value: ma
      })
    }
  })
}

// 实时更新RSI
const updateRSIReal = (newKline: any) => {
  if (!rsiSeries.value) return

  const currentData = candlestickSeries.value.data()
  const lastData = [...currentData, newKline]
  
  if (lastData.length >= indicatorParams.value.rsi.period) {
    const rsiData = calculateRSI(lastData)
    const lastRSI = rsiData[rsiData.length - 1]
    rsiSeries.value.update(lastRSI)
  }
}

// 实时更新MACD
const updateMACDReal = (newKline: any) => {
  if (!macdSeries.value.length) return

  const currentData = candlestickSeries.value.data()
  const lastData = [...currentData, newKline]

  const { macdLine, signalLine, histogram } = calculateMACD(
    lastData,
    indicatorParams.value.macd.fastPeriod,
    indicatorParams.value.macd.slowPeriod,
    indicatorParams.value.macd.signalPeriod
  )

  // 更新MACD数据
  macdSeries.value[0].update(macdLine[macdLine.length - 1])
  macdSeries.value[1].update(signalLine[signalLine.length - 1])
  macdSeries.value[2].update(histogram[histogram.length - 1])
}

// 初始化交易对列表
const initSymbols = async () => {
  try {
    loadingSymbols.value = true
    const symbols = await cryptoService.getSymbols()
    symbolOptions.value = symbols.map(symbol => ({
      label: symbol,
      value: symbol
    }))
  } catch (error) {
    message.error('获取交易对列表失败')
    console.error(error)
  } finally {
    loadingSymbols.value = false
  }
}

// 计算RSI
const calculateRSI = (data: any[], period: number = 14) => {
  const changes = data.map((item, index) => {
    if (index === 0) return { gain: 0, loss: 0 }
    const change = item.close - data[index - 1].close
    return {
      gain: change > 0 ? change : 0,
      loss: change < 0 ? -change : 0
    }
  })

  const avgGain = changes.slice(0, period).reduce((sum, curr) => sum + curr.gain, 0) / period
  const avgLoss = changes.slice(0, period).reduce((sum, curr) => sum + curr.loss, 0) / period

  const rsi = [{ time: data[period - 1].time, value: 100 - (100 / (1 + avgGain / avgLoss)) }]

  for (let i = period; i < data.length; i++) {
    const change = changes[i]
    const newAvgGain = (avgGain * (period - 1) + change.gain) / period
    const newAvgLoss = (avgLoss * (period - 1) + change.loss) / period
    rsi.push({
      time: data[i].time,
      value: 100 - (100 / (1 + newAvgGain / newAvgLoss))
    })
  }

  return rsi
}

// 计算MACD
const calculateMACD = (data: any[], fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) => {
  const closes = data.map(item => item.close)
  const times = data.map(item => item.time)
  
  // 计算EMA
  const calculateEMA = (prices: number[], period: number) => {
    const k = 2 / (period + 1)
    const ema = [prices[0]]
    for (let i = 1; i < prices.length; i++) {
      ema[i] = prices[i] * k + ema[i - 1] * (1 - k)
    }
    return ema
  }

  const fastEMA = calculateEMA(closes, fastPeriod)
  const slowEMA = calculateEMA(closes, slowPeriod)
  
  // 计算MACD线
  const macdLine = fastEMA.map((fast, i) => fast - slowEMA[i])
  
  // 计算信号线
  const signalLine = calculateEMA(macdLine, signalPeriod)
  
  // 计算柱状图
  const histogram = macdLine.map((macd, i) => macd - signalLine[i])

  return {
    macdLine: macdLine.map((value, i) => ({ time: times[i], value })),
    signalLine: signalLine.map((value, i) => ({ time: times[i], value })),
    histogram: histogram.map((value, i) => ({ 
      time: times[i], 
      value,
      color: value >= 0 ? '#26a69a' : '#ef5350'
    }))
  }
}

// 修改初始化图表函数
const initChart = () => {
  if (!chartContainer.value) return

  // 设置时间刻度配置
  const timeScaleConfig: Record<string, { timeVisible: boolean; secondsVisible: boolean }> = {
    '1m': { timeVisible: true, secondsVisible: false },
    '5m': { timeVisible: true, secondsVisible: false },
    '15m': { timeVisible: true, secondsVisible: false },
    '30m': { timeVisible: true, secondsVisible: false },
    '1h': { timeVisible: true, secondsVisible: false },
    '4h': { timeVisible: true, secondsVisible: false },
    '1d': { timeVisible: false, secondsVisible: false }
  }

  // 创建图表实例
  chart.value = createChart(chartContainer.value, {
    width: chartContainer.value.clientWidth,
    height: 600,
    layout: {
      background: { color: '#ffffff' },
      textColor: '#333',
    },
    grid: {
      vertLines: { color: '#f0f0f0' },
      horzLines: { color: '#f0f0f0' },
    },
    crosshair: {
      mode: CrosshairMode.Normal,
      vertLine: {
        labelBackgroundColor: '#2196F3',
      },
      horzLine: {
        labelBackgroundColor: '#2196F3',
      },
    },
    rightPriceScale: {
      borderColor: '#f0f0f0',
      scaleMargins: {
        top: 0.1,
        bottom: 0.2,
      },
    },
    timeScale: {
      borderColor: '#f0f0f0',
      ...timeScaleConfig[selectedInterval.value],
      rightOffset: 12,
      barSpacing: selectedInterval.value === '1d' ? 20 : 12,
      fixLeftEdge: true,
      lockVisibleTimeRangeOnResize: true,
      tickMarkFormatter: (time: number) => {
        const date = new Date(time * 1000)
        if (selectedInterval.value === '1d') {
          return date.toISOString().slice(0, 10)
        } else if (['4h', '1h'].includes(selectedInterval.value)) {
          const dateStr = date.toISOString().slice(0, 10)
          const timeStr = date.toTimeString().slice(0, 5)
          return `${dateStr} ${timeStr}`
        } else {
          return date.toTimeString().slice(0, 5)
        }
      }
    },
    handleScroll: {
      mouseWheel: true,
      pressedMouseMove: true,
      horzTouchDrag: true,
      vertTouchDrag: true,
    },
    handleScale: {
      axisPressedMouseMove: true,
      mouseWheel: true,
      pinch: true,
    },
  })

  // 创建K线图
  candlestickSeries.value = chart.value.addCandlestickSeries({
    upColor: '#26a69a',
    downColor: '#ef5350',
    borderVisible: false,
    wickUpColor: '#26a69a',
    wickDownColor: '#ef5350',
    scaleMargins: {
      top: 0.1,
      bottom: 0.2,
    },
  })

  // 创建成交量图表
  if (showVolume.value) {
    volumeSeries.value = chart.value.addHistogramSeries({
      color: '#26a69a',
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: 'volume',
      scaleMargins: {
        top: 0.85,
        bottom: 0.05,
      },
    })
  }

  // 添加图例
  const legendContainer = ref<HTMLElement | null>(null)
  
  // 修改十字光标移动处理逻辑
  chart.value.subscribeCrosshairMove((param: { 
    time?: number; 
    point?: { x: number; y: number }; 
    seriesPrices: Map<any, any> | undefined;
  }) => {
    if (!param.time || !param.point || !param.seriesPrices) return

    const price = param.seriesPrices.get(candlestickSeries.value)
    if (price && legendContainer.value) {
      const { open, high, low, close } = price
      const date = new Date(param.time * 1000)
      const timeStr = selectedInterval.value === '1d' 
        ? date.toISOString().slice(0, 10)
        : `${date.toISOString().slice(0, 10)} ${date.toTimeString().slice(0, 5)}`

      legendContainer.value.innerHTML = `
        <div class="legend-line">
          <span class="legend-label">时间:</span>
          <span class="legend-value">${timeStr}</span>
        </div>
        <div class="legend-line">
          <span class="legend-label">开盘:</span>
          <span class="legend-value">${open.toFixed(2)}</span>
        </div>
        <div class="legend-line">
          <span class="legend-label">最高:</span>
          <span class="legend-value">${high.toFixed(2)}</span>
        </div>
        <div class="legend-line">
          <span class="legend-label">最低:</span>
          <span class="legend-value">${low.toFixed(2)}</span>
        </div>
        <div class="legend-line">
          <span class="legend-label">收盘:</span>
          <span class="legend-value">${close.toFixed(2)}</span>
        </div>
      `
    } else if (legendContainer.value) {
      legendContainer.value.innerHTML = ''
    }
  })

  // 添加窗口大小调整监听
  const handleResize = () => {
    if (chartContainer.value && chart.value) {
      chart.value.applyOptions({
        width: chartContainer.value.clientWidth,
      })
    }
  }

  window.addEventListener('resize', handleResize)

  // 添加时间范围变化监听
  chart.value.timeScale().subscribeVisibleTimeRangeChange(function(this: void) {
    const visibleRange = chart.value.timeScale().getVisibleRange()
    if (!visibleRange) return

    // 如果可见范围的开始时间接近当前数据范围的开始时间，加载更多历史数据
    if (visibleRange.from && currentDataRange.value.from > 0 && 
        visibleRange.from - currentDataRange.value.from < 24 * 60 * 60) { // 当剩余1天的数据时加载更多
      loadMoreHistoricalData()
    }
  })

  // 组件卸载时清理
  onUnmounted(() => {
    window.removeEventListener('resize', handleResize)
    if (chart.value) {
      chart.value.remove()
    }
  })
}

// 获取K线数据
const fetchKlineData = async () => {
  try {
    // 计算开始时间
    const endTime = Date.now()
    let startTime: number | undefined
    
    // 根据不同的时间周期设置不同的数据量
    const intervals: Record<string, number> = {
      '1m': 1000,
      '5m': 1000,
      '15m': 1000,
      '30m': 1000,
      '1h': 1000,
      '4h': 1000,
      '1d': 365 // 日线获取一年的数据
    }
    
    const limit = intervals[selectedInterval.value as keyof typeof intervals] || 1000
    
    // 根据时间周期计算开始时间
    if (selectedInterval.value === '1d') {
      startTime = endTime - (limit * 24 * 60 * 60 * 1000) // 日线模式下获取更长时间的数据
    } else {
      startTime = endTime - (limit * getIntervalMinutes(selectedInterval.value) * 60 * 1000)
    }

    // 使用getKlines方法获取数据
    const klineData = await cryptoService.getKlines(
      selectedSymbol.value,
      selectedInterval.value,
      limit,
      startTime,
      endTime
    )

    // 格式化数据
    const formattedData = klineData.map((item) => ({
      time: item.openTime / 1000, // 转换秒级时间戳
      open: parseFloat(item.open),
      high: parseFloat(item.high),
      low: parseFloat(item.low),
      close: parseFloat(item.close),
      volume: parseFloat(item.volume),
    }))

    // 更新数据范围
    if (formattedData.length > 0) {
      currentDataRange.value = {
        from: formattedData[0].time,
        to: formattedData[formattedData.length - 1].time
      }
    }

    // 更新K线图数据
    if (candlestickSeries.value) {
      candlestickSeries.value.setData(formattedData)
    }

    // 更新成交量数据
    if (volumeSeries.value && showVolume.value) {
      const volumeData = formattedData.map((item: { time: number; close: number; open: number; volume: number }) => ({
        time: item.time,
        value: item.volume,
        color: item.close >= item.open ? '#26a69a' : '#ef5350',
      }))
      volumeSeries.value.setData(volumeData)
    }

    // 计算并显示MA
    if (showMA.value) {
      updateMA(formattedData)
    }

    // 计算并显示RSI
    if (showRSI.value) {
      updateRSI(formattedData)
    }

    // 计算并显示MACD
    if (showMACD.value) {
      updateMACD(formattedData)
    }

  } catch (error) {
    message.error('获取K线数据失败')
    console.error(error)
  }
}

// 添加辅助函数来计算时间间隔的分钟数
const getIntervalMinutes = (interval: string): number => {
  const units: Record<string, number> = {
    'm': 1,
    'h': 60,
    'd': 1440
  }
  const value = parseInt(interval)
  const unit = interval.slice(-1)
  return value * (units[unit] || 1)
}

// 更新MA指标
const updateMA = (data: any[]) => {
  // 清除旧的MA系列
  maSeries.value = []

  const ma7Data = calculateMA(data, 7)
  const ma25Data = calculateMA(data, 25)
  const ma99Data = calculateMA(data, 99)

  // 添加MA7
  maSeries.value.push(
    chart.value.addLineSeries({
      color: '#2196F3',
      lineWidth: 1,
      title: 'MA7'
    })
  )
  maSeries.value[0].setData(ma7Data)

  // 添加MA25
  maSeries.value.push(
    chart.value.addLineSeries({
      color: '#FF9800',
      lineWidth: 1,
      title: 'MA25'
    })
  )
  maSeries.value[1].setData(ma25Data)

  // 添加MA99
  maSeries.value.push(
    chart.value.addLineSeries({
      color: '#E91E63',
      lineWidth: 1,
      title: 'MA99'
    })
  )
  maSeries.value[2].setData(ma99Data)
}

// 计算MA
const calculateMA = (data: any[], period: number) => {
  const result = []
  for (let i = period - 1; i < data.length; i++) {
    const sum = data.slice(i - period + 1, i + 1).reduce((acc, curr) => acc + curr.close, 0)
    result.push({
      time: data[i].time,
      value: sum / period,
    })
  }
  return result
}

// 更新RSI
const updateRSI = (data: any[]) => {
  if (!showRSI.value) return
  
  // 创建RSI系列
  rsiSeries.value = chart.value.addLineSeries({
    color: '#2196F3',
    lineWidth: 2,
    title: 'RSI',
    priceScaleId: 'rsi',
    scaleMargins: {
      top: 0.1,
      bottom: 0.1,
    },
  })

  // 添加超买超卖线
  const overboughtLine = chart.value.addLineSeries({
    color: '#ef5350',
    lineWidth: 1,
    lineStyle: 2,
    priceScaleId: 'rsi',
  })

  const oversoldLine = chart.value.addLineSeries({
    color: '#26a69a',
    lineWidth: 1,
    lineStyle: 2,
    priceScaleId: 'rsi',
  })

  // 计算并设置数据
  const rsiData = calculateRSI(data, indicatorParams.value.rsi.period)
  rsiSeries.value.setData(rsiData)

  // 设置超买超卖线
  const overboughtData = rsiData.map((item: { time: number }) => ({
    time: item.time,
    value: indicatorParams.value.rsi.overbought
  }))
  const oversoldData = rsiData.map((item: { time: number }) => ({
    time: item.time,
    value: indicatorParams.value.rsi.oversold
  }))

  overboughtLine.setData(overboughtData)
  oversoldLine.setData(oversoldData)
}

// 更新MACD
const updateMACD = (data: any[]) => {
  if (!showMACD.value) return

  // 清除旧的MACD系列
  macdSeries.value = []

  // 计算MACD数据
  const { macdLine, signalLine, histogram } = calculateMACD(
    data,
    indicatorParams.value.macd.fastPeriod,
    indicatorParams.value.macd.slowPeriod,
    indicatorParams.value.macd.signalPeriod
  )

  // 添加MACD线
  macdSeries.value.push(
    chart.value.addLineSeries({
      color: '#2196F3',
      lineWidth: 2,
      title: 'MACD',
      priceScaleId: 'macd',
      scaleMargins: {
        top: 0.6,
        bottom: 0.3,
      },
    })
  )

  // 添加信号线
  macdSeries.value.push(
    chart.value.addLineSeries({
      color: '#FF9800',
      lineWidth: 2,
      title: 'Signal',
      priceScaleId: 'macd',
    })
  )

  // 添加柱状图
  macdSeries.value.push(
    chart.value.addHistogramSeries({
      title: 'Histogram',
      priceScaleId: 'macd',
    })
  )

  // 设置数据
  macdSeries.value[0].setData(macdLine)
  macdSeries.value[1].setData(signalLine)
  macdSeries.value[2].setData(histogram)
}

// 清理图表函数
const cleanupChart = () => {
  // 清理MA系列
  maSeries.value = []
  
  // 清理RSI系列
  if (rsiSeries.value) {
    rsiSeries.value = null
  }
  
  // 清理MACD系列
  macdSeries.value = []
  
  // 清理成交量系列
  if (volumeSeries.value) {
    volumeSeries.value = null
  }
  
  // 清理K线系列
  if (candlestickSeries.value) {
    candlestickSeries.value = null
  }
  
  // 清理图表实例
  if (chart.value) {
    chart.value.remove()
    chart.value = null
  }
}

// 修改处理交易对变化的函数
const handleSymbolChange = async () => {
  cleanupChart()
  initChart()
  await fetchKlineData()
  initWebSocket()
}

// 修改处理时间周期变化的函数
const handleIntervalChange = async () => {
  cleanupChart()
  initChart()
  await fetchKlineData()
  initWebSocket()
}

// 修改指标变化监听
watch([showMA, showRSI, showMACD, showVolume], async () => {
  cleanupChart()
  initChart()
  await fetchKlineData()
  initWebSocket()
})

// 修改组件卸载
onUnmounted(() => {
  if (wsService.value) {
    wsService.value.disconnect()
    wsService.value = null
  }
  
  window.removeEventListener('resize', handleResize)
  cleanupChart()
})

// 窗口大小调整处理
const handleResize = () => {
  if (chartContainer.value && chart.value) {
    chart.value.applyOptions({
      width: chartContainer.value.clientWidth,
    })
  }
}

// 添加加载更多历史数据的函数
const loadMoreHistoricalData = async () => {
  try {
    // 使用当前数据范围的开始时间作为新数据的结束时间
    const endTime = currentDataRange.value.from * 1000 // 转换为毫秒
    const limit = 1000 // 每次加载1000条数据
    
    // 计算开始时间
    let startTime = endTime
    if (selectedInterval.value === '1d') {
      startTime = endTime - (limit * 24 * 60 * 60 * 1000)
    } else {
      startTime = endTime - (limit * getIntervalMinutes(selectedInterval.value) * 60 * 1000)
    }

    // 获取历史数据
    const historicalData = await cryptoService.getKlines(
      selectedSymbol.value,
      selectedInterval.value,
      limit,
      startTime,
      endTime
    )

    if (historicalData.length === 0) return

    // 格式化数据
    const formattedData = historicalData.map((item) => ({
      time: item.openTime / 1000,
      open: parseFloat(item.open),
      high: parseFloat(item.high),
      low: parseFloat(item.low),
      close: parseFloat(item.close),
      volume: parseFloat(item.volume),
    }))

    // 更新数据范围
    currentDataRange.value.from = formattedData[0].time

    // 更新K线图数据
    if (candlestickSeries.value) {
      const currentData = candlestickSeries.value.data()
      candlestickSeries.value.setData([...formattedData, ...currentData])
    }

    // 更新成交量数据
    if (volumeSeries.value && showVolume.value) {
      const volumeData = formattedData.map((item) => ({
        time: item.time,
        value: item.volume,
        color: item.close >= item.open ? '#26a69a' : '#ef5350',
      }))
      const currentVolumeData = volumeSeries.value.data()
      volumeSeries.value.setData([...volumeData, ...currentVolumeData])
    }

    // 更新指标数据
    const allData = [...formattedData, ...candlestickSeries.value.data()]
    if (showRSI.value) {
      updateRSI(allData)
    }
    if (showMACD.value) {
      updateMACD(allData)
    }

  } catch (error) {
    console.error('加载历史数据失败:', error)
  }
}

// 组件挂载时初始化
onMounted(async () => {
  await initSymbols()
  initChart()
  await fetchKlineData()
  initWebSocket()
  
  // 添加窗口大小调整监听
  window.addEventListener('resize', handleResize)
})
</script>

<style lang="scss" scoped>
.custom-trading-view {
  padding: 16px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);

  .chart-card {
    margin-bottom: 16px;
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }

  .header-controls {
    display: flex;
    gap: 12px;
    align-items: center;
  }

  .select-width {
    width: 200px;
  }

  .interval-select {
    width: 120px;
  }

  .chart-container {
    height: 600px;
    margin: 16px 0;
  }

  .indicators-panel {
    margin-top: 16px;
    padding: 16px;
    border-top: 1px solid #f0f0f0;
    display: flex;
    gap: 24px;
    align-items: center;
  }
}

// 响应式设计
@media (max-width: 768px) {
  .custom-trading-view {
    padding: 8px;

    .header-controls {
      flex-direction: column;
      gap: 8px;
    }

    .select-width,
    .interval-select {
      width: 100%;
    }

    .chart-container {
      height: 400px;
    }

    .indicators-panel {
      flex-wrap: wrap;
      gap: 12px;
    }
  }
}

.legend-container {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 2;
  background: rgba(255, 255, 255, 0.9);
  padding: 8px;
  border-radius: 4px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  font-size: 12px;
  font-family: monospace;

  .legend-line {
    display: flex;
    gap: 8px;
    line-height: 1.5;
  }

  .legend-label {
    color: #666;
  }

  .legend-value {
    font-weight: bold;
  }
}
</style> 