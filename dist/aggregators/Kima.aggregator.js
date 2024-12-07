import { ethers } from "ethers";
import { apiCall } from "../utils/axios.js";
import Quote from "../utils/quote.js";
import Base from "./base.aggregator.js";
import { AGGREGATORS } from "../enums/aggregator.enum.js";
import { v4 as uuidv4 } from "uuid";
import { ChainNameKima } from "../utils/constants.js";
export default class KimaSwapAggregator extends Base {
    name;
    BASE_URL;
    FEE_URL;
    solSpender;
    trxSpender;
    evmSpender;
    constructor() {
        super();
        this.name = AGGREGATORS.KIMA;
        this.BASE_URL = "http://localhost:3001";
        this.FEE_URL = "https://fee.kima.finance/fee/";
        this.solSpender = "5tvyUUqPMWVGaVsRXHoQWqGw6h9uifM45BHCTQgzwSdr";
        this.trxSpender = "t3JFtrr3JVedB1oH6v1AUNSqqFZk4E5U";
        this.evmSpender = "0x9a721c664f9d69e4da24f91386086fbd81da23c1";
    }
    async getQuotes(params) {
        if (!params?.fromToken.symbol?.includes(params?.toToken.symbol) ||
            !params?.toToken.symbol?.includes(params?.fromToken.symbol))
            throw new Error("Kima only converts same tokens from one chain to another");
        const platformFee = 0;
        // = await this.calcServiceFee(
        //   ChainNameKima[params.fromChain.name as keyof typeof ChainNameKima],
        //   ChainNameKima[params.toChain.name as keyof typeof ChainNameKima]
        // );
        let networkFee = 0;
        // platformFee !== 0 &&
        // (await this.getServiceFee(
        //   ChainNameKima[params.fromChain.name as keyof typeof ChainNameKima]
        // ));
        const query = {
            tokenIn: params.fromToken.address,
            tokenOut: params.toToken.address,
            amountIn: ethers.utils
                .parseUnits(String(params.amount), params.fromToken.decimals)
                .toString(),
        };
        const meta = {
            id: uuidv4(),
            aggregator: AGGREGATORS.KIMA,
            route: "Kima",
            amount: Number((params?.amount - (platformFee - Number(networkFee))).toFixed(6)),
            usdAmount: 0,
            networkFee: `${Number(networkFee)?.toFixed(6)} ${params?.fromToken?.symbol}`,
            platformFee: `${Number(platformFee - Number(networkFee))?.toFixed(6)} ${params?.toToken?.symbol}`,
            priceImpact: 0,
            slippage: params.slippage || 0.5,
            allowanceTo: params?.fromToken?.symbol === "SOL"
                ? this.solSpender
                : params?.fromToken?.symbol === "TRX"
                    ? this.trxSpender
                    : this.evmSpender,
        };
        const quote = new Quote({}, meta, {
            fromChain: {
                id: params.fromChain.id,
                name: params.fromChain.name.toLowerCase(),
            },
            toChain: {
                id: params.toChain.id,
                name: params.toChain.name.toLowerCase(),
            },
            slippageTolerance: (params.slippage || 0.5) * 100,
            srcWalletAddress: params.srcWalletAddress,
            dstWalletAddress: params.dstWalletAddress,
            quotePayload: query,
        });
        return quote;
    }
    async getTransactionData(data, restProps) {
        console.log("🚀 ~ KimaSwapAggregator ~ data:", data);
        console.log("🚀 ~ KimaSwapAggregator ~ restProps:", restProps);
        const payload = {
            routeSummary: data?.routeSummary,
            sender: restProps.srcWalletAddress,
            recipient: restProps?.dstWalletAddress || restProps.srcWalletAddress,
            slippageTolerance: 50,
            source: "blazpay",
        };
        const body = {
            originAddress: restProps?.quotePayload?.tokenIn,
            originChain: "POL",
            targetAddress: restProps?.quotePayload?.tokenOut,
            targetChain: "ARB",
            originSymbol: "USDT",
            targetSymbol: "USDT",
            amount: restProps?.quotePayload?.amountIn,
            fee: 0.01,
            htlcCreationHash: "",
            htlcCreationVout: 0,
            htlcExpirationTimestamp: "0",
            htlcVersion: "",
            senderPubKey: "",
        };
        console.log("🚀 ~ KimaSwapAggregator ~ body:", body);
        const res = await apiCall({
            method: "POST",
            url: this.BASE_URL + "/auth",
            headers: {
                "Content-Type": "application/json",
            },
            data: body,
            withCredentials: true,
        });
        let resBridge;
        try {
            resBridge = await apiCall({
                method: "POST",
                url: this.BASE_URL + "/submit",
                headers: {
                    "Content-Type": "application/json",
                },
                data: body,
                withCredentials: true,
            });
        }
        catch (error) {
            console.log("🚀 ~ KimaSwapAggregator ~ error:", error);
        }
        const txData = res?.data;
        const tx = {
            data: txData?.data,
            from: restProps.srcWalletAddress,
            to: txData?.routerAddress,
            value: this.isNativeAddresss(restProps.quotePayload.tokenOut)
                ? 0
                : txData?.amountIn,
            gasLimit: Number(txData?.gas),
        };
        return {
            tx: res.headers,
            spender: data?.routerAddress,
            metaData: resBridge,
        };
    }
    async calcServiceFee(sourceChain, targetChain) {
        if (targetChain === ChainNameKima.btc) {
            return 0;
        }
        const [sourceFee, targetFee] = await Promise.all([
            this.getServiceFee(sourceChain),
            this.getServiceFee(targetChain),
        ]);
        const fee = sourceFee + targetFee;
        return fee;
    }
    async getServiceFee(chain) {
        console.log(`${this.FEE_URL}${chain}`, "url kima fees");
        const result = await fetch(`${this.FEE_URL}${chain}`).then((res) => res.json());
        const { fee } = result;
        const [amount] = fee.split("-");
        return +amount;
    }
}
//# sourceMappingURL=Kima.aggregator.js.map