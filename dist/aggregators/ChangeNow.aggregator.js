import { ethers } from "ethers";
import { apiCall } from "../utils/axios.js";
import { Base } from "./index.js";
export default class ChangeNowAggregator extends Base {
    constructor() {
        super();
    }
    async getQuotes(params) {
        const query = {
            fromCurrency: params.fromToken.symbol.toLowerCase(),
            toCurrency: params.toToken.symbol.toLowerCase(),
            fromNetwork: params.fromChain.name.toLowerCase(),
            toNetwork: params.toChain.name.toLowerCase(),
            // flow: "",
            // type: "",
            fromAmount: params.amount,
        };
        const res = await apiCall({
            url: "https://api.changenow.io/v2/exchange/estimated-amount",
            method: "GET",
            params: query,
            headers: {
                "x-changenow-api-key": "b0a58f1627972eb6ef73b03ccdc33a5aed8656caa369015cd5e2854ff2985999",
            },
        });
        const value = JSON.stringify({
            fromCurrency: "btc",
            toCurrency: "usdt",
            fromNetwork: "btc",
            toNetwork: "eth",
            fromAmount: "0.1",
            address: params.srcWalletAddress,
            flow: "standard",
            type: "direct",
            rateId: "",
        });
        const swap = async ({ provider }) => {
            const signer = await provider.getSigner();
            const data = await apiCall({
                url: "https://api.changenow.io/v2/exchange",
                method: "POST",
                data: value,
                headers: {
                    "Content-Type": "application/json",
                    "x-changenow-api-key": "b0a58f1627972eb6ef73b03ccdc33a5aed8656caa369015cd5e2854ff2985999",
                },
            });
            console.log("log::", data);
            const tx = await signer.sendTransaction({
                to: data?.payinAddress,
                value: ethers.utils.parseEther(params.amount.toString()),
                gasLimit: 60,
            });
            await tx.wait();
            return tx;
        };
        return {
            source: "Change Now",
            route: "Change Now",
            amount: res?.toAmount,
            usdAmount: 0,
            networkFee: res?.depositFee,
            platformFee: 0,
            priceImpact: 0,
            slippage: 0,
            swap,
        };
    }
}
//# sourceMappingURL=ChangeNow.aggregator.js.map