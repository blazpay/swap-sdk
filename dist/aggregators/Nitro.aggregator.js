import { ethers } from "ethers";
import { apiCall } from "../utils/axios.js";
import Base from "./base.aggregator.js";
import { AGGREGATORS } from "../enums/aggregator.enum.js";
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
        const platformFee = data.bridgeFee.amount
            ? Number(Number(ethers.utils.formatUnits(data.bridgeFee.amount)).toFixed(4))
            : 0;
        return {
            aggregator: AGGREGATORS.NITRO,
            route: "nitro",
            amount: Number(Number(ethers.utils.formatUnits(data.destination.tokenAmount, data.destination.asset.decimals)).toFixed(4)),
            usdAmount: 0,
            networkFee: 0,
            platformFee,
            priceImpact: data.source.priceImpact,
            slippage: data.slippageTolerance,
        };
    }
}
//# sourceMappingURL=Nitro.aggregator.js.map