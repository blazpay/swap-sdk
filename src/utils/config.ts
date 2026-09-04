export type SDKConfig = {
  /**
   * Base URL for any backend services this SDK talks to (if applicable).
   * Example: "https://api.example.com/api/defi"
   */
  baseApiUrl?: string;

  /**
   * OpenOcean API key (required for OpenOcean routes).
   */
  openOceanApiKey?: string;

  /**
   * Unizen API key (if required by your Unizen status endpoint).
   */
  unizenApiKey?: string;

  /**
   * Rango Exchange API key. Falls back to the public demo key when absent.
   */
  rangoApiKey?: string;

  /**
   * Houdini Swap partner API key (required for private-mode routes).
   */
  houdiniApiKey?: string;

  /**
   * Ondo Stocks API key. Presence is what ENABLES the Ondo issuer
   * primary-market provider: TradeManager skips registering it when this is
   * absent, so a deployment without credentials quotes exactly as before
   * rather than emitting a provider that always errors.
   *
   * Only the backend needs this — the browser reaches Ondo through the
   * /defi/ondo proxy and never holds the key.
   */
  ondoApiKey?: string;
};

let config: SDKConfig = {};

export function configure(partial: SDKConfig) {
  config = { ...config, ...partial };
}

export function getConfig(): Readonly<SDKConfig> {
  return config;
}
