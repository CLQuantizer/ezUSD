<script lang="ts">
	// @ts-ignore - d3 types are installed but TypeScript may not resolve them correctly
	import * as d3 from 'd3';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';

	let chartContainer: HTMLDivElement;
	let svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
	
	interface CandlestickData {
		date: Date;
		open: number;
		high: number;
		low: number;
		close: number;
	}

	function generatePriceData(): CandlestickData[] {
		const data: CandlestickData[] = [];
		const basePrice = 1.0;
		let currentPrice = basePrice;
		const today = new Date();
		
		for (let i = 199; i >= 0; i--) {
			const date = new Date(today);
			date.setDate(date.getDate() - i);
			
			// Random walk with mean reversion to $1
			const volatility = 0.0005; // 0.05% volatility - very stable
			const meanReversion = 0.2; // Strong pull back to $1
			const randomChange = (Math.random() - 0.5) * volatility * 2;
			const reversion = (basePrice - currentPrice) * meanReversion;
			currentPrice += randomChange + reversion;
			
			// Generate OHLC for the day
			const dailyVolatility = 0.0003; // 0.03% intraday volatility - very tight
			const open = currentPrice;
			const high = open + Math.random() * dailyVolatility;
			const low = open - Math.random() * dailyVolatility;
			const close = open + (Math.random() - 0.5) * dailyVolatility * 2;
			
			// Ensure high is highest and low is lowest
			const actualHigh = Math.max(open, high, close);
			const actualLow = Math.min(open, low, close);
			
			data.push({
				date,
				open,
				high: actualHigh,
				low: actualLow,
				close
			});
			
			currentPrice = close;
		}
		
		return data;
	}

	function renderChart() {
		if (!browser || !chartContainer) return;
		
		const data = generatePriceData();
		const margin = { top: 20, right: 20, bottom: 40, left: 50 };
		const width = chartContainer.clientWidth - margin.left - margin.right;
		const height = 300 - margin.top - margin.bottom;
		
		// Clear previous chart
		d3.select(chartContainer).selectAll('*').remove();
		
		svg = d3.select(chartContainer)
			.append('svg')
			.attr('width', width + margin.left + margin.right)
			.attr('height', height + margin.top + margin.bottom);
		
		const g = svg.append('g')
			.attr('transform', `translate(${margin.left},${margin.top})`);
		
		// Scales
		const xScale = d3.scaleTime()
			.domain(d3.extent(data, (d: CandlestickData) => d.date) as [Date, Date])
			.range([0, width]);
		
		// Fixed domain to make candlesticks look flat and stable
		const yScale = d3.scaleLinear()
			.domain([0.990, 1.010])
			.range([height, 0]);
		
		// Draw $1 reference line
		g.append('line')
			.attr('x1', 0)
			.attr('x2', width)
			.attr('y1', yScale(1.0))
			.attr('y2', yScale(1.0))
			.attr('stroke', '#9CA3AF')
			.attr('stroke-width', 1)
			.attr('stroke-dasharray', '5,5')
			.attr('opacity', 0.5);
		
		g.append('text')
			.attr('x', 5)
			.attr('y', yScale(1.0) - 5)
			.attr('fill', '#9CA3AF')
			.attr('font-size', '12px')
			.text('$1.00');
		
		// Draw candlesticks
		const candleWidth = Math.max(1, width / data.length * 0.6);
		
		data.forEach((d, i) => {
			const isUp = d.close >= d.open;
			const color = isUp ? '#10B981' : '#EF4444'; // green for up, red for down
			
			const x = xScale(d.date);
			const highY = yScale(d.high);
			const lowY = yScale(d.low);
			const openY = yScale(d.open);
			const closeY = yScale(d.close);
			
			// Wick (high-low line)
			g.append('line')
				.attr('x1', x)
				.attr('x2', x)
				.attr('y1', highY)
				.attr('y2', lowY)
				.attr('stroke', color)
				.attr('stroke-width', 1);
			
			// Body (open-close rectangle)
			const bodyTop = Math.min(openY, closeY);
			const bodyBottom = Math.max(openY, closeY);
			const bodyHeight = Math.max(1, bodyBottom - bodyTop);
			
			g.append('rect')
				.attr('x', x - candleWidth / 2)
				.attr('y', bodyTop)
				.attr('width', candleWidth)
				.attr('height', bodyHeight)
				.attr('fill', color)
				.attr('stroke', color);
		});
		
		// Axes
		const xAxis = d3.axisBottom(xScale)
			.ticks(5)
			.tickFormat((d: Date | d3.NumberValue) => {
				if (d instanceof Date) {
					return d3.timeFormat('%b %d')(d);
				}
				return '';
			});
		
		const yAxis = d3.axisLeft(yScale)
			.ticks(5)
			.tickFormat((d: d3.NumberValue) => `$${Number(d).toFixed(3)}`);
		
		g.append('g')
			.attr('transform', `translate(0,${height})`)
			.call(xAxis)
			.selectAll('text')
			.style('font-size', '11px')
			.style('fill', '#6B7280');
		
		g.append('g')
			.call(yAxis)
			.selectAll('text')
			.style('font-size', '11px')
			.style('fill', '#6B7280');
		
		// Axis lines
		g.append('line')
			.attr('x1', 0)
			.attr('x2', width)
			.attr('y1', height)
			.attr('y2', height)
			.attr('stroke', '#E5E7EB')
			.attr('stroke-width', 1);
		
		g.append('line')
			.attr('x1', 0)
			.attr('x2', 0)
			.attr('y1', 0)
			.attr('y2', height)
			.attr('stroke', '#E5E7EB')
			.attr('stroke-width', 1);
	}

	onMount(() => {
		if (browser) {
			renderChart();
			window.addEventListener('resize', renderChart);
		}
		
		return () => {
			if (browser) {
				window.removeEventListener('resize', renderChart);
			}
		};
	});
</script>

<div class="w-full">
	<h3 class="text-xl font-bold text-gray-800 mb-2 text-center">📈💎 Super Stable Peg Price 💎📈</h3>
	<p class="text-sm text-purple-600 font-semibold mb-3 text-center">Loop and Never Get Liquidated 🔄💀</p>
	<div bind:this={chartContainer} class="w-full"></div>
	<p class="text-xs text-gray-500 text-center mt-2 italic">Simulated data. Not financial advice. It's a meme. 💀</p>
</div>

