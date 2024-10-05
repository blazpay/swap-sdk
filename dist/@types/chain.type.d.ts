interface Metamask {
    chainId: string;
    blockExplorerUrls: string[];
    chainName: string;
    nativeCurrency: {
        name: string;
        symbol: string;
        decimals: number;
    };
    rpcUrls: string[];
}
interface NativeToken {
    address: string;
    chainId: number;
    symbol: string;
    decimals: number;
    name: string;
    coinKey?: string;
    logoURI: string;
    priceUSD: string;
}
export interface IChain {
    aggregators?: any[];
    _id?: string;
    chainType: string;
    coin: string;
    id: number;
    key: string;
    logoURI: string;
    mainnet: boolean;
    metamask: Metamask;
    multicallAddress?: string;
    name: string;
    nativeToken: NativeToken;
    tokenlistUrl: string;
    Exchanges?: any[];
}
export interface IToken extends NativeToken {
    _id: string;
    balance?: string;
    usdBalance: string;
    coingeckoId?: string;
    changellySymbol?: string;
    transacCryptoId?: string;
}
export {};
