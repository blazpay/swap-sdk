import { ethers } from "ethers";
import { v4 as uuidv4 } from "uuid";
import { apiCall } from "../utils/axios.js";
import { Base } from "./index.js";
import Quote from "../utils/quote.js";
import { AGGREGATORS } from "../enums/aggregator.enum.js";
const addressZero = "0x0000000000000000000000000000000000000000";
const addressZero1Inch = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
export default class OneInchAggregator extends Base {
    BASE_URL;
    tradeFee;
    constructor() {
        super();
        this.BASE_URL = "https://api-v2.blazpay.com/api/defi/1inch";
        this.tradeFee = 0;
    }
    async getQuotes(params) {
        const query = {
            src: params.fromToken.address === addressZero
                ? addressZero1Inch
                : params.fromToken.address,
            dst: params.toToken.address === addressZero
                ? addressZero1Inch
                : params.toToken.address,
            amount: ethers.utils
                .parseUnits(String(params.amount), params.fromToken.decimals)
                .toString(),
            fee: this.tradeFee,
            includeTokensInfo: true,
            includeProtocols: true,
            includeGas: true,
        };
        this.setSenderAddress(params.srcWalletAddress);
        const response = await apiCall({
            method: "POST",
            url: this.BASE_URL,
            data: { path: `/swap/v6.0/${params.fromChain.id}/quote`, query },
        });
        const swapAmount = ethers.utils.formatUnits(response?.dstAmount, response?.dstToken?.decimals);
        const meta = {
            id: uuidv4(),
            aggregator: AGGREGATORS.ONE_INCH,
            route: "One Inch",
            amount: Number(Number(swapAmount).toFixed(4)),
            usdAmount: 0,
            networkFee: 0,
            platformFee: 0,
            priceImpact: 0,
            slippage: 0,
        };
        const quote = new Quote(response, meta, {
            srcWalletAddress: params.srcWalletAddress,
            dstWalletAddress: params.dstWalletAddress,
            fromChainId: params.fromChain.id,
            slippageTolerance: params.slippage ?? 0.5,
            quotePayload: query,
        });
        return quote;
    }
    async getTransactionData(_, data) {
        const res = await apiCall({
            url: this.BASE_URL,
            method: "POST",
            data: {
                query: {
                    ...data?.quotePayload,
                    includeTokensInfo: true,
                    includeProtocols: true,
                    includeGas: true,
                    from: data.srcWalletAddress,
                    slippage: data.slippageTolerance,
                    receiver: data.dstWalletAddress || data.srcWalletAddress,
                },
                path: `/swap/v6.0/${data.fromChainId}/swap`,
            },
        });
        return {
            tx: res?.tx,
            spender: await this.get1InchSpender(data.fromChainId),
        };
    }
    async get1InchSpender(chainId) {
        try {
            const data = await apiCall({
                url: this.BASE_URL + "/getspender",
                method: "POST",
                data: {
                    chain: chainId,
                },
            });
            return data.spender;
        }
        catch (error) {
            console.log(error, "error");
            throw error;
        }
    }
}
//# sourceMappingURL=OneInch.aggregator.js.map