import klines from './input.js';

// EMA 计算
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

// MACD 计算
const calculateMACD = (prices, fastPeriod, slowPeriod) => {
    const fastEMA = calculateEMA(prices, fastPeriod);
    const slowEMA = calculateEMA(prices, slowPeriod);
    return fastEMA.map((fast, i) => fast - slowEMA[i]);
};

// valuewhen 实现
function valuewhen(condition, values, occurrence = 0) {
    const result = new Array(values.length).fill(null);
    
    for (let i = 0; i < values.length; i++) {
        let count = 0;
        let foundIndex = -1;
        
        // 从当前位置向前查找，不包括当前位置
        for (let j = i - 1; j >= 0; j--) {
            if (condition[j]) {
                if (count === occurrence) {
                    foundIndex = j;
                    break;
                }
                count++;
            }
        }
        
        if (foundIndex !== -1) {
            result[i] = values[foundIndex];
        }
    }
    
    return result;
}

// 分形检测
const detectFractal = (values, index) => {
    if (index < 2 || index >= values.length - 2) return 0;
    
    // 在Pine中[0]是最新值，[4]是最旧的值
    const v4 = values[index - 2];  // [4] 最旧值
    const v3 = values[index - 1];  // [3]
    const v2 = values[index];      // [2] 当前检测点
    const v1 = values[index + 1];  // [1]
    const v0 = values[index + 2];  // [0] 最新值
    
    // 顶分形: v4 < v2 and v3 < v2 and v2 > v1 and v2 > v0
    // 增加额外的条件来确保分形更显著
    if (v4 < v2 && v3 < v2 && v2 > v1 && v2 > v0 && 
        Math.abs(v2 - Math.min(v4, v3, v1, v0)) > Math.abs(v2) * 0.001) {
        return 1;
    }
    
    // 底分形: v4 > v2 and v3 > v2 and v2 < v1 and v2 < v0
    // 增加额外的条件来确保分形更显著
    if (v4 > v2 && v3 > v2 && v2 < v1 && v2 < v0 && 
        Math.abs(v2 - Math.max(v4, v3, v1, v0)) > Math.abs(v2) * 0.001) {
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
    
    // 计算两个MACD
    const macd1 = calculateMACD(closes, 12, 26); // MACD(12,26)
    const macd2 = calculateMACD(closes, 5, 15);  // MACD(5,15)
    
    // 计算MACD2的最大值范围
    const getHighest = (arr, period) => {
        const result = new Array(arr.length).fill(0);
        for (let i = 0; i < arr.length; i++) {
            let max = arr[i];
            for (let j = Math.max(0, i - period + 1); j <= i; j++) {
                max = Math.max(max, arr[j]);
            }
            result[i] = max;
        }
        return result;
    };
    
    const macd2Highest = getHighest(macd2, 100).map(v => v * 1.5);
    const nsc = macd2Highest;
    const nsv = macd2Highest.map(v => v * -1);
    
    // 计算中点和偏移量
    const midpoint = nsc.map((v, i) => (v + nsv[i]) / 2);
    const ploff = nsc.map((v, i) => (v - midpoint[i]) / 8);
    
    // 计算Atlas Mini指标
    const length = 20;
    const mult = 2.0;
    const basis = calculateSMA(closes, length);
    const dev = calculateStdev(closes, length).map(d => d * mult);
    const upper = basis.map((b, i) => b + dev[i]);
    const lower = basis.map((b, i) => b - dev[i]);
    const dbb = upper.map((u, i) => Math.sqrt((u - lower[i]) / u) * 20);
    const dbbmed = calculateEMA(dbb, 120);
    const factor = dbbmed.map(v => v * 4/5);
    const atl = dbb.map((v, i) => v - factor[i]);
    
    // 计算Choppiness Index
    const length1 = 14;
    const tr = calculateTR(highs, lows, closes);
    const sumTR = calculateSum(tr, length1);
    const lowestLow = calculateLowest(lows.map((l, i) => Math.min(l, closes[i-1] || l)), length1);
    const highestHigh = calculateHighest(highs.map((h, i) => Math.max(h, closes[i-1] || h)), length1);
    const height = highestHigh.map((h, i) => h - lowestLow[i]);
    const chop = height.map((h, i) => 100 * (Math.log10(sumTR[i] / h) / Math.log10(length1)));
    
    // 调试四个关键时间点
    console.log('\n===== 分析四个关键时间点 =====');
    const timePoints = [
        '2025-01-05T14:00:00',
        '2025-01-03T03:00:00',
        '2024-12-31T00:00:00',
        '2024-12-29T17:00:00'
    ];
    
    const targetIndices = timePoints.map(time => {
        console.log(`\n分析时间点: ${time}`);
        return debugTimePoint(klines, macd2, new Date(time));
    });
    
    // 创建分形条件数组
    const fractalTop = new Array(macd2.length).fill(false);
    const fractalBottom = new Array(macd2.length).fill(false);
    
    // 检测所有分形
    for (let i = 2; i < macd2.length - 2; i++) {
        const fractal = detectFractal(macd2, i);
        if (fractal === 1 && config.div_reg_ba) fractalTop[i] = true;
        if (fractal === -1 && config.div_reg_al) fractalBottom[i] = true;
        
        // 调试关键时间点附近的分形
        if (targetIndices.includes(i)) {
            console.log(`\n分形标记状态 - ${formatDate(klines[i].openTime)}:`);
            console.log('当前位置是否为顶分形:', fractal === 1);
            console.log('当前位置是否为底分形:', fractal === -1);
            console.log('MACD值:', macd2[i]);
            console.log('Low值:', lows[i]);
            console.log('High值:', highs[i]);
            // 打印额外的范围信息
            console.log('NSC值:', nsc[i]);
            console.log('NSV值:', nsv[i]);
            console.log('中点值:', midpoint[i]);
            console.log('偏移量:', ploff[i]);
            // 打印Atlas和Choppiness信息
            if (config.afa) {
                console.log('Atlas值:', atl[i]);
                console.log('Atlas区域:', atl[i] <= 0);
            }
            if (config.afc) {
                console.log('Choppiness值:', chop[i]);
                console.log('Choppiness区域:', chop[i] >= config.chopi);
            }
        }
    }
    
    const signals = [];
    
    // 检测背离
    for (let i = 2; i < macd2.length - 2; i++) {
        // 获取前一个分形的值
        const prevTopMacd = valuewhen(fractalTop, macd2, 0)[i];
        const prevTopPrice = valuewhen(fractalTop, highs, 0)[i];
        const prevBottomMacd = valuewhen(fractalBottom, macd2, 0)[i];
        const prevBottomPrice = valuewhen(fractalBottom, lows, 0)[i];
        
        // 调试关键时间点的背离检测
        if (targetIndices.includes(i)) {
            console.log(`\n背离检测状态 - ${formatDate(klines[i].openTime)}:`);
            console.log('前一个顶分形MACD:', prevTopMacd);
            console.log('前一个顶分形价格:', prevTopPrice);
            console.log('前一个底分形MACD:', prevBottomMacd);
            console.log('前一个底分形价格:', prevBottomPrice);
            console.log('当前是否为顶分形:', fractalTop[i]);
            console.log('当前是否为底分形:', fractalBottom[i]);
            if (fractalTop[i]) {
                console.log('看跌背离条件检查:');
                console.log('价格是否更高:', highs[i] > prevTopPrice);
                console.log('MACD是否更低:', macd2[i] < prevTopMacd);
                console.log('偏移后的位置:', macd2[i] + ploff[i] * 0.5);
            }
            if (fractalBottom[i]) {
                console.log('看涨背离条件检查:');
                console.log('价格是否更低:', lows[i] < prevBottomPrice);
                console.log('MACD是否更高:', macd2[i] > prevBottomMacd);
                console.log('偏移后的位置:', macd2[i] - ploff[i] * 0.5);
                console.log('当前MACD:', macd2[i]);
                console.log('前一个底分形MACD:', prevBottomMacd);
                console.log('MACD差值:', macd2[i] - prevBottomMacd);
                // 检查MACD趋势
                if (i >= 1) {
                    console.log('MACD趋势:', macd2[i] > macd2[i-1] ? '上升' : '下降');
                    console.log('MACD[2]:', macd2[i]);
                    console.log('low_prev1:', prevBottomMacd);
                }
            }
        }
        
        // 看跌背离 - 严格按照Pine的plotshape
        if (fractalTop[i] && prevTopMacd !== null && config.div_reg_ba && config.etiquetas) {
            const regular_bearish_div1 = fractalTop[i] && highs[i] > prevTopPrice && macd2[i] < prevTopMacd;
            if (regular_bearish_div1 && i > 0) {  // 确保有[1]的值
                signals.push({
                    time: klines[i-2].openTime,  // offset=-2
                    type: '🐻 R',
                    macdValue: macd2[i],
                    price: highs[i],
                    plotPosition: macd2[i-1] + ploff[i] * 0.5  // 使用macd_2[1]
                });
            }
        }
        
        // 看涨背离 - 严格按照Pine的plotshape
        if (fractalBottom[i] && prevBottomMacd !== null && config.div_reg_al && config.etiquetas) {
            const regular_bullish_div1 = fractalBottom[i] && lows[i] < prevBottomPrice && macd2[i] > prevBottomMacd;
            if (regular_bullish_div1 && i > 0) {  // 确保有[1]的值
                signals.push({
                    time: klines[i-2].openTime,  // offset=-2
                    type: '🐂 R',
                    macdValue: macd2[i],
                    price: lows[i],
                    plotPosition: macd2[i-1] - ploff[i] * 0.5  // 使用macd_2[1]
                });
            }
        }
    }
    
    // 按时间降序排序
    signals.sort((a, b) => b.time - a.time);
    return signals.map(signal => {
        console.log('信号详情:', {
            time: formatDate(signal.time),
            type: signal.type,
            macdValue: signal.macdValue,
            price: signal.price
        });
        return `${formatDate(signal.time)} ${signal.type}`;
    }).join('\n');
};

// 处理数据并输出信号
console.log('开始处理K线数据...');
console.log('K线数量:', klines.length);
const result = detectSignals(klines);
console.log('\n最终信号结果:');
console.log(result);
