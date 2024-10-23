import aggregatorFactory from "../aggregator.factory.js";
export default class Quote {
    data;
    meta;
    restProps;
    constructor(data, meta, restProps) {
        this.data = data;
        this.meta = meta;
        this.restProps = restProps;
    }
    getMeta() {
        return { id: "random_id", ...this.meta };
    }
    async getTransactionData() {
        const aggregator = aggregatorFactory.getAggregator(this.meta.aggregator);
        return await aggregator.getTransactionData(this.restProps);
    }
    toJSON() {
        return this.data;
    }
}
//# sourceMappingURL=quote.js.map