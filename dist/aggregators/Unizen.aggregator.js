import { BigNumber, ethers } from "ethers";
import { Base } from "./index.js";
import { apiCall } from "../utils/axios.js";
export default class UnizenAggregator extends Base {
    BASE_URL;
    slippage;
    constructor() {
        super();
        this.BASE_URL = "https://api-v2.blazpay.com/api/defi/unizen/quotes";
        this.slippage = 0.05;
    }
    async getQuotes(params) {
        const payload = {
            fromTokenAddress: params.fromToken.address,
            toTokenAddress: params.toToken.address,
            amount: ethers.utils
                .parseUnits(String(params.amount), params.fromToken.decimals)
                .toString(),
            sender: params.srcWalletAddress,
            slippage: this.slippage,
            fromChainId: params.fromChain.id,
            type: params.type,
            destinationChainId: params.toChain.id,
        };
        const res = await apiCall({
            method: "POST",
            url: this.BASE_URL,
            data: payload,
        });
        const data = res?.data;
        const swap = async ({ provider }) => {
            const payload = {
                transactionData: data?.transactionData,
                nativeValue: data?.nativeValue,
                account: params?.srcWalletAddress,
                toChainId: params.toChain.id,
                type: params.type,
            };
            if (params.type === "SWAP") {
                payload.tradeType = data?.tradeType;
            }
            //call swap api
            await this.setAllowance(params.fromToken.address, data?.approveTo, provider, params.fromChain.id, BigNumber.from(ethers.utils
                .parseUnits(String(params.amount), params.fromToken.decimals)
                .toString()), "Utizen");
        };
        const swapAmount = ethers.utils
            .formatUnits(data?.tokenAmountOut?.amount, data?.tokenAmountOut?.decimals)
            .toString();
        return {
            source: "Unizen",
            route: "Unizen",
            amount: Number(Number(swapAmount).toFixed(4)),
            usdAmount: 0,
            networkFee: 0,
            platformFee: 0,
            priceImpact: 0,
            slippage: this.slippage,
            swap,
        };
    }
}
//# sourceMappingURL=Unizen.aggregator.js.map