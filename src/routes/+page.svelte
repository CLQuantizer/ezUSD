<script lang="ts">
	import Convert from '$lib/Convert.svelte';
	import CandlestickChart from '$lib/CandlestickChart.svelte';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';

	let account = $state<string | null>(null);
	let usdtBalance = $state<string>('0');
	let ezusdBalance = $state<string>('0');
	let isLoadingBalances = $state(false);

	async function checkWalletConnection() {
		if (!browser || !window.ethereum) return;

		try {
			const accounts = await window.ethereum.request({ method: 'eth_accounts' }) as string[];
			if (accounts && accounts.length > 0) {
				account = accounts[0];
				await fetchBalances();
			}
		} catch (err) {
			console.error('Error checking wallet connection:', err);
		}
	}

	async function fetchBalances() {
		if (!account) {
			usdtBalance = '0';
			ezusdBalance = '0';
			return;
		}

		try {
			isLoadingBalances = true;
			const response = await fetch(`/api/balance?address=${account}`);
			const data = await response.json();
			
			if (data.error) {
				console.error('Error fetching balances:', data.error);
				return;
			}

			if (data.usdt && data.ezusd) {
				usdtBalance = parseFloat(data.usdt.formatted).toFixed(6);
				ezusdBalance = parseFloat(data.ezusd.formatted).toFixed(6);
			}
		} catch (err) {
			console.error('Error fetching balances:', err);
		} finally {
			isLoadingBalances = false;
		}
	}

	// Listen for account changes
	function setupWalletListeners() {
		if (!browser || !window.ethereum) return;

		window.ethereum.on('accountsChanged', (accounts: string[]) => {
			if (accounts && accounts.length > 0) {
				account = accounts[0];
				fetchBalances();
			} else {
				account = null;
				usdtBalance = '0';
				ezusdBalance = '0';
			}
		});

		// Listen for chain changes to refresh balances
		window.ethereum.on('chainChanged', () => {
			if (account) {
				fetchBalances();
			}
		});

		// Also listen for connect event
		window.ethereum.on('connect', () => {
			checkWalletConnection();
		});
	}

	onMount(() => {
		checkWalletConnection();
		setupWalletListeners();
	});
</script>

<svelte:head>
	<title>ezUSD - The Meme Stablecoin</title>
</svelte:head>

<div class="bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-800 min-h-screen flex items-center justify-center p-5 relative">
	<!-- Balance Display (Top Right - Sticky) -->
	{#if account}
		<div class="fixed top-5 right-5 bg-white/90 backdrop-blur-sm rounded-xl p-3 sm:p-4 shadow-lg border-2 border-purple-300 z-50 max-w-[200px] sm:max-w-none">
			<div class="flex items-center justify-between mb-2">
				<div class="text-xs text-gray-600 font-semibold">💸 Your Bags</div>
				<button
					onclick={fetchBalances}
					disabled={isLoadingBalances}
					class="text-purple-600 hover:text-purple-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
					title="Refresh balances"
				>
					<svg class="w-4 h-4 {isLoadingBalances ? 'animate-spin' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
					</svg>
				</button>
			</div>
			<div class="space-y-1 text-xs sm:text-sm">
				<div class="flex items-center justify-between gap-2 sm:gap-4">
					<span class="text-gray-700 font-medium">USDT:</span>
					<span class="text-green-600 font-bold font-mono text-xs sm:text-sm">
						{isLoadingBalances ? '...' : usdtBalance}
					</span>
				</div>
				<div class="flex items-center justify-between gap-2 sm:gap-4">
					<span class="text-gray-700 font-medium">ezUSD:</span>
					<span class="text-purple-600 font-bold font-mono text-xs sm:text-sm">
						{isLoadingBalances ? '...' : ezusdBalance}
					</span>
				</div>
			</div>
		</div>
	{/if}

	<div class="bg-white rounded-3xl p-10 max-w-2xl w-full shadow-2xl">
		<!-- Logo -->
		<div class="w-48 h-48 mx-auto mb-8 rounded-full overflow-hidden border-4 border-purple-500 shadow-xl">
			<img src="/ezusd.png" alt="ezUSD Logo" class="w-full h-full object-cover" />
		</div>
		
		<!-- Header -->
		<h1 class="text-5xl font-black text-gray-800 mb-2 text-center">ezUSD</h1>
		<p class="text-2xl text-purple-600 font-bold mb-4 text-center">The Meme Stablecoin 🚀</p>
		
		<!-- APR Display -->
		<div class="mb-8 text-center">
			<div class="inline-block bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 text-white px-6 py-3 rounded-full shadow-lg border-4 border-yellow-300 animate-pulse">
				<div class="text-xs sm:text-sm font-bold uppercase tracking-wider mb-1">🔥 CRAZY APR 🔥</div>
				<div class="text-3xl sm:text-4xl font-black">38.8%</div>
			</div>
		</div>
		
		<!-- Candlestick Chart -->
		<div class="mb-8 bg-gray-50 rounded-xl p-6 border border-gray-200">
			<CandlestickChart />
		</div>
		
		<!-- Features -->
		<div class="bg-gray-50 rounded-xl p-6 mb-8">
			<h2 class="text-2xl font-bold text-gray-800 mb-4 text-center">Why ezUSD? 🤔</h2>
			<ul class="space-y-3">
				<li class="flex items-center text-gray-700">
					<span class="text-purple-600 text-xl mr-3">💀</span>
					It's an ERC-20 token (wow, revolutionary)
				</li>
				<li class="flex items-center text-gray-700">
					<span class="text-purple-600 text-xl mr-3">💀</span>
					You can use it as collateral on Morpho (don't)
				</li>
				<li class="flex items-center text-gray-700">
					<span class="text-purple-600 text-xl mr-3">💀</span>
					It's a meme coin (this is not financial advice)
				</li>
			</ul>
		</div>
		
		<!-- Convert Component -->
		<div class="mb-8">
			<Convert />
		</div>
		
		<!-- Scam Education Section -->
		<div class="bg-red-50 border-2 border-red-300 rounded-xl p-6 mb-8">
			<div class="flex items-start mb-4">
				<span class="text-3xl mr-3">🚨</span>
				<h2 class="text-2xl font-bold text-red-800">"Use ezUSD as Collateral on Morpho to Borrow USDT!"</h2>
			</div>
			<div class="bg-white rounded-lg p-4 mb-4 border-l-4 border-yellow-400">
				<p class="text-gray-700 text-sm mb-2 italic">"This is what every shit stablecoin project says..."</p>
				<p class="font-bold text-red-600">⚠️ WAKE UP CALL ⚠️</p>
			</div>
			<div class="space-y-3 text-gray-700">
				<p class="font-semibold text-red-700">Why this is peak degen behavior (and not in a good way):</p>
				<ul class="space-y-2 text-sm">
					<li class="flex items-start">
						<span class="text-red-500 mr-2">💀</span>
						<span><strong>Circular Logic:</strong> You deposit their worthless token to borrow real USDT. Token crashes (it will), you get liquidated. They win, you lose. Simple math.</span>
					</li>
					<li class="flex items-start">
						<span class="text-red-500 mr-2">💀</span>
						<span><strong>False Legitimacy:</strong> Being on Morpho doesn't mean shit. It just means someone added it. That's it. No validation. No nothing.</span>
					</li>
					<li class="flex items-start">
						<span class="text-red-500 mr-2">💀</span>
						<span><strong>Liquidation Trap:</strong> Low liquidity + high volatility = you're getting rekt faster than you can say "but the roadmap said..."</span>
					</li>
					<li class="flex items-start">
						<span class="text-red-500 mr-2">💀</span>
						<span><strong>Exit Strategy:</strong> They dump, price goes to zero, your collateral is worthless, protocol liquidates you. GG no re.</span>
					</li>
				</ul>
			</div>
			<div class="mt-4 p-3 bg-yellow-100 rounded-lg border border-yellow-300">
				<p class="text-sm text-yellow-800 font-semibold">
					💡 <strong>Real Talk:</strong> If a project brags about being "usable as collateral" without liquidity, stability, or utility... that's your red flag. 🚩 Don't be that degen.
				</p>
			</div>
			<div class="mt-4 text-center">
				<p class="text-gray-600 text-xs italic">
					Yes, ezUSD is technically usable as collateral on Morpho to borrow USDT. 
					<br class="sm:hidden" />
					<span class="font-bold text-red-600">No, you probably shouldn't do that.</span>
					<br />
					This is a meme coin. Treat it like one. 🎭
				</p>
			</div>
		</div>
		
		<!-- CTA -->
		<div class="text-center">
			<a href="https://app.morpho.org/ethereum/market/0x44e1d6d8c57a522dafc54b6466a4a9377eb1413d68e79cf162abdf15d5f2c36c/ezusd-usdt" class="inline-block bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-8 py-4 rounded-full font-bold text-lg shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
				💀 Borrow against ezUSD (don't) 💀
			</a>
		</div>
		
		<!-- Contract Addresses -->
		<div class="mt-8 bg-gray-50 rounded-xl p-6 border border-gray-200">
			<h3 class="text-lg font-bold text-gray-800 mb-4 text-center">Contract Addresses (For Your Due Diligence)</h3>
			<div class="space-y-3 text-sm">
				<div>
					<p class="font-semibold text-gray-700 mb-1">Proof of reserve nothing(PORN):</p>
					<p class="font-mono text-gray-600 break-all">0x1bd96ecb129d29ac2f69d0746c2386b9ba73d5ce</p>
				</div>
				<div>
					<p class="font-semibold text-gray-700 mb-1">ezUSD Contract:</p>
					<p class="font-mono text-gray-600 break-all">0x77b80f4ac4c6cbb4982689749177349cf1635115</p>
				</div>
				<div>
					<p class="font-semibold text-gray-700 mb-1">Oracle Contract:</p>
					<p class="font-mono text-gray-600 break-all">0x9bca11a6f98e2ad31781cacb4483a1642fd85ddf</p>
				</div>
				<div>
					<p class="font-semibold text-gray-700 mb-1">IRM Contract:</p>
					<p class="font-mono text-gray-600 break-all">0x870aC11D48B15DB9a138Cf899d20F13F79Ba00BC</p>
				</div>
				<div>
					<p class="font-semibold text-gray-700 mb-1">Morpho Market ID:</p>
					<p class="font-mono text-gray-600 break-all">0x44e1d6d8c57a522dafc54b6466a4a9377eb1413d68e79cf162abdf15d5f2c36c</p>
				</div>
			</div>
		</div>
		
		<!-- Footer -->
		<div class="mt-8 text-center text-gray-500 text-sm">
			<p>© 2025 ezUSD. DYOR. NFA. This is not financial advice. It's a meme. Don't be a degen. 💀</p>
		</div>
	</div>
</div>
