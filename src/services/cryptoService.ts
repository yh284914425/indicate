import axios from 'axios';

export interface KlineData {
  openTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  closeTime: number;
  quoteVolume: string;
  trades: number;
  buyBaseVolume: string;
  buyQuoteVolume: string;
  ignore: string;
}

export class CryptoService {
  private baseUrl = 'https://api.binance.com';

  // 获取K线数据
  async getKlines(
    symbol: string, 
    interval: string, 
    limit: number = 1000,
    startTime?: number,
    endTime?: number
  ): Promise<KlineData[]> {
    try {
      const params: any = {
        symbol,
        interval,
        limit
      }
      
      if (startTime) params.startTime = startTime
      if (endTime) params.endTime = endTime

      const response = await axios.get(`${this.baseUrl}/api/v3/klines`, { params })

      return response.data.map((k: any[]) => ({
        openTime: k[0],
        open: k[1],
        high: k[2],
        low: k[3],
        close: k[4],
        volume: k[5],
        closeTime: k[6],
        quoteVolume: k[7],
        trades: k[8],
        buyBaseVolume: k[9],
        buyQuoteVolume: k[10],
        ignore: k[11]
      }));
    } catch (error) {
      console.error(`获取K线数据失败 ${symbol}:`, error);
      throw error;
    }
  }

  // 获取更多K线数据
  async getExtendedKlines(
    symbol: string,
    interval: string,
    desiredLimit: number = 2000
  ): Promise<KlineData[]> {
    try {
      const batchSize = 1000;
      const batches = Math.ceil(desiredLimit / batchSize);
      let allKlines: KlineData[] = [];
      
      for (let i = 0; i < batches; i++) {
        let endTime: number | undefined;
        if (allKlines.length > 0) {
          endTime = allKlines[0].openTime - 1;
        }
        
        const klines = await this.getKlines(
          symbol,
          interval,
          Math.min(batchSize, desiredLimit - allKlines.length),
          undefined,
          endTime
        );
        
        if (klines.length === 0) break;
        allKlines = [...klines, ...allKlines];
        
        if (klines.length < batchSize) break;
        
        // 添加延迟以避免触发频率限制
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      return allKlines;
    } catch (error) {
      console.error(`获取扩展K线数据失败 ${symbol}:`, error);
      throw error;
    }
  }

  // 技术指标计算函数
  private MA(data: number[], period: number): number[] {
    const result: number[] = [];
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        result.push(0);
        continue;
      }
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += data[i - j];
      }
      result.push(sum / period);
    }
    return result;
  }

  private EMA(data: number[], period: number): number[] {
    const k = 2 / (period + 1);
    const result: number[] = [];
    let ema = data[0];
    
    for (let i = 0; i < data.length; i++) {
      if (i === 0) {
        result.push(data[0]);
      } else {
        ema = data[i] * k + ema * (1 - k);
        result.push(ema);
      }
    }
    return result;
  }

  private SMA(data: number[], n: number, m: number): number[] {
    const result: number[] = [];
    let sma = data[0];
    
    for (let i = 0; i < data.length; i++) {
      if (i === 0) {
        result.push(data[0]);
      } else {
        sma = (m * data[i] + (n - m) * result[i-1]) / n;
        result.push(sma);
      }
    }
    return result;
  }

  private HHV(data: number[], period: number): number[] {
    const result: number[] = [];
    for (let i = 0; i < data.length; i++) {
      let max = data[i];
      for (let j = Math.max(0, i - period + 1); j <= i; j++) {
        if (data[j] > max) {
          max = data[j];
        }
      }
      result.push(max);
    }
    return result;
  }

  private LLV(data: number[], period: number): number[] {
    const result: number[] = [];
    for (let i = 0; i < data.length; i++) {
      let min = data[i];
      for (let j = Math.max(0, i - period + 1); j <= i; j++) {
        if (data[j] < min) {
          min = data[j];
        }
      }
      result.push(min);
    }
    return result;
  }

  private CROSS(a1: number, b1: number, a2: number, b2: number): boolean {
    return a1 <= b1 && a2 > b2;
  }

  // 计算技术指标
  calculateIndicators_KDJ(klines: KlineData[]): {
    j: number[],
    j1: number[],
    topDivergence: boolean[],
    bottomDivergence: boolean[]
  } {
    console.log(klines,"klines")
    const results111 = this.calculateIndicators_SYH(klines, {
      pivotPeriod: 5,         // 转折点周期
      minDivergence: 1,       // 最小背离数量
      checkCutThrough: false, // 是否检查切线
      scaleFactor: 1.0,      // 背离柱状图缩放因子
      showBullishDiv: true,  // 显示底背离
      showBearishDiv: true,  // 显示顶背离
      showLabels: true       // 显示标签
    });
    console.log(results111,"results111")
    const high = klines.map(k => parseFloat(k.high));
    const low = klines.map(k => parseFloat(k.low));
    const close = klines.map(k => parseFloat(k.close));
    
    const llv = this.LLV(low, 34);
    const hhv = this.HHV(high, 34);
    const lowv = this.EMA(llv, 3);
    const highv = this.EMA(hhv, 3);
    
    const rsv: number[] = [];
    for (let i = 0; i < klines.length; i++) {
      if (highv[i] === lowv[i]) {
        rsv[i] = 50;
      } else {
        rsv[i] = ((close[i] - lowv[i]) / (highv[i] - lowv[i])) * 100;
      }
    }
    const rsvEma = this.EMA(rsv, 3);
    
    const k = this.SMA(rsvEma, 8, 1);
    const d = this.SMA(k, 6, 1);
    const j = k.map((v, i) => 3 * v - 2 * d[i]);
    const j1 = this.MA(j, 3);
    
    const topDivergence: boolean[] = new Array(klines.length).fill(false);
    const bottomDivergence: boolean[] = new Array(klines.length).fill(false);
    
    for (let i = 34; i < klines.length; i++) {
      const jCrossUpJ1 = this.CROSS(j[i-1], j1[i-1], j[i], j1[i]);
      const j1CrossUpJ = this.CROSS(j1[i-1], j[i-1], j1[i], j[i]);
      
      if (jCrossUpJ1) {
        let lastCrossIndex = -1;
        for (let k = i - 1; k >= 34; k--) {
          if (this.CROSS(j[k-1], j1[k-1], j[k], j1[k])) {
            lastCrossIndex = k;
            break;
          }
        }
        
        if (lastCrossIndex !== -1) {
          if (close[lastCrossIndex] > close[i] &&
              j[i] > j[lastCrossIndex] &&
              j[i] < 20) {
            bottomDivergence[i] = true;
          }
        }
      }
      
      if (j1CrossUpJ) {
        let lastCrossIndex = -1;
        for (let k = i - 1; k >= 34; k--) {
          if (this.CROSS(j1[k-1], j[k-1], j1[k], j[k])) {
            lastCrossIndex = k;
            break;
          }
        }
        
        if (lastCrossIndex !== -1) {
          if (close[lastCrossIndex] < close[i] &&
              j1[lastCrossIndex] > j1[i] &&
              j[i] > 90) {
            topDivergence[i] = true;
          }
        }
      }
    }
    
    return { j, j1, topDivergence, bottomDivergence };
  }

  async getSymbols(): Promise<string[]> {
    try {
      const response = await axios.get('https://api.binance.com/api/v3/exchangeInfo')
      return response.data.symbols
        .filter((symbol: any) => symbol.status === 'TRADING' && symbol.quoteAsset === 'USDT')
        .map((symbol: any) => symbol.symbol)
    } catch (error) {
      console.error('获取交易对列表失败:', error)
      throw error
    }
  }

  // 获取K线数据
  async getKlineData(symbol: string, interval: string, limit: number = 1000) {
    try {
      const response = await fetch(
        `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
      )
      if (!response.ok) {
        throw new Error('获取K线数据失败')
      }
      return await response.json()
    } catch (error) {
      console.error('获取K线数据出错:', error)
      throw error
    }
  }

  // 获取指定时间范围的K线数据
  async getKlinesWithTime(
    symbol: string,
    interval: string,
    startTime: number,
    endTime: number
  ): Promise<KlineData[]> {
    try {
      const params: any = {
        symbol,
        interval,
        startTime,
        endTime,
        limit: 1000
      }

      let allKlines: KlineData[] = [];
      let currentStartTime = startTime;

      while (currentStartTime < endTime) {
        params.startTime = currentStartTime;
        const response = await axios.get(`${this.baseUrl}/api/v3/klines`, { params });
        const klines = response.data.map((k: any[]) => ({
          openTime: k[0],
          open: k[1],
          high: k[2],
          low: k[3],
          close: k[4],
          volume: k[5],
          closeTime: k[6],
          quoteVolume: k[7],
          trades: k[8],
          buyBaseVolume: k[9],
          buyQuoteVolume: k[10],
          ignore: k[11]
        }));

        if (klines.length === 0) break;

        allKlines = [...allKlines, ...klines];
        currentStartTime = klines[klines.length - 1].closeTime + 1;

        // 添加延迟以避免触发频率限制
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      return allKlines;
    } catch (error) {
      console.error(`获取K线数据失败 ${symbol}:`, error);
      throw error;
    }
  }

  // 合成更大周期的K线数据
  mergeKlines(klines: KlineData[], periodMultiplier: number): KlineData[] {
    const result: KlineData[] = []
    for (let i = 0; i < klines.length; i += periodMultiplier) {
      if (i + periodMultiplier > klines.length) break
      
      const periodKlines = klines.slice(i, i + periodMultiplier)
      const mergedKline: KlineData = {
        openTime: periodKlines[0].openTime,
        open: periodKlines[0].open,
        high: Math.max(...periodKlines.map(k => parseFloat(k.high))).toString(),
        low: Math.min(...periodKlines.map(k => parseFloat(k.low))).toString(),
        close: periodKlines[periodMultiplier - 1].close,
        volume: periodKlines.reduce((sum, k) => sum + parseFloat(k.volume), 0).toString(),
        closeTime: periodKlines[periodMultiplier - 1].closeTime,
        quoteVolume: periodKlines.reduce((sum, k) => sum + parseFloat(k.quoteVolume), 0).toString(),
        trades: periodKlines.reduce((sum, k) => sum + k.trades, 0),
        buyBaseVolume: periodKlines.reduce((sum, k) => sum + parseFloat(k.buyBaseVolume), 0).toString(),
        buyQuoteVolume: periodKlines.reduce((sum, k) => sum + parseFloat(k.buyQuoteVolume), 0).toString(),
        ignore: "0"
      }
      result.push(mergedKline)
    }
    return result
  }

  // 获取一年的15分钟数据并合成其他周期
  async getYearlyData(
    symbol: string,
    startTime: number,
    endTime: number,
    progressCallback?: (progress: number) => void
  ): Promise<{
    '15m': { klines: KlineData[], indicators: any },
    '30m': { klines: KlineData[], indicators: any },
    '1h': { klines: KlineData[], indicators: any },
    '2h': { klines: KlineData[], indicators: any },
    '4h': { klines: KlineData[], indicators: any },
    '6h': { klines: KlineData[], indicators: any },
    '12h': { klines: KlineData[], indicators: any },
    '1d': { klines: KlineData[], indicators: any },
    '1w': { klines: KlineData[], indicators: any }
  }> {
    // 获取15分钟数据
    const allKlines: KlineData[] = []
    let currentStartTime = startTime
    const batchSize = 1000
    let totalBatches = Math.ceil((endTime - startTime) / (15 * 60 * 1000) / batchSize)
    let completedBatches = 0

    while (currentStartTime < endTime) {
      const klines = await this.getKlines(symbol, '15m', batchSize, currentStartTime)
      if (klines.length === 0) break

      allKlines.push(...klines)
      currentStartTime = klines[klines.length - 1].closeTime + 1

      completedBatches++
      if (progressCallback) {
        progressCallback((completedBatches / totalBatches) * 100)
      }

      // 添加延迟以避免API限制
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    // 合成各个周期的数据
    const periodMultipliers = {
      '15m': 1,
      '30m': 2,
      '1h': 4,
      '2h': 8,
      '4h': 16,
      '6h': 24,
      '12h': 48,
      '1d': 96,
      '1w': 96 * 7
    }

    const result: any = {}
    Object.entries(periodMultipliers).forEach(([period, multiplier]) => {
      const klines = multiplier === 1 ? allKlines : this.mergeKlines(allKlines, multiplier)
      const indicators = this.calculateIndicators_KDJ(klines)
      result[period] = { klines, indicators }
    })

    return result
  }

  // 辅助函数 - EMA计算
  private calculateEMA(data: number[], period: number): number[] {
    const k = 2 / (period + 1);
    const emaData = [];
    let ema = data[0];
    
    for (let i = 0; i < data.length; i++) {
      ema = (data[i] - ema) * k + ema;
      emaData.push(ema);
    }
    
    return emaData;
  }

  // 辅助函数 - RSI计算
  private calculateRSI(data: number[], period: number): number[] {
    const rsi: number[] = [];
    let gain = 0;
    let loss = 0;

    // 第一个值
    for (let i = 1; i <= period; i++) {
      const diff = data[i] - data[i - 1];
      if (diff >= 0) gain += diff;
      else loss -= diff;
    }

    let avgGain = gain / period;
    let avgLoss = loss / period;
    let rs = avgGain / avgLoss;
    rsi.push(100 - (100 / (1 + rs)));

    // 计算剩余的RSI值
    for (let i = period + 1; i < data.length; i++) {
      const diff = data[i] - data[i - 1];
      if (diff >= 0) {
        avgGain = (avgGain * (period - 1) + diff) / period;
        avgLoss = (avgLoss * (period - 1)) / period;
      } else {
        avgGain = (avgGain * (period - 1)) / period;
        avgLoss = (avgLoss * (period - 1) - diff) / period;
      }
      rs = avgGain / avgLoss;
      rsi.push(100 - (100 / (1 + rs)));
    }

    return rsi;
  }

  // 辅助函数 - MACD计算
  private calculateMACD(data: number[], fastPeriod: number = 12, slowPeriod: number = 26, signalPeriod: number = 9): {
    macd: number[];
    signal: number[];
    histogram: number[];
  } {
    const fastEMA = this.calculateEMA(data, fastPeriod);
    const slowEMA = this.calculateEMA(data, slowPeriod);
    const macd = fastEMA.map((fast, i) => fast - slowEMA[i]);
    const signal = this.calculateEMA(macd, signalPeriod);
    const histogram = macd.map((value, i) => value - signal[i]);

    return { macd, signal, histogram };
  }

  // 辅助函数 - 动量指标计算
  private calculateMomentum(data: number[], period: number): number[] {
    const momentum: number[] = [];
    for (let i = 0; i < data.length; i++) {
      if (i < period) {
        momentum.push(0);
      } else {
        momentum.push(data[i] - data[i - period]);
      }
    }
    return momentum;
  }

  // 辅助函数 - CCI计算
  private calculateCCI(high: number[], low: number[], close: number[], period: number): number[] {
    const tp = high.map((h, i) => (h + low[i] + close[i]) / 3);
    const sma = this.MA(tp, period);
    const meanDeviation = tp.map((value, i) => {
      if (i < period - 1) return 0;
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += Math.abs(value - sma[i]);
      }
      return sum / period;
    });

    return tp.map((value, i) => {
      if (i < period - 1) return 0;
      return (value - sma[i]) / (0.015 * meanDeviation[i]);
    });
  }

  // 辅助函数 - 判断高点
  private isPivotHigh(data: number[], leftBars: number, rightBars: number, index: number): boolean {
    const value = data[index];
    for (let i = index - leftBars; i < index; i++) {
      if (i >= 0 && data[i] >= value) return false;
    }
    for (let i = index + 1; i <= index + rightBars; i++) {
      if (i < data.length && data[i] >= value) return false;
    }
    return true;
  }

  // 辅助函数 - 判断低点
  private isPivotLow(data: number[], leftBars: number, rightBars: number, index: number): boolean {
    const value = data[index];
    for (let i = index - leftBars; i < index; i++) {
      if (i >= 0 && data[i] <= value) return false;
    }
    for (let i = index + 1; i <= index + rightBars; i++) {
      if (i < data.length && data[i] <= value) return false;
    }
    return true;
  }

  // 辅助函数 - 计算变化量
  private change(data: number[]): number[] {
    const result: number[] = [0];
    for (let i = 1; i < data.length; i++) {
      result.push(data[i] - data[i - 1]);
    }
    return result;
  }

  // 辅助函数 - 计算TR (True Range)
  private calculateTR(high: number[], low: number[], close: number[]): number[] {
    const tr: number[] = [high[0] - low[0]];
    for (let i = 1; i < high.length; i++) {
      const hl = high[i] - low[i];
      const hc = Math.abs(high[i] - close[i - 1]);
      const lc = Math.abs(low[i] - close[i - 1]);
      tr.push(Math.max(hl, hc, lc));
    }
    return tr;
  }

  // 辅助函数 - RMA计算
  private calculateRMA(data: number[], period: number): number[] {
    const result: number[] = [];
    let sum = 0;
    
    // 计算第一个值
    for (let i = 0; i < period; i++) {
      sum += data[i];
      result.push(0);
    }
    result[period - 1] = sum / period;
    
    // 计算其余值
    const alpha = 1 / period;
    for (let i = period; i < data.length; i++) {
      const rma = (data[i] * alpha) + (result[i - 1] * (1 - alpha));
      result.push(rma);
    }
    return result;
  }

  // 辅助函数 - VWMA计算
  private calculateVWMA(close: number[], volume: number[], period: number): number[] {
    const result: number[] = [];
    for (let i = 0; i < close.length; i++) {
      if (i < period - 1) {
        result.push(0);
        continue;
      }
      let sumVol = 0;
      let sumVolPrice = 0;
      for (let j = 0; j < period; j++) {
        sumVol += volume[i - j];
        sumVolPrice += close[i - j] * volume[i - j];
      }
      result.push(sumVolPrice / sumVol);
    }
    return result;
  }

  // 辅助函数 - Stochastic计算
  private calculateStoch(close: number[], high: number[], low: number[], period: number): number[] {
    const result: number[] = [];
    for (let i = 0; i < close.length; i++) {
      if (i < period - 1) {
        result.push(0);
        continue;
      }
      let highestHigh = high[i];
      let lowestLow = low[i];
      for (let j = 0; j < period; j++) {
        highestHigh = Math.max(highestHigh, high[i - j]);
        lowestLow = Math.min(lowestLow, low[i - j]);
      }
      const stoch = ((close[i] - lowestLow) / (highestHigh - lowestLow)) * 100;
      result.push(stoch);
    }
    return result;
  }

  // 辅助函数 - MFI计算
  private calculateMFI(close: number[], high: number[], low: number[], volume: number[], period: number): number[] {
    const typicalPrice = close.map((c, i) => (c + high[i] + low[i]) / 3);
    const moneyFlow = typicalPrice.map((tp, i) => tp * volume[i]);
    
    const result: number[] = [];
    for (let i = 0; i < close.length; i++) {
      if (i < period) {
        result.push(0);
        continue;
      }
      
      let posFlow = 0;
      let negFlow = 0;
      
      for (let j = 0; j < period; j++) {
        if (typicalPrice[i - j] > typicalPrice[i - j - 1]) {
          posFlow += moneyFlow[i - j];
        } else {
          negFlow += moneyFlow[i - j];
        }
      }
      
      const mfi = 100 - (100 / (1 + posFlow / negFlow));
      result.push(mfi);
    }
    return result;
  }

  // 辅助函数 - OBV计算
  private calculateOBV(close: number[], volume: number[]): number[] {
    const result: number[] = [0];
    for (let i = 1; i < close.length; i++) {
      const prevOBV = result[i - 1];
      if (close[i] > close[i - 1]) {
        result.push(prevOBV + volume[i]);
      } else if (close[i] < close[i - 1]) {
        result.push(prevOBV - volume[i]);
      } else {
        result.push(prevOBV);
      }
    }
    return result;
  }

  // 辅助函数 - 查找数组中的前一个非空值
  private nz(data: number[], index: number, defaultValue: number = 0): number {
    if (index < 0 || index >= data.length || isNaN(data[index])) {
      return defaultValue;
    }
    return data[index];
  }

  // 辅助函数 - 寻找高点
  private findPivotHigh(data: number[], leftBars: number, rightBars: number): number[] {
    const result: number[] = new Array(data.length).fill(NaN);
    for (let i = leftBars; i < data.length - rightBars; i++) {
      let isHigh = true;
      for (let j = 1; j <= leftBars; j++) {
        if (data[i] <= data[i - j]) {
          isHigh = false;
          break;
        }
      }
      if (isHigh) {
        for (let j = 1; j <= rightBars; j++) {
          if (data[i] <= data[i + j]) {
            isHigh = false;
            break;
          }
        }
      }
      if (isHigh) {
        result[i] = data[i];
      }
    }
    return result;
  }

  // 辅助函数 - 寻找低点
  private findPivotLow(data: number[], leftBars: number, rightBars: number): number[] {
    const result: number[] = new Array(data.length).fill(NaN);
    for (let i = leftBars; i < data.length - rightBars; i++) {
      let isLow = true;
      for (let j = 1; j <= leftBars; j++) {
        if (data[i] >= data[i - j]) {
          isLow = false;
          break;
        }
      }
      if (isLow) {
        for (let j = 1; j <= rightBars; j++) {
          if (data[i] >= data[i + j]) {
            isLow = false;
            break;
          }
        }
      }
      if (isLow) {
        result[i] = data[i];
      }
    }
    return result;
  }

  // 辅助函数 - 判断分形顶部
  private isTopFractal(data: number[], index: number): boolean {
    if (index < 4 || index >= data.length - 1) return false;
    return data[index - 4] < data[index - 2] &&
           data[index - 3] < data[index - 2] &&
           data[index - 2] > data[index - 1] &&
           data[index - 2] > data[index];
  }

  // 辅助函数 - 判断分形底部
  private isBottomFractal(data: number[], index: number): boolean {
    if (index < 4 || index >= data.length - 1) return false;
    return data[index - 4] > data[index - 2] &&
           data[index - 3] > data[index - 2] &&
           data[index - 2] < data[index - 1] &&
           data[index - 2] < data[index];
  }

  // 辅助函数 - 获取前一个值
  private valueWhen(condition: boolean[], data: number[], occurrence: number = 0): number[] {
    const result: number[] = new Array(data.length).fill(NaN);
    const values: number[] = [];
    
    // 收集所有符合条件的值
    for (let i = 0; i < data.length; i++) {
      if (condition[i]) {
        values.push(data[i]);
      }
      if (values.length > occurrence) {
        result[i] = values[values.length - 1 - occurrence];
      }
    }
    
    return result;
  }

  // 盛宜华背离综合指标计算
  calculateIndicators_SYH(klines: KlineData[], options = {
    pivotPeriod: 5,
    minDivergence: 1,
    checkCutThrough: false,
    scaleFactor: 1.0,
    showBullishDiv: true,
    showBearishDiv: true,
    showLabels: true
  }): {
    totalDivergence: number[];
    regularBearishDiv: boolean[];
    regularBullishDiv: boolean[];
    macd1: number[];
    macd2: number[];
    macdBearishDiv: boolean[];  // 新增：MACD顶背离
    macdBullishDiv: boolean[];  // 新增：MACD底背离
    indicators: {
      rsi: number[];
      macd: number[];
      signal: number[];
      deltamacd: number[];
      moment: number[];
      cci: number[];
      obv: number[];
      stk: number[];
      diosc: number[];
      vwmacd: number[];
      cmf: number[];
      mfi: number[];
    }
  } {
    const close = klines.map(k => parseFloat(k.close));
    const high = klines.map(k => parseFloat(k.high));
    const low = klines.map(k => parseFloat(k.low));
    const volume = klines.map(k => parseFloat(k.volume));

    // 计算所有基础指标
    const rsi = this.calculateRSI(close, 14);
    const macdResult = this.calculateMACD(close, 12, 26, 9);
    const moment = this.calculateMomentum(close, 10);
    const cci = this.calculateCCI(high, low, close, 10);
    const obv = this.calculateOBV(close, volume);
    const stk = this.MA(this.calculateStoch(close, high, low, 14), 3);
    
    // DI和DIOSC计算
    const highChange = this.change(high);
    const lowChange = this.change(low).map(x => -x);
    const DI = highChange.map((h, i) => h - lowChange[i]);
    const tr = this.calculateTR(high, low, close);
    const trur = this.calculateRMA(tr, 14);
    const diosc = trur.map((t, i) => t === 0 ? 0 : 100 * this.calculateRMA(DI, 14)[i] / t);

    // VWMACD计算
    const maFast = this.calculateVWMA(close, volume, 12);
    const maSlow = this.calculateVWMA(close, volume, 26);
    const vwmacd = maFast.map((f, i) => f - maSlow[i]);

    // CMF计算
    const cmfm = close.map((c, i) => {
      const hl = high[i] - low[i];
      return hl === 0 ? 0 : ((c - low[i]) - (high[i] - c)) / hl;
    });
    const cmfv = cmfm.map((m, i) => m * volume[i]);
    const cmf = this.MA(cmfv, 21).map((c, i) => c / this.MA(volume, 21)[i]);

    // MFI计算
    const mfi = this.calculateMFI(close, high, low, volume, 14);

    // 计算转折点
    const pivotHighs = this.findPivotHigh(close, options.pivotPeriod, options.pivotPeriod);
    const pivotLows = this.findPivotLow(close, options.pivotPeriod, options.pivotPeriod);

    // 初始化结果数组
    const divergenceResults: number[] = new Array(klines.length).fill(0);
    const regularBearishDiv: boolean[] = new Array(klines.length).fill(false);
    const regularBullishDiv: boolean[] = new Array(klines.length).fill(false);

    // 计算背离
    for (let i = options.pivotPeriod * 2; i < klines.length; i++) {
      let totalDiv = 0;
      
      // 处理顶背离
      if (!isNaN(pivotHighs[i])) {
        let prevHighIndex = -1;
        for (let j = i - 1; j >= options.pivotPeriod * 2; j--) {
          if (!isNaN(pivotHighs[j])) {
            prevHighIndex = j;
            break;
          }
        }
        
        if (prevHighIndex !== -1) {
          // 计算各指标的顶背离
          if (close[i] > close[prevHighIndex]) {
            if (rsi[i] < rsi[prevHighIndex]) totalDiv--;
            if (macdResult.macd[i] < macdResult.macd[prevHighIndex]) totalDiv--;
            if (macdResult.histogram[i] < macdResult.histogram[prevHighIndex]) totalDiv--;
            if (moment[i] < moment[prevHighIndex]) totalDiv--;
            if (cci[i] < cci[prevHighIndex]) totalDiv--;
            if (obv[i] < obv[prevHighIndex]) totalDiv--;
            if (stk[i] < stk[prevHighIndex]) totalDiv--;
            if (diosc[i] < diosc[prevHighIndex]) totalDiv--;
            if (vwmacd[i] < vwmacd[prevHighIndex]) totalDiv--;
            if (cmf[i] < cmf[prevHighIndex]) totalDiv--;
            if (mfi[i] < mfi[prevHighIndex]) totalDiv--;
          }
        }
      }

      // 处理底背离
      if (!isNaN(pivotLows[i])) {
        let prevLowIndex = -1;
        for (let j = i - 1; j >= options.pivotPeriod * 2; j--) {
          if (!isNaN(pivotLows[j])) {
            prevLowIndex = j;
            break;
          }
        }
        
        if (prevLowIndex !== -1) {
          // 计算各指标的底背离
          if (close[i] < close[prevLowIndex]) {
            if (rsi[i] > rsi[prevLowIndex]) totalDiv++;
            if (macdResult.macd[i] > macdResult.macd[prevLowIndex]) totalDiv++;
            if (macdResult.histogram[i] > macdResult.histogram[prevLowIndex]) totalDiv++;
            if (moment[i] > moment[prevLowIndex]) totalDiv++;
            if (cci[i] > cci[prevLowIndex]) totalDiv++;
            if (obv[i] > obv[prevLowIndex]) totalDiv++;
            if (stk[i] > stk[prevLowIndex]) totalDiv++;
            if (diosc[i] > diosc[prevLowIndex]) totalDiv++;
            if (vwmacd[i] > vwmacd[prevLowIndex]) totalDiv++;
            if (cmf[i] > cmf[prevLowIndex]) totalDiv++;
            if (mfi[i] > mfi[prevLowIndex]) totalDiv++;
          }
        }
      }

      divergenceResults[i] = totalDiv;
      regularBearishDiv[i] = totalDiv <= -options.minDivergence;
      regularBullishDiv[i] = totalDiv >= options.minDivergence;
    }

    // 计算MACD分形
    const fractalTop: boolean[] = new Array(klines.length).fill(false);
    const fractalBot: boolean[] = new Array(klines.length).fill(false);
    const macdBearishDiv: boolean[] = new Array(klines.length).fill(false);
    const macdBullishDiv: boolean[] = new Array(klines.length).fill(false);

    // 计算MACD (5,15)
    const macd515 = this.calculateMACD(close, 5, 15, 9);

    // 计算分形点
    for (let i = 4; i < klines.length; i++) {
      // f_fractalize函数的实现
      const isTopFractal = macd515.macd[i-4] < macd515.macd[i-2] && 
                          macd515.macd[i-3] < macd515.macd[i-2] && 
                          macd515.macd[i-2] > macd515.macd[i-1] && 
                          macd515.macd[i-2] > macd515.macd[i];

      const isBotFractal = macd515.macd[i-4] > macd515.macd[i-2] && 
                          macd515.macd[i-3] > macd515.macd[i-2] && 
                          macd515.macd[i-2] < macd515.macd[i-1] && 
                          macd515.macd[i-2] < macd515.macd[i];

      // 标记分形点
      if (isTopFractal) {
        fractalTop[i-2] = true;
      }
      if (isBotFractal) {
        fractalBot[i-2] = true;
      }
    }

    // 计算背离
    for (let i = 2; i < klines.length; i++) {
      if (fractalTop[i]) {
        // 获取前一个分形点的值
        const prevHighMacd = this.valueWhen(fractalTop, macd515.macd, 1)[i];
        const prevHighPrice = this.valueWhen(fractalTop, high, 1)[i];

        // regular_bearish_div1 条件
        if (!isNaN(prevHighMacd) && !isNaN(prevHighPrice)) {
          if (high[i] > prevHighPrice && macd515.macd[i] < prevHighMacd) {
            macdBearishDiv[i] = true;
          }
        }
      }

      if (fractalBot[i]) {
        // 获取前一个分形点的值
        const prevLowMacd = this.valueWhen(fractalBot, macd515.macd, 1)[i];
        const prevLowPrice = this.valueWhen(fractalBot, low, 1)[i];

        // regular_bullish_div1 条件
        if (!isNaN(prevLowMacd) && !isNaN(prevLowPrice)) {
          if (low[i] < prevLowPrice && macd515.macd[i] > prevLowMacd) {
            macdBullishDiv[i] = true;
          }
        }
      }
    }

    // 收集背离点
    const bearishDivs: number[] = [];
    const bullishDivs: number[] = [];
    
    for (let i = 0; i < klines.length; i++) {
      if (macdBearishDiv[i]) {
        bearishDivs.push(i);
      }
      if (macdBullishDiv[i]) {
        bullishDivs.push(i);
      }
    }

    // 输出背离点
    if (bearishDivs.length > 0 || bullishDivs.length > 0) {
      console.log('\nMACD背离检测结果:');
      if (bearishDivs.length > 0) {
        console.log('MACD顶背离列表:');
        bearishDivs.forEach(idx => {
          console.log({
            时间: new Date(klines[idx].openTime).toLocaleString(),
            价格: high[idx].toFixed(2),
            MACD值: macd515.macd[idx].toFixed(4)
          });
        });
      }
      if (bullishDivs.length > 0) {
        console.log('\nMACD底背离列表:');
        bullishDivs.forEach(idx => {
          console.log({
            时间: new Date(klines[idx].openTime).toLocaleString(),
            价格: low[idx].toFixed(2),
            MACD值: macd515.macd[idx].toFixed(4)
          });
        });
      }
    }

    return {
      totalDivergence: divergenceResults,
      regularBearishDiv,
      regularBullishDiv,
      macd1: macdResult.macd,
      macd2: macd515.macd,
      macdBearishDiv,  // 新增
      macdBullishDiv,  // 新增
      indicators: {
        rsi,
        macd: macdResult.macd,
        signal: macdResult.signal,
        deltamacd: macdResult.histogram,
        moment,
        cci,
        obv,
        stk,
        diosc,
        vwmacd,
        cmf,
        mfi
      }
    };
  }

  // 新增：查找前一个分形点的索引
  private findPreviousFractalIndex(fractalArray: boolean[], currentIndex: number): number {
    for (let i = currentIndex - 1; i >= 0; i--) {
      if (fractalArray[i]) {
        return i;
      }
    }
    return -1;
  }
}
