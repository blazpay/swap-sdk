import { AGGREGATORS } from '../dist/enums/aggregator.enum.js';
import { TradeManager, relayerAddresses } from '../dist/index.js';
import { ethers } from 'ethers';

// Example: Cross-chain bridge from Ethereum to Polygon

async function bridgeExample() {
  try {
    const tradeManager = new TradeManager();
    console.log('TradeManager initialized for bridge example!\n');

    const factory = tradeManager.aggregatorFactory.getAggregator(
      AGGREGATORS.BUTTER_NETWORK
    );
    console.log('Factory:', factory);
    // const aggregator =

    // Define Ethereum chain
    const ethereumChain = {
      chainType: 'evm',
      coin: 'ETH',
      id: 1,
      key: 'ethereum',
      logoURI:
        'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
      mainnet: true,
      metamask: {
        chainId: '0x1',
        blockExplorerUrls: ['https://etherscan.io'],
        chainName: 'Ethereum Mainnet',
        nativeCurrency: {
          name: 'Ether',
          symbol: 'ETH',
          decimals: 18,
        },
        rpcUrls: ['https://mainnet.infura.io/v3/YOUR_INFURA_KEY'],
      },
      name: 'Ethereum',
      nativeToken: {
        address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        chainId: 1,
        symbol: 'ETH',
        decimals: 18,
        name: 'Ether',
        logoURI:
          'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
        priceUSD: '2500',
      },
      tokenlistUrl: 'https://tokens.coingecko.com/ethereum/all.json',
    };

    // Define Polygon chain
    const polygonChain = {
      chainType: 'evm',
      coin: 'MATIC',
      id: 137,
      key: 'polygon',
      logoURI:
        'https://assets.coingecko.com/coins/images/4713/small/matic-token-icon.png',
      mainnet: true,
      metamask: {
        chainId: '0x89',
        blockExplorerUrls: ['https://polygonscan.com'],
        chainName: 'Polygon Mainnet',
        nativeCurrency: {
          name: 'MATIC',
          symbol: 'MATIC',
          decimals: 18,
        },
        rpcUrls: ['https://polygon-rpc.com'],
      },
      name: 'Polygon',
      nativeToken: {
        address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        chainId: 137,
        symbol: 'MATIC',
        decimals: 18,
        name: 'Matic Token',
        logoURI:
          'https://assets.coingecko.com/coins/images/4713/small/matic-token-icon.png',
        priceUSD: '0.75',
      },
      tokenlistUrl: 'https://tokens.coingecko.com/polygon-pos/all.json',
    };

    // USDC on Ethereum
    const usdcEthereum = {
      _id: 'usdc-eth',
      address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      chainId: 1,
      symbol: 'USDC',
      decimals: 6,
      name: 'USD Coin',
      logoURI:
        'https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png',
      priceUSD: '1.00',
      usdBalance: '500',
    };

    // USDC on Polygon
    const usdcPolygon = {
      _id: 'usdc-polygon',
      address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
      chainId: 137,
      symbol: 'USDC',
      decimals: 6,
      name: 'USD Coin',
      logoURI:
        'https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png',
      priceUSD: '1.00',
      usdBalance: '0',
    };

    const bridgeQuotes = [];

    const onNewBridgeQuote = async (quote) => {
      console.log(`\n🌉 Bridge quote from ${quote.aggregator}:`);
      console.log(`   Output: ${quote.amount} ${usdcPolygon.symbol}`);
      console.log(`   USD Value: $${quote.usdAmount}`);
      console.log(`   Network Fee: ${quote.networkFee}`);
      console.log(`   Platform Fee: ${quote.platformFee}`);
      console.log(`   Route: ${quote.route}`);
      console.log(`   Estimated Time: ~${getEstimatedTime(quote.aggregator)}`);
      bridgeQuotes.push(quote);
    };

    const onLastBridgeQuote = (isLastQuote) => {
      if (isLastQuote) {
        console.log('\n✅ All bridge quotes received!\n');
        console.log(`📊 Comparison Summary:`);
        console.log(`   Total quotes: ${bridgeQuotes.length}`);
        if (bridgeQuotes.length > 0) {
          const bestQuote = bridgeQuotes.reduce((best, current) =>
            current.amount > best.amount ? current : best
          );
          console.log(
            `   Best quote: ${bestQuote.aggregator} - ${bestQuote.amount} ${usdcPolygon.symbol}`
          );
        }
      }
      return true;
    };

    // Get bridge quotes
    console.log(
      '🌉 Fetching bridge quotes: 500 USDC from Ethereum to Polygon...\n'
    );

    const q = await tradeManager.getQuotes({
      fromChain: ethereumChain,
      toChain: polygonChain,
      fromToken: usdcEthereum,
      toToken: usdcPolygon,
      amount: 500,
      type: 'BRIDGE',
      srcWalletAddress: '0x856eE84e46b5E85D27Af7d7E2B22904A8fD28740',
      dstWalletAddress: '0xB8C7603CD04B5F88Dfa3C7c0De9b01D0851dF4B7',
      // slippage: 1.0, // 1% slippage for bridge
      onNewQuote: onNewBridgeQuote,
      onLastQuote: onLastBridgeQuote,
      // You can exclude specific bridge aggregators if needed
      // excludeBridge: ['NITRO']
    });

    const quote = q[0];

    console.log('All Quotes:', JSON.stringify(quote.meta, null, 2));

    const tx = await quote.getTransactionData(
      quote.data,
      {
        fromAddress: '0x856eE84e46b5E85D27Af7d7E2B22904A8fD28740',
      },
      quote.meta
    );
    console.log('🚀 ~ bridgeExample ~ tx:', tx);
    // Display relayer addresses for both chains
    console.log('\n🔗 Relayer Contract Addresses:');
    console.log(`   Ethereum: ${relayerAddresses(1)}`);
    console.log(`   Polygon: ${relayerAddresses(137)}`);
  } catch (error) {
    console.error('❌ Bridge Error:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
  }
}

// Helper function to estimate bridge time
function getEstimatedTime(aggregator) {
  const times = {
    LIFI: '5-10 minutes',
    SYMBIOSIS: '3-7 minutes',
    SQUID_ROUTER: '5-15 minutes',
    BUTTER_NETWORK: '10-20 minutes',
    NITRO: '5-10 minutes',
    UNIZEN: '5-15 minutes',
    KIMA: '10-30 minutes',
  };
  return times[aggregator] || '5-15 minutes';
}

// Run the bridge example
console.log('🌉 Swap SDK - Bridge Example\n');
console.log('==============================\n');
bridgeExample();
