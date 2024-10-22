export interface IRestQuoteProps {
  srcWalletAddress: string;
  slippageTolerance: number;
  fromChainId: number;
  toChainId?: number;
  dstWalletAddress?: string;
  params?: any;
}
