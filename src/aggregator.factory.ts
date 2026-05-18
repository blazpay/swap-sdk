import { IQuoteParams } from "./@types/aggregator.type.js";
import { AGGREGATORS } from "./enums/aggregator.enum.js";
import Quote from "./utils/quote.js";
import { IQueryStatus } from "./utils/types.js";

export class AggregatorFactory {
  private aggregators: Map<string, any>;

  constructor() {
    this.aggregators = new Map();
  }

  register(name: string, aggregator: any) {
    this.aggregators.set(name, aggregator);
  }

  getAggregator(name: string) {
    return this.aggregators.get(name);
  }

  async getQuotes(
    params: IQuoteParams,
    cb: (quote: Quote) => void,
    onLastQuote: (isLastQuote: boolean) => void
  ) {
    const promises = Array.from(this.aggregators.values())
      .filter((agg) =>
        params.type === "SWAP"
          ? !params.excludeSwap?.includes(agg.name)
          : !params.excludeBridge?.includes(agg.name)
      )
      .map(async (aggregator) => {
        try {
          const quote = await aggregator.getQuotes(params);
          // Every quote runs through BlazpayRelayer.executeMetaTransactionSwap,
          // which charges a flat 0.1% (inPercentFee = 10/10000) on the input.
          // Stamp it here so the FE can display it consistently regardless of
          // which aggregator generated the route. Compute from the input side
          // (params.amount × fromToken.priceUSD) — aggregator-reported USD
          // figures are unreliable (OKX/Nordstern return 0).
          if (quote && quote.meta) {
            const inputUsd =
              Number(params.amount) * Number(params.fromToken?.priceUSD ?? 0) ||
              Number((quote.meta as any).fromAmountUsd) ||
              Number(quote.meta.usdAmount) ||
              0;
            quote.meta.blazpayFeePercent = 0.001;
            quote.meta.blazpayFeeUsd = inputUsd * 0.001;
          }
          cb(quote);
        } catch (error: any) {
          if (error?.request?.data) {
            console.error(
              `Error from ${aggregator.constructor.name}:`,
              error?.request?.data
            );
          } else if (error?.response?.data) {
            console.error(
              `Error from ${aggregator.constructor.name}:`,
              error?.response?.data
            );
          } else {
            console.error(`Error from ${aggregator.constructor.name}:`, error?.message);
          }
        }
      });

    await Promise.all(promises);
    onLastQuote(true);
  }
  

  async getStatus(queryStatusParam: IQueryStatus[]): Promise<any> {
    const res = await Promise.all(queryStatusParam?.map((value: IQueryStatus) => {
      const aggregator = this.getAggregator(value?.provider)
      return aggregator?.getTxStatus(value.chainId, value.hash);
    }))
    return res;
  }
}

const aggregatorFactory = new AggregatorFactory();

export default aggregatorFactory;
