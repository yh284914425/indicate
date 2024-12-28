
import { CryptoService } from '../src/services/cryptoService.ts'
const cryptoService = new CryptoService()

const fetchData = async () => {
    const selectedSymbol = 'BTCUSDT'
    const selectedInterval = '15m'
    const selectedLimit = 200
    let signals = []
    try {
        const klines = await cryptoService.getExtendedKlines(
            selectedSymbol,
            selectedInterval,
            selectedLimit
        );

        const { topDivergence, bottomDivergence, j } = cryptoService.calculateIndicators(klines);

        const newSignals = [];
        for (let i = 0; i < klines.length; i++) {
            if (topDivergence[i] || bottomDivergence[i]) {
                newSignals.push({
                    time: new Date(klines[i].openTime).toLocaleString(),
                    type: topDivergence[i] ? '顶背离' : '底背离',
                    price: parseFloat(klines[i].close).toFixed(2),
                    j: j[i].toFixed(2)
                });
            }
        }

        signals = newSignals.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

        if (newSignals.length === 0) {
            console.log('当前时间范围内未发现背离信号');
        } else {
            console.log(`发现 ${newSignals.length} 个背离信号`);
        }
    } catch (error) {
        console.error('Error:', error);
        console.error(error instanceof Error ? error.message : '获取数据失败');
    } finally {
    }
};

fetchData()