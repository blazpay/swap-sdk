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
        for (const aggregator of this.aggregators.values()) {
            try {
                const quote = await aggregator.getQuotes(params);
                cb(quote);
                onLastQuote(false);
            }
            catch (error) {
                console.error(`Error from ${aggregator.constructor.name}:`, error);
            }
        }
        onLastQuote(true);
    }
}
const aggregatorFactory = new AggregatorFactory();
export default aggregatorFactory;
//# sourceMappingURL=aggregator.factory.js.map