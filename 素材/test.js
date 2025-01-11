import klines from './input.js';

// EMA 计算 - 严格按照Pine的ta.ema实现
const calculateEMA = (data, period) => {
    const alpha = 2 / (period + 1);
    const result = new Array(data.length).fill(0);
    let sum = 0;
    
    // 初始化EMA，使用SMA作为第一个值
    for (let i = 0; i < period && i < data.length; i++) {
        sum += data[i];
        result[i] = sum / (i + 1);
    }
    
    // 计算剩余的EMA值
    for (let i = period; i < data.length; i++) {
        result[i] = data[i] * alpha + result[i-1] * (1 - alpha);
    }
    return result;
};

// MACD 计算
const calculateMACD = (prices, fastPeriod, slowPeriod) => {
    const fastEMA = calculateEMA(prices, fastPeriod);
    const slowEMA = calculateEMA(prices, slowPeriod);
    // MACD = fastEMA - slowEMA
    return fastEMA.map((fast, i) => fast - slowEMA[i]);
};

// valuewhen 实现
function valuewhen(condition, values, occurrence = 0) {
    const result = new Array(values.length).fill(null);
    
    // 从后向前遍历，模拟Pine的行为
    for (let i = 0; i < values.length - 2; i++) {
        let count = 0;
        let foundIndex = -1;
        
        // 从当前位置向前查找
        for (let j = i; j >= 0; j--) {
            if (condition[j]) {
                if (count === occurrence) {
                    foundIndex = j;
                    break;
                }
                count++;
            }
        }
        
        if (foundIndex !== -1) {
            // 应用[2]的偏移
            result[i + 2] = values[foundIndex];
        }
    }
    
    return result;
}

// 分形检测 - 严格按照Pine的实现
const detectFractal = (values, index) => {
    if (index < 2 || index >= values.length - 2) return 0;
    
    // Pine中的数组索引是反向的：[0]是最新的，[4]是最旧的
    const v0 = values[index + 2];  // [0] 最新值
    const v1 = values[index + 1];  // [1]
    const v2 = values[index];      // [2] 中心点
    const v3 = values[index - 1];  // [3]
    const v4 = values[index - 2];  // [4] 最旧值
    
    // 顶分形: _src[4] < _src[2] and _src[3] < _src[2] and _src[2] > _src[1] and _src[2] > _src[0]
    if (v4 < v2 && v3 < v2 && v2 > v1 && v2 > v0) {
        return 1;
    }
    
    // 底分形: _src[4] > _src[2] and _src[3] > _src[2] and _src[2] < _src[1] and _src[2] < _src[0]
    if (v4 > v2 && v3 > v2 && v2 < v1 && v2 < v0) {
        return -1;
    }
    
    return 0;
};

// 时间格式化
const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}  ${String(date.getHours()).padStart(2, '0')}:00`;
};

// 调试函数：检查特定时间点附近的数据
const debugTimePoint = (klines, macd2, timestamp) => {
    const targetTime = new Date(timestamp);
    for (let i = 0; i < klines.length; i++) {
        const time = new Date(klines[i].openTime);
        if (time.getFullYear() === targetTime.getFullYear() &&
            time.getMonth() === targetTime.getMonth() &&
            time.getDate() === targetTime.getDate() &&
            time.getHours() === targetTime.getHours()) {
            
            console.log('\n调试信息 - 目标时间点:', formatDate(klines[i].openTime));
            // 打印MACD分形相关数据
            if (i >= 2 && i < macd2.length - 2) {
                // 按照Pine脚本的顺序打印[4]到[0]
                console.log('MACD值 [4~0]:', 
                    macd2[i-2], macd2[i-1], macd2[i], macd2[i+1], macd2[i+2]);
                console.log('分形检测结果:', detectFractal(macd2, i));
            }
            // 打印价格数据
            console.log('Low价格:', klines[i].low);
            console.log('High价格:', klines[i].high);
            return i;
        }
    }
    return -1;
};

// 配置参数
const config = {
    afa: true,              // Ver Zona Atlas
    afc: true,              // Ver Zona Choppiness
    chopi: 50.0,           // Nivel Choppiness
    div_reg_al: true,      // Ver Divergencias Regulares Alcistas
    div_reg_ba: true,      // Ver Divergencias Regulares Bajistas
    etiquetas: true        // Ver Etiquetas De Divergencias
};

// SMA 计算
const calculateSMA = (data, period) => {
    const result = new Array(data.length).fill(0);
    for (let i = 0; i < data.length; i++) {
        let sum = 0;
        let count = 0;
        for (let j = Math.max(0, i - period + 1); j <= i; j++) {
            sum += data[j];
            count++;
        }
        result[i] = sum / count;
    }
    return result;
};

// 标准差计算
const calculateStdev = (data, period) => {
    const sma = calculateSMA(data, period);
    const result = new Array(data.length).fill(0);
    
    for (let i = 0; i < data.length; i++) {
        let sum = 0;
        let count = 0;
        for (let j = Math.max(0, i - period + 1); j <= i; j++) {
            sum += Math.pow(data[j] - sma[i], 2);
            count++;
        }
        result[i] = Math.sqrt(sum / count);
    }
    return result;
};

// TR (True Range) 计算
const calculateTR = (highs, lows, closes) => {
    const result = new Array(highs.length).fill(0);
    for (let i = 0; i < highs.length; i++) {
        const hl = highs[i] - lows[i];
        const hc = i === 0 ? hl : Math.abs(highs[i] - closes[i-1]);
        const lc = i === 0 ? hl : Math.abs(lows[i] - closes[i-1]);
        result[i] = Math.max(hl, hc, lc);
    }
    return result;
};

// 求和函数
const calculateSum = (data, period) => {
    const result = new Array(data.length).fill(0);
    for (let i = 0; i < data.length; i++) {
        let sum = 0;
        for (let j = Math.max(0, i - period + 1); j <= i; j++) {
            sum += data[j];
        }
        result[i] = sum;
    }
    return result;
};

// 最低值计算
const calculateLowest = (data, period) => {
    const result = new Array(data.length).fill(0);
    for (let i = 0; i < data.length; i++) {
        let min = data[i];
        for (let j = Math.max(0, i - period + 1); j <= i; j++) {
            min = Math.min(min, data[j]);
        }
        result[i] = min;
    }
    return result;
};

// 最高值计算
const calculateHighest = (data, period) => {
    const result = new Array(data.length).fill(0);
    for (let i = 0; i < data.length; i++) {
        let max = data[i];
        for (let j = Math.max(0, i - period + 1); j <= i; j++) {
            max = Math.max(max, data[j]);
        }
        result[i] = max;
    }
    return result;
};

// 信号检测
const detectSignals = (klines) => {
    const closes = klines.map(k => parseFloat(k.close));
    const highs = klines.map(k => parseFloat(k.high));
    const lows = klines.map(k => parseFloat(k.low));
    
    // 计算MACD
    const macd1 = calculateMACD(closes, 12, 26);
    const macd2 = calculateMACD(closes, 5, 15);
    
    // 计算ploff
    const ploff = macd2.map(v => Math.abs(v) / 8);
    
    // 创建结果数组
    const fractal_top1 = new Array(macd2.length).fill(null);
    const fractal_bot1 = new Array(macd2.length).fill(null);
    
    // 检测分形并填充数组
    for (let i = 2; i < macd2.length - 2; i++) {
        const fractal = detectFractal(macd2, i);
        if (fractal > 0) {
            fractal_top1[i] = macd2[i];
        } else if (fractal < 0) {
            fractal_bot1[i] = macd2[i];
        }
    }
    
    // 计算valuewhen值
    const high_prev1 = valuewhen(fractal_top1.map(v => v !== null), macd2, 0);
    const high_price1 = valuewhen(fractal_top1.map(v => v !== null), highs, 0);
    const low_prev1 = valuewhen(fractal_bot1.map(v => v !== null), macd2, 0);
    const low_price1 = valuewhen(fractal_bot1.map(v => v !== null), lows, 0);
    
    // 输出最近几个小时的值
    for (let i = klines.length - 7; i < klines.length; i++) {
        console.log(`${formatDate(klines[i].openTime)} [${fractal_top1[i]?.toFixed(2) ?? 'na'} ${fractal_bot1[i]?.toFixed(2) ?? 'na'} ${high_prev1[i]?.toFixed(2) ?? 'na'} ${high_price1[i]?.toFixed(2) ?? 'na'} ${low_prev1[i]?.toFixed(2) ?? 'na'} ${low_price1[i]?.toFixed(2) ?? 'na'}]`);
    }
    
    const signals = [];
    
    // 检测背离
    for (let i = 2; i < macd2.length - 2; i++) {
        // 看跌背离
        if (fractal_top1[i] !== null && high_prev1[i] !== null) {
            const regular_bearish_div1 = highs[i] > high_price1[i] && macd2[i] < high_prev1[i];
            if (regular_bearish_div1) {
                const plotPosition = macd2[i] + ploff[i];
                signals.push({
                    time: klines[i].openTime,
                    type: '🐻 R'
                });
            }
        }
        
        // 看涨背离
        if (fractal_bot1[i] !== null && low_prev1[i] !== null) {
            const regular_bullish_div1 = lows[i] < low_price1[i] && macd2[i] > low_prev1[i];
            if (regular_bullish_div1) {
                const plotPosition = macd2[i] - ploff[i];
                signals.push({
                    time: klines[i].openTime,
                    type: '🐂 R'
                });
            }
        }
    }
    
    // 按时间降序排序
    signals.sort((a, b) => b.time - a.time);
    return signals.map(signal => `${formatDate(signal.time)} ${signal.type}`).join('\n');
};

// 处理数据并输出信号
const result = detectSignals(klines);
console.log('\n最终信号结果:');
console.log(result);



// [2025-01-11T03:00:00.000+08:00]: fractal_top1:NaN fractal_bot1:NaN high_prev1:708.916 high_price1:95,293.4 low_prev1:-670.485 low_price1:91,203.67 regular_bearish_div1:false regular_bullish_div1:false
// [2025-01-11T04:00:00.000+08:00]: fractal_top1:NaN fractal_bot1:NaN high_prev1:708.916 high_price1:95,293.4 low_prev1:-66.559 low_price1:93,177.4 regular_bearish_div1:false regular_bullish_div1:false
// [2025-01-11T05:00:00.000+08:00]: fractal_top1:434.083 fractal_bot1:NaN high_prev1:708.916 high_price1:95,293.4 low_prev1:-66.559 low_price1:93,177.4 regular_bearish_div1:true regular_bullish_div1:false
// [2025-01-11T06:00:00.000+08:00]: fractal_top1:NaN fractal_bot1:NaN high_prev1:708.916 high_price1:95,293.4 low_prev1:-66.559 low_price1:93,177.4 regular_bearish_div1:false regular_bullish_div1:false
// [2025-01-11T07:00:00.000+08:00]: fractal_top1:NaN fractal_bot1:NaN high_prev1:434.083 high_price1:95,386.74 low_prev1:-66.559 low_price1:93,177.4 regular_bearish_div1:false regular_bullish_div1:false
// [2025-01-11T08:00:00.000+08:00]: fractal_top1:NaN fractal_bot1:NaN high_prev1:434.083 high_price1:95,386.74 low_prev1:-66.559 low_price1:93,177.4 regular_bearish_div1:false regular_bullish_div1:false
// [2025-01-11T09:00:00.000+08:00]: fractal_top1:NaN fractal_bot1:NaN high_prev1:434.083 high_price1:95,386.74 low_prev1:-66.559 low_price1:93,177.4 regular_bearish_div1:false regular_bullish_div1:false
// [2025-01-11T10:00:00.000+08:00]: fractal_top1:NaN fractal_bot1:NaN high_prev1:434.083 high_price1:95,386.74 low_prev1:-66.559 low_price1:93,177.4 regular_bearish_div1:false regular_bullish_div1:false