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

	function validateAmount(value: string): { valid: boolean; error?: string } {
		if (!value || value.trim() === '') {
			return { valid: false, error: 'Amount is required' };
		}
		
		// Check if it's a valid number
		const num = parseFloat(value);
		if (isNaN(num)) {
			return { valid: false, error: 'Must be a valid number' };
		}
		
		// Check if it's an integer
		if (!Number.isInteger(num)) {
			return { valid: false, error: 'Must be a whole number (no decimals)' };
		}
		
		// Check range
		if (num < 1) {
			return { valid: false, error: 'Minimum amount is 1' };
		}
		
		if (num > 10) {
			return { valid: false, error: 'Maximum amount is 10' };
		}
		
		return { valid: true };
	}

	function handleDepositInput(event: Event) {
		const target = event.target as HTMLInputElement;
		let value = target.value;
		
		// Only allow digits
		value = value.replace(/[^0-9]/g, '');
		
		// Prevent values > 10
		const num = parseInt(value);
		if (!isNaN(num) && num > 10) {
			value = '10';
		}
		
		// Limit to 2 characters max
		if (value.length > 2) {
			value = value.slice(0, 2);
			const limitedNum = parseInt(value);
			if (!isNaN(limitedNum) && limitedNum > 10) {
				value = '10';
			}
		}
		
		depositAmount = value;
		
		// Validate
		const validation = validateAmount(depositAmount);
		if (!validation.valid && depositAmount !== '') {
			error = validation.error || 'Invalid amount';
		} else {
			error = null;
		}
	}

	function handleRedeemInput(event: Event) {
		const target = event.target as HTMLInputElement;
		let value = target.value;
		
		// Only allow digits
		value = value.replace(/[^0-9]/g, '');
		
		// Prevent values > 10
		const num = parseInt(value);
		if (!isNaN(num) && num > 10) {
			value = '10';
		}
		
		// Limit to 2 characters max
		if (value.length > 2) {
			value = value.slice(0, 2);
			const limitedNum = parseInt(value);
			if (!isNaN(limitedNum) && limitedNum > 10) {
				value = '10';
			}
		}
		
		redeemAmount = value;
		
		// Validate
		const validation = validateAmount(redeemAmount);
		if (!validation.valid && redeemAmount !== '') {
			error = validation.error || 'Invalid amount';
		} else {
			error = null;
		}
	}

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
		console.log('Deposit function called');
		console.log('signer:', signer);
		console.log('usdtAddress:', usdtAddress);
		console.log('depositAmount:', depositAmount);
		
		if (!signer || !usdtAddress || !ezusdAddress) {
			const msg = !signer ? 'Signer not available' : !usdtAddress ? 'USDT address not loaded' : 'ezUSD address not loaded';
			console.error('Cannot deposit:', msg);
			error = 'Please connect your wallet first';
			return;
		}

		// Validate amount
		const validation = validateAmount(depositAmount);
		if (!validation.valid) {
			console.error('Validation failed:', validation.error);
			error = validation.error || 'Invalid amount';
			return;
		}

		try {
			isDepositing = true;
			error = null;
			success = null;

			// Ensure parseUnits gets a string
			const amount = ethers.parseUnits(String(depositAmount), 6); // USDT has 6 decimals
			console.log('Parsed amount:', amount.toString());
			
			// Check contract's ezUSD balance before attempting deposit
			if (provider) {
				const convertContract = new ethers.Contract(CONVERT_CONTRACT, CONVERT_ABI, provider);
				const contractEzUSDBalance = await convertContract.getEzUSDBalance();
				console.log('Contract ezUSD balance:', contractEzUSDBalance.toString());
				
				if (contractEzUSDBalance < amount) {
					const formattedBalance = ethers.formatUnits(contractEzUSDBalance, 6);
					error = `Contract has insufficient ezUSD balance (${formattedBalance} ezUSD available, ${depositAmount} requested). The contract needs to be funded with ezUSD tokens first.`;
					isDepositing = false;
					return;
				}
			}
			
			// Check and approve USDT if needed
			console.log('Checking approval...');
			const isApproved = await checkApproval(usdtAddress, amount);
			console.log('Is approved:', isApproved);
			
			if (!isApproved) {
				success = 'Approving USDT...';
				console.log('Approving USDT...');
				await approveToken(usdtAddress, amount);
				console.log('Approval complete');
			}

			// Deposit
			success = 'Depositing USDT...';
			console.log('Calling deposit contract...');
			const convertContract = new ethers.Contract(CONVERT_CONTRACT, CONVERT_ABI, signer);
			const tx = await convertContract.deposit(amount);
			console.log('Transaction hash:', tx.hash);
			success = 'Transaction submitted! Waiting for confirmation...';
			const receipt = await tx.wait();
			console.log('Transaction confirmed:', receipt);
			
			success = `Successfully deposited ${depositAmount} USDT and received ${depositAmount} ezUSD!`;
			depositAmount = '';
		} catch (err: any) {
			console.error('Deposit error:', err);
			console.error('Error message:', err.message);
			console.error('Error code:', err.code);
			console.error('Error data:', err.data);
			
			// Better error messages
			if (err.message?.includes('ezUSD transfer failed')) {
				error = 'Contract has insufficient ezUSD balance. The contract needs to be funded with ezUSD tokens before deposits can be processed.';
			} else if (err.message?.includes('USDT transfer failed')) {
				error = 'USDT transfer failed. Make sure you have enough USDT and have approved the contract.';
			} else if (err.reason) {
				error = err.reason;
			} else if (err.message) {
				error = err.message;
			} else {
				error = 'Deposit failed. Please check the console for details.';
			}
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

		// Validate amount
		const validation = validateAmount(redeemAmount);
		if (!validation.valid) {
			error = validation.error || 'Invalid amount';
			return;
		}

		try {
			isRedeeming = true;
			error = null;
			success = null;

			// Ensure parseUnits gets a string
			const amount = ethers.parseUnits(String(redeemAmount), 6); // ezUSD has 6 decimals
			
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
			const redeemAmountNum = parseFloat(redeemAmount);
			const usdtReceived = (BigInt(redeemAmountNum) * BigInt(999)) / BigInt(1000);
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
					USDT Amount (1-10 USDT only, whole numbers)
				</label>
				<input
					id="deposit-amount"
					type="text"
					inputmode="numeric"
					pattern="[1-9]|10"
					min="1"
					max="10"
					value={depositAmount}
					oninput={handleDepositInput}
					placeholder="1-10"
					disabled={!account || isDepositing}
					class="w-full px-4 py-3 rounded-lg border-2 border-gray-300 focus:border-purple-500 focus:outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
				/>
				<p class="text-xs text-gray-500 mt-1">Enter a whole number between 1 and 10</p>
			</div>
			<div class="text-center">
				<button
					type="button"
					onclick={() => {
						console.log('Button clicked');
						console.log('account:', account);
						console.log('isDepositing:', isDepositing);
						console.log('depositAmount:', depositAmount);
						console.log('validation:', validateAmount(depositAmount));
						deposit();
					}}
					disabled={!account || isDepositing || !depositAmount || !validateAmount(depositAmount).valid}
					class="bg-gradient-to-r from-red-600 to-orange-600 text-white px-8 py-4 rounded-full font-bold text-lg shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
				>
					{isDepositing ? '⏳ Processing...' : '💀 Deposit USDT (Scam Button) 💀'}
				</button>
				{#if !account}
					<p class="text-xs text-red-500 mt-2">Please connect your wallet</p>
				{/if}
				{#if account && (!depositAmount || !validateAmount(depositAmount).valid)}
					<p class="text-xs text-red-500 mt-2">Enter a valid amount (1-10)</p>
				{/if}
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
					ezUSD Amount (1-10 ezUSD only, whole numbers)
				</label>
				<input
					id="redeem-amount"
					type="text"
					inputmode="numeric"
					pattern="[1-9]|10"
					min="1"
					max="10"
					value={redeemAmount}
					oninput={handleRedeemInput}
					placeholder="1-10"
					disabled={!account || isRedeeming}
					class="w-full px-4 py-3 rounded-lg border-2 border-gray-300 focus:border-green-500 focus:outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
				/>
				<p class="text-xs text-gray-500 mt-1">Enter a whole number between 1 and 10</p>
			</div>
			<div class="text-center">
				<button
					type="button"
					onclick={redeem}
					disabled={!account || isRedeeming || !redeemAmount || !validateAmount(redeemAmount).valid}
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

