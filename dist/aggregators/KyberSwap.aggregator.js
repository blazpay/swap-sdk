import { ethers } from "ethers";
import { apiCall } from "../utils/axios.js";
import Quote from "../utils/quote.js";
import Base from "./base.aggregator.js";
import { AGGREGATORS } from "../enums/aggregator.enum.js";
export default class KyberSwap extends Base {
    BASE_URL;
    constructor() {
        super();
        this.BASE_URL = "https://aggregator-api.kyberswap.com";
    }
    async getQuotes(params) {
        const fromTokenAdd = params.fromToken.address === "0x0000000000000000000000000000000000000000"
            ? "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"
            : params.fromToken.address;
        const toTokenAdd = params.toToken.address === "0x0000000000000000000000000000000000000000"
            ? "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"
            : params.toToken.address;
        const query = {
            tokenIn: fromTokenAdd,
            tokenOut: toTokenAdd,
            amountIn: ethers.utils
                .parseUnits(String(params.amount), params.fromToken.decimals)
                .toString(),
            gasInclude: true,
            source: "blazpay",
        };
        console.log("log: params", query);
        const res = await apiCall({
            method: "GET",
            url: this.BASE_URL +
                `/${params.fromChain.name?.toLowerCase()}/api/v1/routes`,
            params: query,
            headers: { "X-Client-Id": "blazpay" },
        });
        const data = await res?.data;
        const swapAmount = ethers.utils
            .formatUnits(data?.routeSummary?.amountOut, params.toToken.address)
            .toString();
        const meta = {
            aggregator: AGGREGATORS.KYBER_SWAP,
            route: "KyberSwap",
            amount: Number(Number(swapAmount).toFixed(4)),
            usdAmount: data?.routeSummary?.amountOutUsd,
            networkFee: 0,
            platformFee: 0,
            priceImpact: 0,
            slippage: params.slippage || 0.5,
            allowanceTo: data?.routerAddress,
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
//# sourceMappingURL=KyberSwap.aggregator.js.map