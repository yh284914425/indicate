export class ChartWebSocketService {
  private ws: WebSocket | null = null;
  private currentStream: string = '';
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private lastKlineTime: number = 0;
  private isFirstMessage: boolean = true;

  constructor(private onMessage: (data: any) => void) {}

  connect(symbol: string, period: string) {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    this.currentStream = `${symbol.toLowerCase()}@kline_${period}`;
    const wsUrl = `wss://stream.binance.com:9443/stream?streams=${this.currentStream}`;
    this.initWebSocket(wsUrl);
  }

  private initWebSocket(wsUrl: string) {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.isFirstMessage = true;
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('图表WebSocket已连接');
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
      }
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.stream && data.data) {
        const period = data.stream.split('@')[1].replace('kline_', '');
        const klineTime = data.data.k.t;

        if (this.isFirstMessage) {
          this.lastKlineTime = klineTime;
          this.isFirstMessage = false;
          this.onMessage({
            symbol: data.data.s,
            period: period,
            kline: data.data.k
          });
          return;
        }

        if (klineTime <= this.lastKlineTime) {
          if (process.env.NODE_ENV === 'development') {
            console.log('跳过历史K线数据:', new Date(klineTime).toLocaleString());
          }
          return;
        }

        this.lastKlineTime = klineTime;
        
        console.log('接收新K线数据:', {
          time: new Date(klineTime).toLocaleString(),
          symbol: data.data.s,
          period: period,
          open: data.data.k.o,
          close: data.data.k.c
        });

        this.onMessage({
          symbol: data.data.s,
          period: period,
          kline: data.data.k
        });
      }
    };

    this.ws.onclose = (event) => {
      console.log('图表WebSocket断开连接:', event.code, event.reason);
      if (!this.reconnectTimeout && !event.wasClean) {
        this.reconnectTimeout = setTimeout(() => {
          console.log('尝试重新连接WebSocket...');
          this.initWebSocket(wsUrl);
        }, 5000);
      }
    };

    this.ws.onerror = (error) => {
      console.error('图表WebSocket错误:', error);
    };
  }

  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    if (this.ws) {
      this.ws.close(1000, "Normal closure");
      this.ws = null;
    }
    
    this.lastKlineTime = 0;
    this.isFirstMessage = true;
  }
} 