export class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout = 3000;
  private symbols: string[] = [];
  private readonly periods = ['15m', '30m', '1h', '2h', '4h', '6h', '12h', '1d'];

  constructor(private onMessage: (data: any) => void) {}

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  connect(symbols: string[]) {
    this.symbols = symbols;
    // 使用组合流订阅多个周期
    const streams = symbols.flatMap(symbol => 
      this.periods.map(period => `${symbol.toLowerCase()}@kline_${period}`)
    ).join('/');
    
    const wsUrl = `wss://stream.binance.com:9443/stream?streams=${streams}`;
    console.log('WebSocket订阅的周期:', this.periods);
    console.log('WebSocket URL:', wsUrl);
    
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('WebSocket连接已建立，正在监听以下周期:', this.periods.join(', '));
      this.reconnectAttempts = 0;
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      // 组合流的数据格式不同，需要处理
      if (data.stream && data.data) {
        const period = data.stream.split('@')[1].replace('kline_', '');
        // 只处理我们关心的周期
        if (this.periods.includes(period)) {
          this.onMessage({
            symbol: data.data.s,
            period: period,
            kline: data.data.k
          });
        }
      }
    };

    this.ws.onclose = () => {
      console.log('WebSocket连接已关闭');
      this.reconnect();
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket错误:', error);
    };
  }

  private reconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`尝试重新连接... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      setTimeout(() => {
        this.connect(this.symbols);
      }, this.reconnectTimeout);
    } else {
      console.error('达到最大重连次数，请手动刷新页面');
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  // 获取当前订阅的所有周期
  getPeriods() {
    return [...this.periods];
  }
} 