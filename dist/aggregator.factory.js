export class AggregatorFactory {
    aggregators;
    constructor() {
        this.aggregators = new Map();
    }
    register(name, aggregator) {
        this.aggregators.set(name, aggregator);
    }
    getAggregator(name) {
        return this.aggregators.get(name);
    }
    async getQuotes(params, cb, onLastQuote) {
        const promises = Array.from(this.aggregators.values())
            .filter((agg) => params.type === "SWAP"
            ? !params.excludeSwap?.includes(agg.name)
            : !params.excludeBridge?.includes(agg.name))
            .map(async (aggregator) => {
            try {
                const quote = await aggregator.getQuotes(params);
                cb(quote);
            }
            catch (error) {
                if (error?.request?.data) {
                    console.error(`Error from ${aggregator.constructor.name}:`, error?.request?.data);
                }
                else if (error?.response?.data) {
                    console.error(`Error from ${aggregator.constructor.name}:`, error?.response?.data);
                }
                else {
                    console.error(`Error from ${aggregator.constructor.name}:`, error);
                }
            }
        });
        await Promise.all(promises);
        onLastQuote(true);
    }
    async getStatus(queryStatusParam) {
        await Promise.all(queryStatusParam?.map((value) => {
            const aggregator = this.getAggregator(value?.provider);
            return aggregator.getTxStatus(value.chainId, value.hash);
        }));
    }
}
const aggregatorFactory = new AggregatorFactory();
export default aggregatorFactory;
//# sourceMappingURL=aggregator.factory.js.map