class ProviderFactory {
  providers;

  constructor() {
    this.providers = new Map();
  }

  getAggregator(name: string) {
    return this.providers.get(name);
  }

  register(name: string, aggregator: any) {
    this.providers.set(name, aggregator);
  }
}
