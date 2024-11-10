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
            timeout: 20000,
            headers: {
                Accept: "application/json, text/plain, */*",
                Origin: "https://defi.blazpay.com",
                Referer: "https://defi.blazpay.com",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
            },
        });
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
        const swap = async ({ provider, receiver, slippageTolerance = 0.5, }) => {
            const response = await apiCall({
                url: this.BASE_URL + "/v2/transaction",
                method: "POST",
                data: {
                    ...data,
                    slippageTolerance,
                    senderAddress: this.senderTronNitro || this.senderAddress,
                    receiverAddress: receiver || this.senderAddress,
                },
                timeout: 20000,
            });
            // await this.setAllowance(
            //   params.fromToken.address,
            //   data.allowanceTo,
            //   provider,
            //   params.fromChain.id,
            //   BigNumber.from(data.source.tokenAmount),
            //   "nitro"
            // );
            // const { walletAddress, tx } = await this.triggerContract(
            //   params.fromChain.id,
            //   provider,
            //   response.data.txn
            // );
            return "";
        };
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