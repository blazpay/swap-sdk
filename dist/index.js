import { OneInchAggregator, SymbiosisAggregator, } from "./aggregators/index.js";
import aggregatorFactory from "./aggregator.factory.js";
import { AGGREGATORS } from "./enums/aggregator.enum.js";
export class TradeManager {
    aggregatorFactory;
    constructor() {
        this.aggregatorFactory = aggregatorFactory;
        this.aggregatorFactory.register(AGGREGATORS.ONE_INCH, new OneInchAggregator());
        // this.aggregatorFactory.register(AGGREGATORS.NITRO, new NitroAggregator());
        this.aggregatorFactory.register(AGGREGATORS.SYMBIOSIS, new SymbiosisAggregator());
        // this.aggregatorFactory.register(
        //   AGGREGATORS.OPEN_OCEAN,
        //   new OpenOceanAggregator()
        // );
        // this.aggregatorFactory.register(AGGREGATORS.UNIZEN, new UnizenAggregator());
        // this.aggregatorFactory.register(
        //   AGGREGATORS.CHANGE_NOW,
        //   new ChangeNowAggregator()
        // );
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
        const handleLastQuote = (isLastQuote) => {
            params.onLastQuote(isLastQuote);
        };
        this.aggregatorFactory.getQuotes(quoteParams, handleQuote, handleLastQuote);
    }
}
//# sourceMappingURL=index.js.map