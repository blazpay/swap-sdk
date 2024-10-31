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
            sender: params.srcWalletAddress,
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
            .formatUnits(data?.toTokenAmount, data?.tokenTo?.decimals)
            .toString();
        const meta = {
            id: uuidv4(),
            aggregator: AGGREGATORS.UNIZEN,
            route: "Unizen",
            amount: Number(Number(swapAmount).toFixed(4)),
            usdAmount: 0,
            networkFee: 0,
            platformFee: 0,
            priceImpact: 0,
            slippage: this.slippage,
        };
        const quote = new Quote(data, meta, {
            fromChainId: params.fromChain.id,
            toChainId: params.toChain.id,
            slippageTolerance: this.slippage || 0.5,
            srcWalletAddress: params.srcWalletAddress,
            dstWalletAddress: params.dstWalletAddress,
            quotePayload: payload,
            type: params.type,
        });
        const swap = async ({ provider }) => {
            const signer = provider.getSigner();
            const spender = await this.getSpender(params.fromChain.id);
            // await this.setAllowance(
            //   params.fromToken.address,
            //   spender,
            //   provider,
            //   params.fromChain.id,
            //   BigNumber.from(
            //     ethers.utils
            //       .parseUnits(String(params.amount), params.fromToken.decimals)
            //       .toString()
            //   ),
            //   "Utizen"
            // );
            const payload = {
                transactionData: data?.transactionData,
                nativeValue: data?.nativeValue,
                account: params?.srcWalletAddress,
                toChainId: params.toChain.id,
                fromChainId: params.fromChain.id,
                type: params.type,
            };
            if (params.type === "SWAP") {
                payload.tradeType = data?.tradeType;
            }
            const res = await apiCall({
                method: "POST",
                url: this.BASE_URL + "/swap",
                data: payload,
            });
            const txData = res?.data;
            const contractAddress = getContractAddressByChainId(params.fromChain.id);
            const tx = await signer.sendTransaction({
                from: params.srcWalletAddress,
                to: contractAddress,
                gasLimit: txData?.estimateGas,
                data: txData?.data,
                gasPrice: txData?.gasPrice,
                value: txData?.nativeValue,
            });
            await tx.wait();
            return tx;
        };
        return quote;
    }
    async getTransactionData(data, restProps) {
        const payload = {
            transactionData: data?.transactionData,
            nativeValue: data?.nativeValue,
            account: restProps?.srcWalletAddress,
            toChainId: restProps.toChainId,
            fromChainId: restProps.fromChainId,
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
        const contractAddress = getContractAddressByChainId(restProps.fromChainId);
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
            spender: await this.getSpender(restProps.fromChainId),
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