import { CryptoService } from './cryptoService'

export class MultiPeriodService {
  private cryptoService: CryptoService
  private readonly periods = ['15m', '30m', '1h', '2h', '4h', '6h', '12h', '1d']
  
  constructor() {
    this.cryptoService = new CryptoService()
  }

  async getSymbols(): Promise<string[]> {
    try {
      // 获取所有交易对
      const allSymbols = await this.cryptoService.getSymbols()
      
      // 获取24小时交易数据
      const response = await fetch('https://api.binance.com/api/v3/ticker/24hr')
      const tickers = await response.json()
      
      // 过滤USDT交易对并按交易量排序
      const sortedSymbols = tickers
        .filter((ticker: any) => ticker.symbol.endsWith('USDT'))
        .sort((a: any, b: any) => parseFloat(b.volume) - parseFloat(a.volume))
        .map((ticker: any) => ticker.symbol)
      
      // 确保BTC和ETH在最前面
      const preferredSymbols = ['BTCUSDT', 'ETHUSDT']
      const otherSymbols = sortedSymbols.filter(symbol => !preferredSymbols.includes(symbol))
      
      return [...preferredSymbols, ...otherSymbols]
    } catch (error) {
      console.error('获取交易对列表失败:', error)
      return [
        'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT',
        'DOGEUSDT', 'MATICUSDT', 'SOLUSDT', 'DOTUSDT', 'LTCUSDT'
      ]
    }
  }

  async analyze(symbol: string, days: number = 7): Promise<Array<{
    period: string
    type: 'top' | 'bottom'
    time: string
    price: string
  }>> {
    const results = []
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // 并行处理所有周期
    const periodPromises = this.periods.map(async (period) => {
      try {
        // 根据周期和天数计算需要的K线数量
        let limit = 1000
        switch (period) {
          case '15m':
            limit = Math.min(1000, days * 24 * 4 + 100) // 每天96根K线
            break
          case '30m':
            limit = Math.min(1000, days * 24 * 2 + 100) // 每天48根K线
            break
          case '1h':
            limit = Math.min(1000, days * 24 + 100) // 每天24根K线
            break
          case '2h':
            limit = Math.min(1000, days * 12 + 100) // 每天12根K线
            break
          case '4h':
            limit = Math.min(1000, days * 6 + 100) // 每天6根K线
            break
          case '6h':
            limit = Math.min(1000, days * 4 + 100) // 每天4根K线
            break
          case '12h':
            limit = Math.min(1000, days * 2 + 100) // 每天2根K线
            break
          case '1d':
            limit = Math.min(1000, days + 100) // 每天1根K线
            break
        }

        const klines = await this.cryptoService.getKlines(symbol, period, limit)
        const { topDivergence, bottomDivergence } = this.cryptoService.calculateIndicators(klines)
        
        // 检查指定天数内的背离
        const recentKlines = klines.filter(k => new Date(k.openTime) >= startDate)
        
        recentKlines.forEach((kline, index) => {
          const actualIndex = klines.length - recentKlines.length + index
          
          if (topDivergence[actualIndex]) {
            results.push({
              period,
              type: 'top',
              time: new Date(parseInt(kline.openTime)).toISOString(),
              price: kline.close
            })
          }
          
          if (bottomDivergence[actualIndex]) {
            results.push({
              period,
              type: 'bottom',
              time: new Date(parseInt(kline.openTime)).toISOString(),
              price: kline.close
            })
          }
        })
      } catch (error) {
        console.error(`分析${period}周期失败:`, error)
      }
    })

    await Promise.all(periodPromises)
    
    // 按时间降序排序
    return results.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
  }
} 