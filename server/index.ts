import { CryptoService } from '../src/services/cryptoService.ts'
import axios from 'axios'
import * as WebSocket from 'ws'

console.log('启动多周期分析服务...')

// 定义信号类型
interface Signal {
    symbol: string
    period: string
    time: string
    type: 'top' | 'bottom'
    price: string
    j: string
}

// 配置
const config = {
    symbols: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'DOGEUSDT', 'PEPEUSDT', 'ACTUSDT'], // 主要币种
    periods: ['15m', '30m', '1h', '2h', '4h', '6h', '12h', '1d'], // 分析周期
    days: 166, // 分析天数
    telegram: {
        botToken: '7945195631:AAFxMEQNMLSId-hPVseSKMwk2uL3vCqjMCw',
        chatId: '1797193692'
    }
}

const cryptoService = new CryptoService()
const sentSignals = new Set<string>() // 用于记录已发送的信号

// Telegram消息发送函数
async function sendTelegramMessage(message: string) {
    try {
        const url = `https://api.telegram.org/bot${config.telegram.botToken}/sendMessage`
        await axios.post(url, {
            chat_id: config.telegram.chatId,
            text: message,
            parse_mode: 'HTML'
        })
    } catch (error) {
        console.error('Telegram消息发送失败:', error)
    }
}

// 分析单个周期的数据
async function analyzePeriod(symbol: string, interval: string, limit: number): Promise<Signal[]> {
    try {
        const klines = await cryptoService.getExtendedKlines(symbol, interval, limit)
        const { topDivergence, bottomDivergence, j } = cryptoService.calculateIndicators(klines)

        const signals: Signal[] = []
        for (let i = 0; i < klines.length; i++) {
            if (topDivergence[i] || bottomDivergence[i]) {
                signals.push({
                    symbol,
                    period: interval,
                    time: new Date(klines[i].openTime).toLocaleString(),
                    type: topDivergence[i] ? 'top' : 'bottom',
                    price: parseFloat(klines[i].close).toFixed(2),
                    j: j[i].toFixed(2)
                })
            }
        }
        return signals
    } catch (error) {
        console.error(`分析${symbol} ${interval}失败:`, error)
        return []
    }
}

// 检查新信号并发送通知
async function checkNewSignalsAndNotify(signals: Signal[]) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // 筛选今天的新信号
    const newSignals = signals.filter(signal => {
        const signalTime = new Date(signal.time)
        const signalId = `${signal.symbol}-${signal.period}-${signal.type}-${signal.time}-${signal.price}`

        const isNewSignal = signalTime >= today && !sentSignals.has(signalId)
        if (isNewSignal) {
            sentSignals.add(signalId)
        }
        return isNewSignal
    })

    // 发送新信号通知
    for (const signal of newSignals) {
        const divergenceType = signal.type === 'top' ? '🔴顶背离' : '🟢底背离'
        const message = `
${divergenceType}信号提醒

📊 交易对: ${signal.symbol}
⏱ 周期: ${signal.period}
💰 当前价格: ${signal.price}
🕒 信号时间: ${signal.time}

请注意风险，及时处理！
`
        await sendTelegramMessage(message)
    }
}

// 初始化WebSocket连接
function initWebSocket(symbols: string[]) {
    const streams: string[] = []
    for (const symbol of symbols) {
        for (const period of config.periods) {
            streams.push(`${symbol.toLowerCase()}@kline_${period}`)
        }
    }

    const wsUrl = `wss://stream.binance.com:9443/stream?streams=${streams.join('/')}`

    try {
        const ws = new WebSocket.WebSocket(wsUrl, {
            perMessageDeflate: false
        })

        ws.on('open', () => {
            console.log('WebSocket连接已建立')
        })

        ws.on('message', async (data: any) => {
            try {
                const message = JSON.parse(data.toString())
                const { stream, data: wsData } = message

                // 只在K线收盘时进行分析
                if (wsData.k.x) {
                    const [symbol] = stream.split('@')
                    const period = wsData.k.i
                    // console.log(`收到${symbol.toUpperCase()} ${period}周期的新K线数据`)

                    // 分析新数据
                    const signals = await analyzePeriod(
                        symbol.toUpperCase(),
                        period,
                        config.days
                    )

                    if (signals.length > 0) {
                        console.log(`发现${signals.length}个新信号`)
                        await checkNewSignalsAndNotify(signals)
                    }
                }
            } catch (error) {
                console.error('处理WebSocket消息时出错:', error)
            }
        })

        ws.on('close', () => {
            console.log('WebSocket连接已关闭，5秒后重新连接...')
            setTimeout(() => initWebSocket(symbols), 5000)
        })

        ws.on('error', (error) => {
            console.error('WebSocket错误:', error)
        })

        // 添加心跳检测
        const pingInterval = setInterval(() => {
            if (ws.readyState === ws.OPEN) {
                ws.ping()
            }
        }, 30000)

        ws.on('close', () => {
            clearInterval(pingInterval)
        })

        return ws
    } catch (error) {
        console.error('创建WebSocket实例时出错:', error)
        throw error
    }
}

// 主函数
async function main() {
    console.log('开始初始化分析...')

    // 初始分析所有周期
    for (const symbol of config.symbols) {
        for (const period of config.periods) {
            const signals = await analyzePeriod(
                symbol,
                period,
                config.days
            )

            if (signals.length > 0) {
                // console.log(`${symbol} ${period}发现${signals.length}个信号`)
            }
        }
    }

    console.log('历史数据分析完成，启动实时监控...')
    initWebSocket(config.symbols)
}

// 启动程序
main().catch(error => {
    console.error('程序执行出错:', error)
})