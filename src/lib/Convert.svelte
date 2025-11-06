<script lang="ts">
	import { ethers } from 'ethers';
	import { browser } from '$app/environment';

	// Contract addresses
	const CONVERT_CONTRACT = '0x1bd96ecb129d29ac2f69d0746c2386b9ba73d5ce';
	
	// Minimal ABIs
	const CONVERT_ABI = [
		'function deposit(uint256 amount) external',
		'function redeem(uint256 amount) external',
		'function getUSDTBalance() external view returns (uint256)',
		'function getEzUSDBalance() external view returns (uint256)',
		'function usdt() external view returns (address)',
		'function ezusd() external view returns (address)'
	];

	const ERC20_ABI = [
		'function approve(address spender, uint256 amount) external returns (bool)',
		'function allowance(address owner, address spender) external view returns (uint256)',
		'function balanceOf(address account) external view returns (uint256)',
		'function decimals() external view returns (uint8)'
	];

	let provider: ethers.BrowserProvider | null = $state(null);
	let signer: ethers.JsonRpcSigner | null = $state(null);
	let account: string | null = $state(null);
	let isConnecting = $state(false);
	let isDepositing = $state(false);
	let isRedeeming = $state(false);
	let depositAmount = $state('');
	let redeemAmount = $state('');
	let usdtAddress = $state<string | null>(null);
	let ezusdAddress = $state<string | null>(null);
	let error = $state<string | null>(null);
	let success = $state<string | null>(null);

	async function connectWallet() {
		if (!browser || !window.ethereum) {
			error = 'Please install MetaMask or another Web3 wallet';
			return;
		}

		try {
			isConnecting = true;
			error = null;
			
			// Request account access
			await window.ethereum.request({ method: 'eth_requestAccounts' });
			
			provider = new ethers.BrowserProvider(window.ethereum);
			signer = await provider.getSigner();
			account = await signer.getAddress();
			
			// Get token addresses from contract
			const convertContract = new ethers.Contract(CONVERT_CONTRACT, CONVERT_ABI, provider);
			usdtAddress = await convertContract.usdt();
			ezusdAddress = await convertContract.ezusd();
		} catch (err: any) {
			error = err.message || 'Failed to connect wallet';
		} finally {
			isConnecting = false;
		}
	}

	async function checkApproval(tokenAddress: string, amount: bigint): Promise<boolean> {
		if (!signer || !account) return false;
		
		const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
		const allowance = await tokenContract.allowance(account, CONVERT_CONTRACT);
		return allowance >= amount;
	}

	async function approveToken(tokenAddress: string, amount: bigint) {
		if (!signer) return;
		
		const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
		const tx = await tokenContract.approve(CONVERT_CONTRACT, amount);
		await tx.wait();
	}

	async function deposit() {
		if (!signer || !usdtAddress) {
			error = 'Please connect your wallet first';
			return;
		}

		try {
			isDepositing = true;
			error = null;
			success = null;

			const amount = ethers.parseUnits(depositAmount, 6); // USDT has 6 decimals
			
			// Check and approve USDT if needed
			const isApproved = await checkApproval(usdtAddress, amount);
			if (!isApproved) {
				success = 'Approving USDT...';
				await approveToken(usdtAddress, amount);
			}

			// Deposit
			success = 'Depositing USDT...';
			const convertContract = new ethers.Contract(CONVERT_CONTRACT, CONVERT_ABI, signer);
			const tx = await convertContract.deposit(amount);
			success = 'Transaction submitted! Waiting for confirmation...';
			await tx.wait();
			
			success = `Successfully deposited ${depositAmount} USDT and received ${depositAmount} ezUSD!`;
			depositAmount = '';
		} catch (err: any) {
			error = err.message || 'Deposit failed';
			success = null;
		} finally {
			isDepositing = false;
		}
	}

	async function redeem() {
		if (!signer || !ezusdAddress) {
			error = 'Please connect your wallet first';
			return;
		}

		try {
			isRedeeming = true;
			error = null;
			success = null;

			const amount = ethers.parseUnits(redeemAmount, 6); // ezUSD has 6 decimals
			
			// Check and approve ezUSD if needed
			const isApproved = await checkApproval(ezusdAddress, amount);
			if (!isApproved) {
				success = 'Approving ezUSD...';
				await approveToken(ezusdAddress, amount);
			}

			// Redeem
			success = 'Redeeming ezUSD...';
			const convertContract = new ethers.Contract(CONVERT_CONTRACT, CONVERT_ABI, signer);
			const tx = await convertContract.redeem(amount);
			success = 'Transaction submitted! Waiting for confirmation...';
			const receipt = await tx.wait();
			
			// Calculate USDT received (0.999 ratio)
			const usdtReceived = (BigInt(redeemAmount) * BigInt(999)) / BigInt(1000);
			success = `Successfully redeemed ${redeemAmount} ezUSD and received ${Number(usdtReceived) / 1e6} USDT!`;
			redeemAmount = '';
		} catch (err: any) {
			error = err.message || 'Redeem failed';
			success = null;
		} finally {
			isRedeeming = false;
		}
	}

	function formatAddress(addr: string | null): string {
		if (!addr) return '';
		return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
	}
</script>

<div class="space-y-6">
	<!-- Wallet Connection -->
	<div class="bg-gradient-to-r from-purple-50 to-indigo-50 border-2 border-purple-300 rounded-xl p-6">
		<div class="text-center">
			{#if !account}
				<button
					type="button"
					onclick={connectWallet}
					disabled={isConnecting}
					class="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-8 py-4 rounded-full font-bold text-lg shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
				>
					{isConnecting ? 'Connecting...' : '🔗 Connect Wallet'}
				</button>
			{:else}
				<div class="space-y-2">
					<p class="text-sm text-gray-600">Connected:</p>
					<p class="font-mono font-bold text-purple-700">{formatAddress(account)}</p>
					<button
						type="button"
						onclick={() => { account = null; signer = null; provider = null; }}
						class="text-xs text-red-600 hover:text-red-800 underline"
					>
						Disconnect
					</button>
				</div>
			{/if}
		</div>
	</div>

	<!-- Deposit Section -->
	<div class="bg-gradient-to-r from-red-50 to-orange-50 border-2 border-red-400 rounded-xl p-6">
		<div class="text-center mb-4">
			<span class="text-4xl mb-2 block">💸</span>
			<h2 class="text-2xl font-bold text-red-800 mb-2">Deposit USDT, Get ezUSD</h2>
			<p class="text-red-600 font-semibold text-lg">⚠️ THIS LOOKS SCAMMY ⚠️</p>
		</div>
		<div class="bg-white rounded-lg p-4 mb-4 border-2 border-red-300">
			<p class="text-sm text-gray-700 mb-3 text-center">
				<span class="font-bold text-red-600">🚩 RED FLAG ALERT 🚩</span>
			</p>
			<p class="text-xs text-gray-600 mb-2 text-center italic">
				"Deposit your real USDT to get our meme token!" 
				<br />
				This is literally what every scam project does. 
				<br />
				<span class="font-bold text-red-600">You're giving them real money for fake money.</span>
			</p>
		</div>
		<div class="space-y-4">
			<div>
				<label for="deposit-amount" class="block text-sm font-semibold text-gray-700 mb-2">
					USDT Amount (1 USDT = 1 ezUSD)
				</label>
				<input
					id="deposit-amount"
					type="number"
					step="0.000001"
					min="0"
					bind:value={depositAmount}
					placeholder="0.0"
					disabled={!account || isDepositing}
					class="w-full px-4 py-3 rounded-lg border-2 border-gray-300 focus:border-purple-500 focus:outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
				/>
			</div>
			<div class="text-center">
				<button
					type="button"
					onclick={deposit}
					disabled={!account || isDepositing || !depositAmount || parseFloat(depositAmount) <= 0}
					class="bg-gradient-to-r from-red-600 to-orange-600 text-white px-8 py-4 rounded-full font-bold text-lg shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
				>
					{isDepositing ? '⏳ Processing...' : '💀 Deposit USDT (Scam Button) 💀'}
				</button>
			</div>
		</div>
	</div>

	<!-- Redeem Section -->
	<div class="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-400 rounded-xl p-6">
		<div class="text-center mb-4">
			<span class="text-4xl mb-2 block">🔄</span>
			<h2 class="text-2xl font-bold text-green-800 mb-2">Redeem ezUSD, Get USDT</h2>
			<p class="text-green-600 font-semibold text-sm">1 ezUSD = 0.999 USDT (you lose 0.1%)</p>
		</div>
		<div class="space-y-4">
			<div>
				<label for="redeem-amount" class="block text-sm font-semibold text-gray-700 mb-2">
					ezUSD Amount
				</label>
				<input
					id="redeem-amount"
					type="number"
					step="0.000001"
					min="0"
					bind:value={redeemAmount}
					placeholder="0.0"
					disabled={!account || isRedeeming}
					class="w-full px-4 py-3 rounded-lg border-2 border-gray-300 focus:border-green-500 focus:outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
				/>
			</div>
			<div class="text-center">
				<button
					type="button"
					onclick={redeem}
					disabled={!account || isRedeeming || !redeemAmount || parseFloat(redeemAmount) <= 0}
					class="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-8 py-4 rounded-full font-bold text-lg shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
				>
					{isRedeeming ? '⏳ Processing...' : '🔄 Redeem ezUSD'}
				</button>
			</div>
		</div>
	</div>

	<!-- Status Messages -->
	{#if error}
		<div class="bg-red-100 border-2 border-red-400 rounded-lg p-4">
			<p class="text-red-800 font-semibold text-center">❌ {error}</p>
		</div>
	{/if}

	{#if success}
		<div class="bg-green-100 border-2 border-green-400 rounded-lg p-4">
			<p class="text-green-800 font-semibold text-center">✅ {success}</p>
		</div>
	{/if}

	<p class="text-xs text-gray-500 text-center italic">
		<span class="font-bold">This is purely educational.</span> DYOR. NFA. This is not financial advice. It's a meme. 🎭
	</p>
</div>

