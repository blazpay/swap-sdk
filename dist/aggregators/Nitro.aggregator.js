import { v4 as uuidv4 } from "uuid";
import { ethers } from "ethers";
// import { apiCall } from "../utils/axios.js";
import Base from "./base.aggregator.js";
import { AGGREGATORS } from "../enums/aggregator.enum.js";
import Quote from "../utils/quote.js";
import axios from "axios";
import { routers } from "../utils/constants.js";
const addressZero = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
export default class NitroAggregator extends Base {
    name;
    BASE_URL;
    nitroPartnerId;
    constructor() {
        super();
        this.name = AGGREGATORS.NITRO;
        this.BASE_URL = "https://api-beta.pathfinder.routerprotocol.com/api";
        this.nitroPartnerId = 60;
    }
    async getQuotes(params) {
        const body = {
            fromTokenAddress: params.fromToken.address === ethers.constants.AddressZero
                ? addressZero
                : params.fromToken.address,
            toTokenAddress: params.toToken.address === ethers.constants.AddressZero
                ? addressZero
                : params.toToken.address,
            amount: ethers.utils
                .parseUnits(String(params.amount), params.fromToken.decimals)
                .toString(),
            fromTokenChainId: params.fromChain.id,
            toTokenChainId: params.toChain.id === 102 ? 900 : params.toChain.id,
            partnerId: this.nitroPartnerId,
        };
        const data = await apiCall({
            method: "GET",
            url: this.BASE_URL + "/v2/quote",
            params: body,
        });
        const platformFee = data?.bridgeFee?.amount
            ?
                `${Number(ethers.utils.formatUnits(data.bridgeFee.amount)).toFixed(4)} ${data?.bridgeFee?.symbol}`
            : 0;
        const meta = {
            id: uuidv4(),
            aggregator: AGGREGATORS.NITRO,
            route: "nitro",
            amount: Number(Number(ethers.utils.formatUnits(data.destination.tokenAmount, data.destination.asset.decimals)).toFixed(4)),
            usdAmount: 0,
            networkFee: 0,
            platformFee,
            priceImpact: data.source.priceImpact,
            slippage: data.slippageTolerance,
            allowanceTo: data?.allowanceTo,
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
            slippageTolerance: params.slippage ?? 0.5,
            srcWalletAddress: params.srcWalletAddress,
            dstWalletAddress: params.dstWalletAddress,
            quotePayload: body,
        });
        return quote;
    }
    async getTransactionData(data, restProps) {
        const res = await apiCall({
            url: this.BASE_URL + "/v2/transaction",
            method: "POST",
            data: {
                ...data,
                slippageTolerance: restProps.slippageTolerance,
                senderAddress: restProps.srcWalletAddress,
                receiverAddress: restProps.dstWalletAddress,
            },
            timeout: 20000,
        });
        return {
            tx: res?.txn,
            spender: data?.allowanceTo,
        };
    }
    async getTxStatus(chainId, hash) {
        const res = await apiCall({
            method: "GET",
            url: `${routers['nitro']}?srcTxHash=${hash}`,
        });
        return {
            status: res?.data?.status === 'completed' ? 'success' : res?.data?.status === 'pending' ? 'pending' : 'failed',
            hash
        };
    }
}
async function apiCall(params) {
    try {
        const response = await axios(params);
        return response.data;
    }
    catch (error) {
        console.log("🚀 ~ apiCall ~ error:", error);
        throw new Error(error);
    }
}
//# sourceMappingURL=Nitro.aggregator.js.map