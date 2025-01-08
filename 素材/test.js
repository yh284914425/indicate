import klines from './input.js';
// MACD Divergence Detection
const calculateEMA = (data, period) => {
    const k = 2 / (period + 1);
    let ema = data[0];
    const result = [ema];
    
    for (let i = 1; i < data.length; i++) {
        ema = data[i] * k + ema * (1 - k);
        result.push(ema);
    }
    return result;
};

const calculateMACD = (prices, fastPeriod, slowPeriod) => {
    const fastEMA = calculateEMA(prices, fastPeriod);
    const slowEMA = calculateEMA(prices, slowPeriod);
    return fastEMA.map((fast, i) => fast - slowEMA[i]);
};

const detectFractal = (values, index) => {
    if (index < 4 || index >= values.length - 2) return 0;
    
    // Top fractal
    if (values[index - 4] < values[index - 2] &&
        values[index - 3] < values[index - 2] &&
        values[index - 2] > values[index - 1] &&
        values[index - 2] > values[index]) {
        return 1;
    }
    
    // Bottom fractal
    if (values[index - 4] > values[index - 2] &&
        values[index - 3] > values[index - 2] &&
        values[index - 2] < values[index - 1] &&
        values[index - 2] < values[index]) {
        return -1;
    }
    
    return 0;
};

const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}  ${String(date.getHours()).padStart(2, '0')}:00`;
};

const detectSignals = (klines) => {
    const closes = klines.map(k => parseFloat(k.close));
    const highs = klines.map(k => parseFloat(k.high));
    const lows = klines.map(k => parseFloat(k.low));
    
    const macd2 = calculateMACD(closes, 5, 15);
    
    const signals = [];
    let lastFractalTop = { value: null, price: null, index: null };
    let lastFractalBottom = { value: null, price: null, index: null };
    
    for (let i = 4; i < klines.length - 2; i++) {
        const fractal = detectFractal(macd2, i);
        
        if (fractal === 1) {
            if (lastFractalTop.value !== null) {
                if (highs[i] > highs[lastFractalTop.index] && 
                    macd2[i] < lastFractalTop.value) {
                    signals.push({
                        time: klines[i].openTime,
                        type: '🐻 R'
      });
    }
  }
            lastFractalTop = { value: macd2[i], price: highs[i], index: i };
        }
        else if (fractal === -1) {
            if (lastFractalBottom.value !== null) {
                if (lows[i] < lows[lastFractalBottom.index] && 
                    macd2[i] > lastFractalBottom.value) {
                    signals.push({
                        time: klines[i].openTime,
                        type: '🐂 R'
                    });
                }
            }
            lastFractalBottom = { value: macd2[i], price: lows[i], index: i };
        }
    }
    
    signals.sort((a, b) => b.time - a.time);
    return signals.map(signal => `${formatDate(signal.time)} ${signal.type}`).join('\n');
};
console.log(klines);
// Process klines data and output signals
const result = detectSignals(klines);
console.log(result);
