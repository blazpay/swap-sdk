import { NitroAggregator, OneInchAggregator, OpenOceanAggregator, SymbiosisAggregator, UnizenAggregator, } from "./aggregators/index.js";
export class TradeManager {
    oneInchAggregator;
    nitroAggregator;
    symbiosisAggregator;
    openOceanAggregator;
    unizenAggregator;
    constructor() {
        this.oneInchAggregator = new OneInchAggregator();
        this.nitroAggregator = new NitroAggregator();
        this.symbiosisAggregator = new SymbiosisAggregator();
        this.openOceanAggregator = new OpenOceanAggregator();
        this.unizenAggregator = new UnizenAggregator();
    }
    async getQuotes(params) {
        const quoteParams = {
            fromChain: params.fromChain,
            toChain: params.toChain,
            fromToken: params.fromToken,
            toToken: params.toToken,
            amount: params.amount,
            type: params.type,
            srcWalletAddress: params.srcWalletAddress,
            dstWalletAddress: params?.dstWalletAddress,
        };
        function handleQuote(quote) {
            params.onNewQuote(quote);
        }
        if (params.type === "SWAP") {
            this.oneInchAggregator
                .getQuotes(quoteParams)
                .then((quote) => handleQuote(quote))
                .catch((error) => console.error("error: 1inch ", error));
        }
        this.nitroAggregator
            .getQuotes(quoteParams)
            .then((quote) => handleQuote(quote))
            .catch((error) => console.error("error: nitro ", error));
        this.symbiosisAggregator
            .getQuotes(quoteParams)
            .then((quote) => handleQuote(quote))
            .catch((error) => console.error("error: symbiosis ", error));
        this.openOceanAggregator
            .getQuotes(quoteParams)
            .then((quote) => handleQuote(quote))
            .catch((error) => console.error("error: open-ocean ", error));
        this.unizenAggregator
            .getQuotes(quoteParams)
            .then((quote) => handleQuote(quote))
            .catch((error) => console.error("error: unizen ", error));
    }
}
//# sourceMappingURL=index.js.map