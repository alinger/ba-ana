// 获取币安BTC历史数据（1小时K线）
const interval_timstamps = {
	'3m': 3 * 60 * 1000,
	'5m': 5 * 60 * 1000,
	'15m': 15 * 60 * 1000,
	'30m': 30 * 60 * 1000,
	'1h': 60 * 60 * 1000,
}
let interval, side, totalCalcData;

function init() {

	$("#confirmBtn").on("click", function() {
		interval = $("#interval_select").val();
		side = $("#side_select").val();
		console.log(interval, side);
		initData();
		analyzeConsecutiveDropsWithRebound().catch(console.error);
	})
}

async function fetchHistoricalData() {
	const limit = 5000;
	const symbol = 'BTCUSDT';
	// const interval = '1h';
	const endTime = Date.now();

	// 计算5000小时前的精确时间戳
	let startTime = endTime - (limit * interval_timstamps[interval]);

	const data = [];
	let currentEnd = startTime + 1000 * interval_timstamps[interval];

	while (data.length < limit) {
		const url = new URL('https://api.binance.com/api/v3/klines');
		url.searchParams.set('symbol', symbol);
		url.searchParams.set('interval', interval);
		url.searchParams.set('startTime', startTime);
		url.searchParams.set('endTime', currentEnd);
		url.searchParams.set('limit', 1000);

		const response = await fetch(url);
		const klines = await response.json();

		// 关键修复：将数据块反转并转换为正序
		const orderedChunk = klines
			.map(k => ({
				timestamp: new Date(k[0]), // 使用开盘时间作为时间戳
				high: parseFloat(k[2]),
				close: parseFloat(k[4])
			}));

		data.push(...orderedChunk); // 插入到数组前端

		// 更新下次请求的结束时间（当前数据块最早时间 - 1小时）
		if (klines.length > 0) {
			startTime = currentEnd;
			currentEnd = startTime + 1000 * interval_timstamps[interval];
		}

		// 防止无限循环
		if (klines.length < 1000) break;
	}
	console.log(data)
	// 在fetchHistoricalData函数末尾添加校验
	for (let i = 1; i < data.length; i++) {
		if (data[i].timestamp <= data[i - 1].timestamp) {
			console.error('数据顺序异常:', i - 1,
				data[i - 1].timestamp.toISOString(),
				data[i].timestamp.toISOString());
			throw new Error('数据排序验证失败');
		}
	}

	// 精确截取并返回正序数据
	return data.slice(-limit);
}

// 改进后的时间区间打印（增加持续时间显示）
function printTimeRange(range) {
	const durationHours = ((range.end - range.start) / 3600000).toFixed(1);
	console.log(`开始时间: ${range.start.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`);
	console.log(`结束时间: ${range.end.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`);
	console.log(`持续时长: ${durationHours} 小时`);
	console.log('-----------------------------------');
}

function initData() {
	totalCalcData = {
		time_5: {
			times: 5,
			occurrenceCount: 0,
			occurrenceTimestamps: [],
		},
		time_6: {
			times: 6,
			occurrenceCount: 0,
			occurrenceTimestamps: [],
		},
		time_7: {
			times: 7,
			occurrenceCount: 0,
			occurrenceTimestamps: [],
		},
		time_8: {
			times: 8,
			occurrenceCount: 0,
			occurrenceTimestamps: [],
		},
		time_9: {
			times: 9,
			occurrenceCount: 0,
			occurrenceTimestamps: [],
		}
	}
}




async function analyzeConsecutiveDropsWithRebound() {
	const historicalData = await fetchHistoricalData();
	let consecutiveDrops = 0;

	// 遍历到倒数第8个数据点（预留检查第8根的空间）
	for (let i = 1; i < historicalData.length - 1; i++) {
		if (side == "down") {
			if (historicalData[i].close < historicalData[i - 1].close) {
				consecutiveDrops++;
				const nextIndex = i + 1;
				for (let key in totalCalcData) {
					let item = totalCalcData[key];
					let times = item.times;
					if (consecutiveDrops === times && historicalData[nextIndex].close > historicalData[nextIndex -
							1]
						.close) {
						pushOccurrenceData(historicalData, i, times);
						consecutiveDrops = 0
					}
				}
			} else {
				consecutiveDrops = 0; // 重置计数器
			}
		} else if (side == "up") {
			if (historicalData[i].close > historicalData[i - 1].close) {
				consecutiveDrops++;
				const nextIndex = i + 1;
				for (let key in totalCalcData) {
					let item = totalCalcData[key];
					let times = item.times;
					if (consecutiveDrops === times && historicalData[nextIndex].close < historicalData[nextIndex -
							1].close) {
						pushOccurrenceData(historicalData, i, times);
						consecutiveDrops = 0
					}
				}
			} else {
				consecutiveDrops = 0; // 重置计数器
			}
		}

	}

	// 统计结果
	console.log(`总分析小时数: ${historicalData.length}`);
	let container = $("#tableList");
	container.html("")
	for (let key in totalCalcData) {
		let item = totalCalcData[key];
		let name = `${item.times}${side == "up" ? "连涨": "连跌"}`
		let occurrenceCount = item.occurrenceCount;
		let occurrenceTimestamps = item.occurrenceTimestamps;
		let probability = (occurrenceCount / (historicalData.length - (item.times + 1))) * 100;

		console.log(`${name}结果---------------------------------------------------start`);
		console.log(`${name}后反弹次数: ${occurrenceCount}`);
		console.log(`形态出现概率: ${probability.toFixed(2)}%`);
		console.log('\n具体时间节点:');

		occurrenceTimestamps.forEach((range, index) => {
			console.log(`第${index + 1}次形态:`);
			console.log(`▶ ${name}区间:`);
			console.log(`  开始: ${range.start.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`);
			console.log(`  结束: ${range.dropEnd.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`);
			console.log(
				`▶ 反弹时刻: ${range.reboundTime.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`);
			console.log(`  反弹幅度: +${range.reboundPercentage}%`);
			console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

			let temp = $("#emaTemp").html();
			temp = temp
				.replace("{{name}}", name)
				.replace("{{index}}", index + 1)
				.replace("{{startTime}}", range.start.toLocaleString('zh-CN', {
					timeZone: 'Asia/Shanghai'
				}))
				.replace("{{endTime}}", range.dropEnd.toLocaleString('zh-CN', {
					timeZone: 'Asia/Shanghai'
				}))
				.replace("{{reboundTime}}", range.reboundTime.toLocaleString('zh-CN', {
					timeZone: 'Asia/Shanghai'
				}))
				.replace("{{reboundPercentage}}", range.reboundPercentage + "%")
				.replace("{{high_price_4}}", range.high_price_4)
				.replace("{{occurrenceCount}}", occurrenceCount)
			container.append(temp);
		});
		console.log(`${name}结果---------------------------------------------------end`);
	}
}


function pushOccurrenceData(historicalData, curIndex, number) {

	const startIndex = curIndex - (number - 1); // 7连跌起始点
	const nextIndex = curIndex + 1;
	let highPrice = historicalData[nextIndex].high;
	for (i = nextIndex; i < nextIndex + 3; i++) {
		if (historicalData[i].high > highPrice) {
			highPrice = historicalData[i].high;
		}
	}
	totalCalcData[`time_${number}`].occurrenceTimestamps.push({
		start: historicalData[startIndex].timestamp,
		dropEnd: historicalData[curIndex].timestamp,
		reboundTime: historicalData[nextIndex].timestamp,
		high_price_4: highPrice,
		reboundPercentage: `${((highPrice - historicalData[nextIndex - 1].close) /
			historicalData[nextIndex - 1].close * 100).toFixed(2)}`,
		// rebound4Percentage: historicalData[nextIndex + 3] ? ((historicalData[nextIndex + 3].close -
		// 		historicalData[nextIndex - 1].close) /
		// 	historicalData[nextIndex - 1].close * 100).toFixed(2) : '--',
	});
	totalCalcData[`time_${number}`].occurrenceCount++;
}

$(function() {
	init();
	// analyzeConsecutiveDropsWithRebound().catch(console.error);
})