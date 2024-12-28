export class WebSocketService {
  private ws: WebSocket | null = null;
  private symbols: string[] = [];
  private readonly periods = ['15m', '30m', '1h', '2h', '4h', '6h', '12h', '1d'];

  constructor(private onMessage: (data: any) => void) {}

  connect(symbols: string[]) {
    this.symbols = symbols;
    const streams = symbols.flatMap(symbol => 
      this.periods.map(period => `${symbol.toLowerCase()}@kline_${period}`)
    ).join('/');
    
    const wsUrl = `wss://stream.binance.com:9443/stream?streams=${streams}`;
    
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('WebSocket已连接');
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.stream && data.data) {
        const period = data.stream.split('@')[1].replace('kline_', '');
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
      console.log('WebSocket已断开，5秒后重连');
      setTimeout(() => this.connect(this.symbols), 5000);
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket错误:', error);
    };
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
} 