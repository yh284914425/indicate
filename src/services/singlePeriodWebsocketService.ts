export interface KlineData {
  symbol: string
  period: string
  kline: {
    t: number    // 开盘时间
    T: number    // 收盘时间
    s: string    // 交易对
    i: string    // 间隔
    f: number    // 第一笔成交ID
    L: number    // 最后一笔成交ID
    o: string    // 开盘价
    c: string    // 收盘价
    h: string    // 最高价
    l: string    // 最低价
    v: string    // 成交量
    n: number    // 成交笔数
    x: boolean   // 是否完成
    q: string    // 成交额
    V: string    // 主动买入成交量
    Q: string    // 主动买入成交额
    B: string    // 忽略
  }
}

export type Period = '1m' | '5m' | '15m' | '1h' | '4h' | '1d'

export class SinglePeriodWebsocketService {
  private ws: WebSocket | null = null
  private readonly baseUrl = 'wss://stream.binance.com:9443/ws'
  private period: Period
  private symbol: string
  private callback: (data: KlineData) => void
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 3000 // 3秒
  private isManualDisconnect = false // 添加手动断开标记

  constructor(symbol: string, period: Period, callback: (data: KlineData) => void) {
    this.symbol = symbol.toLowerCase()
    this.period = period
    this.callback = callback
  }

  connect() {
    try {
      // 重置手动断开标记
      this.isManualDisconnect = false
      
      const streamName = `${this.symbol}@kline_${this.period}`
      this.ws = new WebSocket(`${this.baseUrl}/${streamName}`)

      this.ws.onopen = () => {
        console.log(`WebSocket connected for ${this.symbol} - ${this.period}`)
        this.reconnectAttempts = 0 // 重置重连次数
      }

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.e === 'kline') {
            const klineData: KlineData = {
              symbol: data.s,
              period: this.period,
              kline: {
                t: data.k.t,
                T: data.k.T,
                s: data.k.s,
                i: data.k.i,
                f: data.k.f,
                L: data.k.L,
                o: data.k.o,
                c: data.k.c,
                h: data.k.h,
                l: data.k.l,
                v: data.k.v,
                n: data.k.n,
                x: data.k.x,
                q: data.k.q,
                V: data.k.V,
                Q: data.k.Q,
                B: data.k.B
              }
            }
            this.callback(klineData)
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error)
        }
      }

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error)
        if (!this.isManualDisconnect) {
          this.tryReconnect()
        }
      }

      this.ws.onclose = () => {
        console.log(`WebSocket disconnected for ${this.symbol} - ${this.period}`)
        if (!this.isManualDisconnect) {
          this.tryReconnect()
        }
      }
    } catch (error) {
      console.error('Error creating WebSocket connection:', error)
      if (!this.isManualDisconnect) {
        this.tryReconnect()
      }
    }
  }

  private tryReconnect() {
    if (this.isManualDisconnect) return // 如果是手动断开，不进行重连
    
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`)
      setTimeout(() => {
        this.connect()
      }, this.reconnectDelay)
    } else {
      console.error('Max reconnection attempts reached')
    }
  }

  disconnect() {
    this.isManualDisconnect = true // 设置手动断开标记
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  updatePeriod(newPeriod: Period) {
    if (this.period !== newPeriod) {
      this.period = newPeriod
      if (this.ws) {
        this.disconnect()
        this.connect()
      }
    }
  }
} 