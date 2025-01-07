import KlineData from './klines';

interface DivergencePoint {
  time: number;
  price: number;
  macd: number;
  type: '🐻 R' | '🐂 R';
}

interface Kline {
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

// EMA计算函数
function calculateEMA(data: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const emaData: number[] = [];
  let ema = data[0];
  
  for (let i = 0; i < data.length; i++) {
    ema = data[i] * k + ema * (1 - k);
    emaData.push(ema);
  }
  
  return emaData;
}

// MACD计算函数
function calculateMACD(close: number[]): number[] {
  const fastEMA = calculateEMA(close, 5);   // L1A = 5
  const slowEMA = calculateEMA(close, 15);  // L2A = 15
  return fastEMA.map((fast, i) => fast - slowEMA[i]);
}

// 获取偏移值
function getOffset(arr: number[], index: number, offset: number): number | undefined {
  const i = index + offset;
  return i >= 0 && i < arr.length ? arr[i] : undefined;
}

// 检查分形
function fractalize(data: number[], index: number): number {
  const values = [-4, -3, -2, -1, 0].map(offset => getOffset(data, index, offset));
  if (values.some(v => v === undefined)) return 0;
  
  // f_top_fractal
  if (values[0]! < values[2]! && 
      values[1]! < values[2]! && 
      values[2]! > values[3]! && 
      values[2]! > values[4]!) {
    return 1;
  }
  
  // f_bot_fractal
  if (values[0]! > values[2]! && 
      values[1]! > values[2]! && 
      values[2]! < values[3]! && 
      values[2]! < values[4]!) {
    return -1;
  }
  
  return 0;
}

// valuewhen函数实现
function valueWhen(condition: number[], value: number[]): number[] {
  const result: number[] = new Array(value.length).fill(NaN);
  let lastValue: number | undefined;
  
  for (let i = 0; i < value.length; i++) {
    if (!isNaN(condition[i])) {
      lastValue = value[i];
    }
    result[i] = lastValue || NaN;
  }
  
  return result;
}

export function findMACDDivergence(klines: Kline[]): DivergencePoint[] {
  const divergencePoints: DivergencePoint[] = [];
  
  // 计算基础数据
  const close = klines.map(k => parseFloat(k.close));
  const high = klines.map(k => parseFloat(k.high));
  const low = klines.map(k => parseFloat(k.low));
  const macd = calculateMACD(close);
  
  // 存储分形点和值
  const fractalTop: number[] = new Array(klines.length).fill(NaN);
  const fractalBot: number[] = new Array(klines.length).fill(NaN);
  
  // 标记分形点
  for (let i = 4; i < macd.length; i++) {
    const fract = fractalize(macd, i);
    if (fract > 0) {
      fractalTop[i] = macd[i-2];  // 存储MACD值
    } else if (fract < 0) {
      fractalBot[i] = macd[i-2];  // 存储MACD值
    }
  }
  
  // 获取前值
  const highPrev = valueWhen(fractalTop, macd);
  const highPrice = valueWhen(fractalTop, high);
  const lowPrev = valueWhen(fractalBot, macd);
  const lowPrice = valueWhen(fractalBot, low);
  
  // 检查背离
  for (let i = 2; i < macd.length - 2; i++) {
    // 顶背离
    if (!isNaN(fractalTop[i+2])) {
      if (!isNaN(highPrev[i]) && !isNaN(highPrice[i])) {
        if (high[i] > highPrice[i] && macd[i] < highPrev[i]) {
          divergencePoints.push({
            time: klines[i].openTime,
            price: high[i],
            macd: macd[i],
            type: '🐻 R'
          });
        }
      }
    }
    
    // 底背离
    if (!isNaN(fractalBot[i+2])) {
      if (!isNaN(lowPrev[i]) && !isNaN(lowPrice[i])) {
        if (low[i] < lowPrice[i] && macd[i] > lowPrev[i]) {
          divergencePoints.push({
            time: klines[i].openTime,
            price: low[i],
            macd: macd[i],
            type: '🐂 R'
          });
        }
      }
    }
  }
  
  return divergencePoints;
}

// 执行测试
const divergences = findMACDDivergence(KlineData);

// 按时间排序
divergences.sort((a, b) => a.time - b.time);

// 输出结果
divergences.forEach(point => {
  console.log(new Date(point.time).toLocaleString() + point.type);
});

//2024/12/28 01:00:00🐂 R
//2024/12/29 15:00:00🐻 R 
//2024/12/31 00:00:00🐂 R
//2025/1/3 03:00:00🐻 R  
//2025/1/5 16:00:00🐻 R  
