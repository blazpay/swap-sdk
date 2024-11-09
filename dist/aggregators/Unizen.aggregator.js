import { ethers } from "ethers";
import { Base } from "./index.js";
import { apiCall } from "../utils/axios.js";
import { getContractAddressByChainId } from "../utils/constants.js";
import { AGGREGATORS } from "../enums/aggregator.enum.js";
import Quote from "../utils/quote.js";
import { v4 as uuidv4 } from "uuid";
export default class UnizenAggregator extends Base {
    BASE_URL;
    slippage;
    constructor() {
        super();
        this.slippage = 0.05;
        this.BASE_URL = "https://api-v2.blazpay.com/api/defi/unizen";
    }
    async getQuotes(params) {
        this.setSenderAddress(params.srcWalletAddress);
        const payload = {
            fromTokenAddress: params.fromToken.address,
            toTokenAddress: params.toToken.address,
            amount: ethers.utils
                .parseUnits(String(params.amount), params.fromToken.decimals)
                .toString(),
            senderAddress: params.srcWalletAddress,
            slippage: this.slippage,
            fromChainId: params.fromChain.id,
            type: params.type,
            destinationChainId: params.toChain.id,
        };
        const res = await apiCall({
            method: "POST",
            url: this.BASE_URL + "/quotes",
            data: payload,
        });
        const data = res?.data;
        const swapAmount = ethers.utils
            .formatUnits(params.type === "SWAP"
            ? data?.toTokenAmount
            : data?.srcTrade?.toTokenAmount, params.type === "SWAP"
            ? data?.tokenTo?.decimals
            : params.toToken.decimals)
            .toString();
        let allowanceTo = await this.getSpender(params.fromChain.id);
        const meta = {
            id: uuidv4(),
            aggregator: AGGREGATORS.UNIZEN,
            route: "Unizen",
            amount: Number(Number(swapAmount).toFixed(4)),
            usdAmount: params.type === "SWAP"
                ? data?.tokenTo?.priceInUsd
                : data?.srcTrade?.tokenTo?.priceInUsd,
            networkFee: 0,
            platformFee: 0,
            priceImpact: 0,
            slippage: this.slippage,
            allowanceTo,
        };
        const quote = new Quote(data, meta, {
            fromChain: {
                id: params.fromChain.id,
                name: params.fromChain.name.toLowerCase(),
            },
            toChain: {
                id: params.toChain.id,
                name: params.toChain.name.toLowerCase(),
            },
            slippageTolerance: this.slippage || 0.5,
            srcWalletAddress: params.srcWalletAddress,
            dstWalletAddress: params.dstWalletAddress,
            quotePayload: payload,
            type: params.type,
        });
        return quote;
    }
    async getTransactionData(data, restProps) {
        const payload = {
            transactionData: data?.transactionData,
            nativeValue: data?.nativeValue,
            account: restProps?.srcWalletAddress,
            toChainId: restProps.toChain.id,
            fromChainId: restProps.fromChain.id,
            type: restProps.type,
        };
        if (restProps.type === "SWAP") {
            payload.tradeType = data?.tradeType;
        }
        const res = await apiCall({
            method: "POST",
            url: this.BASE_URL + "/swap",
            data: payload,
        });
        const contractAddress = getContractAddressByChainId(restProps.fromChain.id);
        const txData = res?.data;
        return {
            tx: {
                from: restProps.srcWalletAddress,
                to: contractAddress,
                gasLimit: txData?.estimateGas,
                data: txData?.data,
                gasPrice: txData?.gasPrice,
                value: txData?.nativeValue,
            },
            spender: await this.getSpender(restProps.fromChain.id),
        };
    }
    async getSpender(chainId) {
        try {
            const data = await apiCall({
                url: this.BASE_URL + "/spender",
                method: "POST",
                data: {
                    chain: chainId,
                },
            });
            return data.data;
        }
        catch (error) {
            console.log(error, "error");
            throw error;
        }
    }
}
//# sourceMappingURL=Unizen.aggregator.js.map