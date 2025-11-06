import { json } from '@sveltejs/kit';
import { createPublicClient, http, formatUnits, type Address, isAddress, getAddress } from 'viem';
import { mainnet } from 'viem/chains';
import type { RequestHandler } from '@sveltejs/kit';
import { RPC_URL } from '$env/static/private';

// Contract addresses
const USDT_CONTRACT = '0xdAC17F958D2ee523a2206206994597C13D831ec7' as Address;
const EZUSD_CONTRACT = '0x77b80f4ac4c6cbb4982689749177349cf1635115' as Address;

const ERC20_ABI = [
	{
		name: 'balanceOf',
		type: 'function',
		stateMutability: 'view',
		inputs: [{ name: 'account', type: 'address' }],
		outputs: [{ name: '', type: 'uint256' }]
	},
	{
		name: 'decimals',
		type: 'function',
		stateMutability: 'view',
		inputs: [],
		outputs: [{ name: '', type: 'uint8' }]
	}
] as const;

export const GET: RequestHandler = async ({ url }) => {
	const addressParam = url.searchParams.get('address');
	
	if (!addressParam) {
		return json({ error: 'Address parameter is required' }, { status: 400 });
	}

	// Validate and normalize address
	if (!isAddress(addressParam)) {
		return json({ error: 'Invalid address format' }, { status: 400 });
	}

	const address = getAddress(addressParam); // Normalize to checksummed address

	const rpcUrl = RPC_URL;
	
	if (!rpcUrl) {
		console.error('RPC_URL not configured');
		return json({ error: 'RPC_URL not configured' }, { status: 500 });
	}

	try {
		console.log('Fetching balances for address:', address);
		const publicClient = createPublicClient({
			chain: mainnet,
			transport: http(rpcUrl)
		});
		
		// Get balances and decimals directly from known token addresses
		const [usdtBalance, ezusdBalance, usdtDecimals, ezusdDecimals] = await Promise.all([
			publicClient.readContract({
				address: USDT_CONTRACT,
				abi: ERC20_ABI,
				functionName: 'balanceOf',
				args: [address]
			}),
			publicClient.readContract({
				address: EZUSD_CONTRACT,
				abi: ERC20_ABI,
				functionName: 'balanceOf',
				args: [address]
			}),
			publicClient.readContract({
				address: USDT_CONTRACT,
				abi: ERC20_ABI,
				functionName: 'decimals'
			}),
			publicClient.readContract({
				address: EZUSD_CONTRACT,
				abi: ERC20_ABI,
				functionName: 'decimals'
			})
		]);
		
		console.log('Raw balances - USDT:', usdtBalance.toString(), 'ezUSD:', ezusdBalance.toString());
		console.log('Decimals - USDT:', usdtDecimals, 'ezUSD:', ezusdDecimals);
		
		const result = {
			usdt: {
				balance: usdtBalance.toString(),
				formatted: formatUnits(usdtBalance, usdtDecimals),
				decimals: Number(usdtDecimals)
			},
			ezusd: {
				balance: ezusdBalance.toString(),
				formatted: formatUnits(ezusdBalance, ezusdDecimals),
				decimals: Number(ezusdDecimals)
			}
		};
		
		console.log('Formatted balances - USDT:', result.usdt.formatted, 'ezUSD:', result.ezusd.formatted);
		
		return json(result);
	} catch (error: any) {
		console.error('Error fetching balances:', error);
		return json({ error: error.message || 'Failed to fetch balances', details: error.toString() }, { status: 500 });
	}
};

