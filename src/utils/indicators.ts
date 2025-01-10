interface MACD {
  macd: number
  signal: number
  histogram: number
}

export class Indicators {
  static calculateEMA(data: number[], period: number): number[] {
    const k = 2 / (period + 1)
    const emaData = []
    let ema = data[0]
    
    for (let i = 0; i < data.length; i++) {
      ema = (data[i] - ema) * k + ema
      emaData.push(ema)
    }
    
    return emaData
  }

  static calculateMACD(
    closePrices: number[], 
    fastPeriod: number = 12, 
    slowPeriod: number = 26, 
    signalPeriod: number = 9
  ): MACD[] {
    if (!closePrices || closePrices.length === 0) {
      return []
    }

    // 计算快线和慢线的EMA
    const fastEMA = this.calculateEMA(closePrices, fastPeriod)
    const slowEMA = this.calculateEMA(closePrices, slowPeriod)
    
    // 计算MACD线（DIF）
    const macdLine = fastEMA.map((fast, i) => fast - slowEMA[i])
    
    // 计算信号线（DEA）
    const signalLine = this.calculateEMA(macdLine, signalPeriod)
    
    // 计算柱状图（MACD Histogram）
    return macdLine.map((macd, i) => ({
      macd,
      signal: signalLine[i],
      histogram: macd - signalLine[i]
    }))
  }

  static detectDivergence(
    prices: number[], 
    macdValues: MACD[], 
    lookbackPeriod: number = 20
  ): { bullish: number[], bearish: number[] } {
    if (!prices || !macdValues || prices.length === 0 || macdValues.length === 0 || 
        prices.length !== macdValues.length) {
      return { bullish: [], bearish: [] }
    }

    const bullishDivergences: number[] = []
    const bearishDivergences: number[] = []

    // 确保我们有足够的数据来检查前后的点
    for (let i = lookbackPeriod; i < prices.length - 1; i++) {
      // 检查数组边界
      if (i - 1 < 0 || i + 1 >= prices.length || 
          i - 1 < 0 || i + 1 >= macdValues.length) {
        continue
      }

      // 寻找局部低点和高点
      const isLocalPriceBottom = prices[i] < prices[i - 1] && prices[i] < prices[i + 1]
      const isLocalPriceTop = prices[i] > prices[i - 1] && prices[i] > prices[i + 1]
      
      // 确保 macdValues[i] 存在且有 histogram 属性
      if (!macdValues[i] || !macdValues[i - 1] || !macdValues[i + 1]) {
        continue
      }

      const isLocalMacdBottom = macdValues[i].histogram < macdValues[i - 1].histogram && 
                               macdValues[i].histogram < macdValues[i + 1].histogram
      const isLocalMacdTop = macdValues[i].histogram > macdValues[i - 1].histogram && 
                            macdValues[i].histogram > macdValues[i + 1].histogram

      // 检测看涨背离（价格创新低但MACD未创新低）
      if (isLocalPriceBottom && isLocalMacdBottom) {
        const prevBottoms = this.findPreviousBottoms(prices, macdValues, i, lookbackPeriod)
        if (prevBottoms.length > 0) {
          const prevBottom = prevBottoms[0]
          if (prices[i] < prices[prevBottom] && 
              macdValues[i].histogram > macdValues[prevBottom].histogram) {
            bullishDivergences.push(i)
          }
        }
      }

      // 检测看跌背离（价格创新高但MACD未创新高）
      if (isLocalPriceTop && isLocalMacdTop) {
        const prevTops = this.findPreviousTops(prices, macdValues, i, lookbackPeriod)
        if (prevTops.length > 0) {
          const prevTop = prevTops[0]
          if (prices[i] > prices[prevTop] && 
              macdValues[i].histogram < macdValues[prevTop].histogram) {
            bearishDivergences.push(i)
          }
        }
      }
    }

    return { bullish: bullishDivergences, bearish: bearishDivergences }
  }

  private static findPreviousBottoms(
    prices: number[], 
    macdValues: MACD[], 
    currentIndex: number, 
    lookback: number
  ): number[] {
    const bottoms: number[] = []
    const startIndex = Math.max(1, currentIndex - lookback)
    
    for (let i = startIndex; i < currentIndex; i++) {
      if (i + 1 >= prices.length) continue
      
      // 确保所有需要的数据点都存在
      if (!macdValues[i] || !macdValues[i - 1] || !macdValues[i + 1]) continue

      if (prices[i] < prices[i - 1] && prices[i] < prices[i + 1] &&
          macdValues[i].histogram < macdValues[i - 1].histogram && 
          macdValues[i].histogram < macdValues[i + 1].histogram) {
        bottoms.push(i)
      }
    }
    return bottoms
  }

  private static findPreviousTops(
    prices: number[], 
    macdValues: MACD[], 
    currentIndex: number, 
    lookback: number
  ): number[] {
    const tops: number[] = []
    const startIndex = Math.max(1, currentIndex - lookback)
    
    for (let i = startIndex; i < currentIndex; i++) {
      if (i + 1 >= prices.length) continue
      
      // 确保所有需要的数据点都存在
      if (!macdValues[i] || !macdValues[i - 1] || !macdValues[i + 1]) continue

      if (prices[i] > prices[i - 1] && prices[i] > prices[i + 1] &&
          macdValues[i].histogram > macdValues[i - 1].histogram && 
          macdValues[i].histogram > macdValues[i + 1].histogram) {
        tops.push(i)
      }
    }
    return tops
  }
} 