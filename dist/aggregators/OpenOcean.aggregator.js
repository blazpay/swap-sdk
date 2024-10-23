import { BigNumber, ethers } from "ethers";
import { Base } from "./index.js";
import { apiCall } from "../utils/axios.js";
import { AGGREGATORS } from "../enums/aggregator.enum.js";
export default class OpenOceanAggregator extends Base {
    BASE_URL;
    slippage;
    constructor() {
        super();
        this.BASE_URL = "https://api-v2.blazpay.com/api/defi/openocean";
        this.slippage = 0.5;
    }
    async getQuotes(params) {
        this.setSenderAddress(params.srcWalletAddress);
        const query = {
            chain: params.fromChain.id,
            inTokenAddress: params.fromToken.address,
            outTokenAddress: params.toToken.address,
            amount: Number(params.amount),
            slippage: 0.5,
            gasPrice: (await this.getGasPrice(params.fromChain.id))?.standard || 60,
            account: params.srcWalletAddress,
        };
        const res = await apiCall({
            method: "POST",
            url: this.BASE_URL,
            params: query,
        });
        const data = res?.data?.data;
        const swap = async ({ provider }) => {
            const signer = await provider.getSigner();
            await this.setAllowance(params.fromToken.address, data?.to, provider, params.fromChain.id, BigNumber.from(ethers.utils
                .parseUnits(String(params.amount), params.fromToken.decimals)
                .toString()), "openocean");
            const tx = await signer.sendTransaction({
                data: data?.data,
                from: data?.from,
                to: data?.to,
                gasLimit: data?.estimatedGas,
                gasPrice: data?.gasPrice * 3,
                value: data?.value ? data?.value : data?.inAmount,
            });
            await tx.wait();
            return tx;
        };
        const swapAmount = ethers.utils
            .formatUnits(data?.outAmount, data?.outToken?.decimals)
            .toString();
        return {
            aggregator: AGGREGATORS.OPEN_OCEAN,
            route: "OpenOcean",
            amount: Number(Number(swapAmount).toFixed(4)),
            usdAmount: data?.outToken?.usd,
            networkFee: 0,
            platformFee: 0,
            priceImpact: data?.price_impact?.replace("%", ""),
            slippage: this.slippage,
        };
    }
}
//# sourceMappingURL=OpenOcean.aggregator.js.map