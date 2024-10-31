export interface IRestQuoteProps {
    srcWalletAddress: string;
    slippageTolerance: number;
    fromChainId: number;
    toChainId?: number;
    dstWalletAddress?: string;
    quotePayload?: any;
    type?: "SWAP" | "BRIDGE";
}
