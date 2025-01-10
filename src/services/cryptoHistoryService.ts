import type { Period } from './singlePeriodWebsocketService'

interface KlineData {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export class CryptoHistoryService {
  private baseUrl = 'https://api.binance.com/api/v3'

  async getKlines(
    symbol: string, 
    interval: Period, 
    limit: number = 500,
    page: number = 1
  ): Promise<KlineData[]> {
    try {
      // 计算开始时间（向前获取数据）
      const endTime = Date.now()
      const intervalMs = this.getIntervalMilliseconds(interval)
      const startTime = endTime - (intervalMs * limit * page)

      const url = `${this.baseUrl}/klines?symbol=${symbol.toUpperCase()}&interval=${interval}&limit=${limit}&startTime=${startTime}&endTime=${endTime}`
      
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      
      return data.map((item: any) => ({
        time: Math.floor(item[0] / 1000), // 转换为秒级时间戳
        open: parseFloat(item[1]),
        high: parseFloat(item[2]),
        low: parseFloat(item[3]),
        close: parseFloat(item[4]),
        volume: parseFloat(item[5])
      }))
    } catch (error) {
      console.error('获取K线数据失败:', error)
      return []
    }
  }

  private getIntervalMilliseconds(interval: Period): number {
    const units: Record<string, number> = {
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    }

    const match = interval.match(/(\d+)([mhd])/)
    if (!match) return 60 * 1000 // 默认1分钟

    const [, num, unit] = match
    return parseInt(num) * units[unit]
  }
} 