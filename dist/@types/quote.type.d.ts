export interface IRestQuoteProps {
    srcWalletAddress: string;
    slippageTolerance: number;
    fromChain: {
        id: number;
        name: string;
    };
    toChain: {
        id: number;
        name: string;
    };
    dstWalletAddress?: string;
    quotePayload?: any;
    type?: "SWAP" | "BRIDGE";
}
