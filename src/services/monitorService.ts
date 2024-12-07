import { MultiSymbolService } from './multiSymbolService';
import { TelegramService } from './telegramService';
import { config } from '../config'

export class MonitorService {
  private multiSymbolService: MultiSymbolService;
  private telegramService: TelegramService;
  private intervals = ['1h', '2h', '4h', '1d'];
  private isRunning = false;
  private checkInterval: NodeJS.Timeout | null = null;
  private selectedSymbols: string[] = [];

  constructor(chatId?: string) {
    this.multiSymbolService = new MultiSymbolService();
    this.telegramService = new TelegramService(
      config.telegram.botToken,
      chatId || config.telegram.defaultChatId
    );
  }

  async startMonitoring(symbols: string[]) {
    if (this.isRunning) {
      return;
    }

    this.selectedSymbols = symbols; // 保存选中的币种列表
    this.isRunning = true;
    this.checkInterval = setInterval(async () => {
      await this.checkDivergences();
    }, 5 * 60 * 1000); // 每5分钟检查一次

    // 立即执行第一次检查
    await this.checkDivergences();
  }

  stopMonitoring() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.isRunning = false;
  }

  private async checkDivergences() {
    try {
      const date = new Date();
      const alerts: string[] = [];

      for (const interval of this.intervals) {
        // 只获取选中币种的数据
        const promises = this.selectedSymbols.map(async symbol => {
          const klines = await this.multiSymbolService.getKlinesWithCache(symbol, interval, date);
          if (klines.length === 0) return null;

          const result = this.cryptoService.calculateIndicators(klines);
          return { symbol, klines, result };
        });

        const results = await Promise.all(promises);
        const topDivergences: Array<{symbol: string, price: string, time: string}> = [];
        const bottomDivergences: Array<{symbol: string, price: string, time: string}> = [];

        results.forEach(data => {
          if (!data) return;
          const { symbol, klines, result } = data;

          for (let i = 0; i < klines.length; i++) {
            const klineTime = new Date(klines[i].openTime);
            if (result.topDivergence[i]) {
              topDivergences.push({
                symbol,
                price: klines[i].close,
                time: klineTime.toISOString()
              });
            }
            if (result.bottomDivergence[i]) {
              bottomDivergences.push({
                symbol,
                price: klines[i].close,
                time: klineTime.toISOString()
              });
            }
          }
        });

        if (topDivergences.length > 0 || bottomDivergences.length > 0) {
          const message = this.formatTelegramMessage(interval, topDivergences, bottomDivergences);
          alerts.push(message);
        }
      }

      if (alerts.length > 0) {
        const message = `🔔 <b>加密货币背离预警</b>\n\n${alerts.join('\n\n')}`;
        await this.telegramService.sendMessage(message);
      }
    } catch (error) {
      console.error('监控检查失败:', error);
    }
  }

  private formatTelegramMessage(
    interval: string, 
    topDivergences: Array<{symbol: string, price: string, time: string}>,
    bottomDivergences: Array<{symbol: string, price: string, time: string}>
  ): string {
    const timeStr = new Date().toLocaleString();
    let message = `📊 <b>${interval}周期背离预警</b>\n`;
    message += `🕒 ${timeStr}\n\n`;

    if (topDivergences.length > 0) {
      message += '📈 <b>顶背离</b>:\n';
      topDivergences.forEach(d => {
        message += `${d.symbol}: ${d.price} (${new Date(d.time).toLocaleTimeString()})\n`;
      });
    }

    if (bottomDivergences.length > 0) {
      message += '\n📉 <b>底背离</b>:\n';
      bottomDivergences.forEach(d => {
        message += `${d.symbol}: ${d.price} (${new Date(d.time).toLocaleTimeString()})\n`;
      });
    }

    return message;
  }
} 