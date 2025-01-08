// 导入原始的 klines 数据
const klines = require('./test.js').klines;

/**
 * 模拟 Pine Script 的 valuewhen 函数
 */
function valuewhen(condition, klines, sourceType = "close", occurrence = 0) {
    const result = new Array(klines.length).fill(null);
    
    for (let i = 0; i < klines.length; i++) {
        let count = 0;
        let foundIndex = -1;
        
        // 从当前位置向后查找
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
            result[i] = parseFloat(klines[foundIndex][sourceType]);
        }
    }
    
    return result;
}

/**
 * 创建高点突破条件
 */
function createHigherHighCondition(klines) {
    const highs = klines.map(k => parseFloat(k.high));
    
    return klines.map((_, i) => {
        if (i < 2) return false;
        return highs[i] > highs[i-1] && highs[i-1] > highs[i-2];
    });
}

// 主要逻辑
function main() {
    // 生成条件数组
    const conditions = createHigherHighCondition(klines);
    
    // 获取 valuewhen 的结果
    const value0Array = valuewhen(conditions, klines, "high", 0);  // 最近一次条件为真时的high值
    const value1Array = valuewhen(conditions, klines, "high", 1);  // 倒数第二次条件为真时的high值
    
    // 找出所有条件为真的点
    const trueIndices = conditions.reduce((acc, curr, idx) => {
        if (curr) acc.push(idx);
        return acc;
    }, []);
    
    // 分析最近5次高点突破
    console.log("\n最近5次高点突破的分析:");
    trueIndices.slice(-5).reverse().forEach((idx, i) => {
        const date = new Date(klines[idx].openTime);
        const localTime = date.toLocaleString('zh-CN', { 
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
            timeZone: 'Asia/Shanghai'
        });
        
        const currentHigh = parseFloat(klines[idx].high);
        const value0 = value0Array[idx];
        const value1 = value1Array[idx];
        
        console.log(`\n时间: ${localTime}`);
        console.log(`当前K线的high值: ${currentHigh}`);
        console.log(`上一次突破时的high值: ${value1}`);
        
        // 计算与上一次高点的涨跌幅
        if (value1) {
            const pctChange = ((currentHigh - value1) / value1 * 100).toFixed(2);
            console.log(`与上一次高点相比涨跌: ${pctChange}%`);
            
            // 分析趋势
            if (currentHigh > value1) {
                console.log("趋势分析: 上升趋势增强 ⬆️");
            } else {
                console.log("趋势分析: 上升趋势可能减弱 ⚠️");
            }
        }
        
        // 如果不是最后一个点，计算到下一个点的变化
        if (i < 4) {
            const nextIdx = trueIndices.slice(-5).reverse()[i + 1];
            const nextHigh = parseFloat(klines[nextIdx].high);
            const changeToNext = ((nextHigh - currentHigh) / currentHigh * 100).toFixed(2);
            console.log(`到下一个高点的变化: ${changeToNext}%`);
        }
    });
}

// 运行分析
main();