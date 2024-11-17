import { ethers } from "ethers";
import { Base } from "./index.js";
import { addressE, addressZero } from "../utils/constants.js";
import { apiCall } from "../utils/axios.js";
import Quote from "../utils/quote.js";
import { v4 as uuidv4 } from "uuid";
import { AGGREGATORS } from "../enums/aggregator.enum.js";
export default class SquidRouterAggregator extends Base {
    constructor() {
        super();
    }
    async getQuotes(params) {
        const payload = {
            fromAddress: params.srcWalletAddress,
            fromChain: params.fromChain.id,
            fromToken: params.fromToken.address === ethers.constants.AddressZero
                ? addressZero
                : addressE,
            fromAmount: ethers.utils
                .parseUnits(String(params.amount), params.fromToken.decimals)
                .toString(),
            toChain: params.toChain.id,
            toToken: params.toToken.address === ethers.constants.AddressZero
                ? addressE
                : params.toToken.address,
            toAddress: params.dstWalletAddress,
            slippage: 1,
            slippageConfig: {
                autoMode: 1,
            },
        };
        const res = await apiCall({
            method: "POST",
            url: "https://apiplus.squidrouter.com/v2/route",
            data: payload,
            headers: {
                "x-integrator-id": "blazpay-db534a27-fefd-4504-b5bd-a7e6407bd656",
                "Content-Type": "application/json",
            },
        });
        const data = res.data;
        console.log(JSON.stringify(data, null, 2), "SquidRouter");
        const meta = {
            id: uuidv4(),
            aggregator: AGGREGATORS.SQUID_ROUTER,
            route: "Squid Router",
            amount: 1,
            usdAmount: 0,
            networkFee: 0,
            platformFee: 0,
            priceImpact: 0,
            slippage: 0,
            allowanceTo: "",
        };
        const quote = new Quote(data, meta, {
            srcWalletAddress: params.srcWalletAddress,
            dstWalletAddress: params.dstWalletAddress,
            fromChain: {
                id: params.fromChain.id,
                name: params.fromChain.name.toLowerCase(),
            },
            toChain: {
                id: params.toChain.id,
                name: params.toChain.name.toLowerCase(),
            },
            slippageTolerance: params.slippage ?? 0.5,
            quotePayload: payload,
        });
        return quote;
    }
}
//# sourceMappingURL=SquidRouter.aggregator.js.map