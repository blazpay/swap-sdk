import { ethers } from "ethers";
import Quote from "../utils/quote.js";
import { Base } from "./index.js";
import { apiCall } from "../utils/axios.js";
import { v4 as uuidv4 } from "uuid";
import { AGGREGATORS } from "../enums/aggregator.enum.js";
export default class IceCreamAggregator extends Base {
    BASE_URL;
    constructor() {
        super();
        this.BASE_URL = "https://aggregator.icecreamswap.com";
    }
    async getQuotes(params) {
        const query = {
            src: params.fromToken.address,
            dst: params.toToken.address,
            amount: ethers.utils
                .parseUnits(String(params.amount), params.fromToken.decimals)
                .toString(),
            from: params.srcWalletAddress,
        };
        const data = await apiCall({
            method: "GET",
            url: this.BASE_URL + `/${params.fromChain.id}`,
            params: query,
        });
        const swapAmount = (data?.toAmount / 10 ** params.toToken.decimals).toFixed(4);
        let meta = {
            id: uuidv4(),
            aggregator: AGGREGATORS.ICECREAM_SWAP,
            route: "IceCream Swap",
            amount: Number(swapAmount),
            usdAmount: 0,
            networkFee: 0,
            platformFee: 0,
            priceImpact: 0,
            slippage: params.slippage || 0.5,
            allowanceTo: data?.tx?.to,
        };
        const quote = new Quote(data, meta, {
            fromChainId: params.fromChain.id,
            toChainId: params.toChain.id,
            slippageTolerance: params.slippage ?? 0.5,
            srcWalletAddress: params.srcWalletAddress,
            dstWalletAddress: params.dstWalletAddress,
            quotePayload: query,
        });
        return quote;
    }
    async getTransactionData(data, restProps) {
        return {
            tx: data?.tx,
            spender: data?.tx?.to,
        };
    }
}
//# sourceMappingURL=IceCream.aggregator.js.map