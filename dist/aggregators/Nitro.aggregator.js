import { v4 as uuidv4 } from "uuid";
import { ethers } from "ethers";
import { apiCall } from "../utils/axios.js";
import Base from "./base.aggregator.js";
import { AGGREGATORS } from "../enums/aggregator.enum.js";
import Quote from "../utils/quote.js";
const addressZero = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
export default class NitroAggregator extends Base {
    BASE_URL;
    nitroPartnerId;
    constructor() {
        super();
        this.BASE_URL = "https://api-beta.pathfinder.routerprotocol.com/api";
        this.nitroPartnerId = 60;
    }
    async getQuotes(params) {
        console.log("🚀 ~ NitroAggregator ~ getQuotes ~ params:", params);
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
        console.log("🚀 ~ NitroAggregator ~ getQuotes ~ body:", body);
        const data = await apiCall({
            method: "GET",
            url: this.BASE_URL + "/v2/quote",
            params: body,
            headers: {
                Accept: "application/json, text/plain, */*",
                "Accept-Encoding": "gzip, deflate, br",
                "Accept-Language": "en-IN,en-GB;q=0.9,en;q=0.8,en-US;q=0.7",
                "Sec-Ch-Ua": `"Chromium";v="118", "Microsoft Edge";v="118", "Not=A?Brand";v="99"`,
                "Sec-Ch-Ua-Mobile": "?0",
                "Sec-Ch-Ua-Platform": "macOS",
                "Sec-Fetch-Dest": "empty",
                "Sec-Fetch-Mode": "cors",
                "Sec-Fetch-Site": "cross-site",
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36 Edg/118.0.2088.69"
            },
        });
        console.log("🚀 ~ NitroAggregator ~ getQuotes ~ data:", data);
        const platformFee = data.bridgeFee.amount
            ? Number(Number(ethers.utils.formatUnits(data.bridgeFee.amount)).toFixed(4))
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
            tx: res?.data?.txn,
            spender: data?.allowanceTo,
        };
    }
}
//# sourceMappingURL=Nitro.aggregator.js.map