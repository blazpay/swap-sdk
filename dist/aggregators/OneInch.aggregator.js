import { BigNumber, ethers } from "ethers";
import { apiCall } from "../utils/axios.js";
import { Base } from "./index.js";
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
        const quote = await apiCall({
            method: "POST",
            url: this.BASE_URL,
            data: { path: `/swap/v6.0/${params.fromChain.id}/quote`, query },
        });
        const swapAmount = ethers.utils.formatUnits(quote?.dstAmount, quote?.dstToken?.decimals);
        const swap = async ({ provider, receiver, slippageTolerance = 0.1, }) => {
            const signer = await provider.getSigner();
            const walletAddress = await signer.getAddress();
            const spender = await this.get1InchSepender(Number(params.fromChain.id));
            await this.setAllowance(params.fromToken.address, spender, provider, params.fromChain.id, BigNumber.from(ethers.utils
                .parseUnits(String(params.amount), params.fromToken.decimals)
                .toString()), "1inch");
            const res = await apiCall({
                url: "/defi/1inch",
                method: "POST",
                data: {
                    query: {
                        ...query,
                        includeTokensInfo: true,
                        includeProtocols: true,
                        includeGas: true,
                        from: walletAddress,
                        slippage: slippageTolerance,
                        receiver: receiver || walletAddress,
                    },
                    path: `/swap/v6.0/${params.fromChain.id}/swap`,
                },
            });
            const txdata = res.data.tx;
            const tx = await signer.sendTransaction({
                gasLimit: 500000,
                data: txdata.data,
                from: txdata.from,
                to: txdata.to,
                gasPrice: txdata.gasPrice,
                value: txdata.value,
            });
            await tx.wait();
            return tx;
        };
        return {
            source: "One Inch",
            route: "One Inch",
            amount: Number(Number(swapAmount).toFixed(4)),
            usdAmount: 0,
            networkFee: 0,
            platformFee: 0,
            priceImpact: 0,
            slippage: 0,
            swap,
        };
    }
    async get1InchSepender(chainId) {
        try {
            const { data } = await apiCall({
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