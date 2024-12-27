import axios from 'axios';

export class TelegramService {
  private botToken: string;
  private chatId: string;

  constructor(botToken: string, chatId: string) {
    this.botToken = botToken;
    this.chatId = chatId;
  }

  async sendMessage(message: string): Promise<boolean> {
    try {
      const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
      await axios.post(url, {
        chat_id: this.chatId,
        text: message,
        parse_mode: 'HTML'
      });
      return true;
    } catch (error) {
      console.error('发送Telegram消息失败:', error);
      return false;
    }
  }

  formatDivergenceMessage(symbol: string, period: string, type: 'top' | 'bottom', price: string, time: string): string {
    const divergenceType = type === 'top' ? '顶背离' : '底背离';
    return `
🔔 <b>新${divergenceType}信号</b>

📊 交易对: ${symbol}
⏱ 周期: ${period}
💰 价格: ${price}
🕒 时间: ${time}
`;
  }
} 