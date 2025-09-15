export enum EvmBlockchain {
  ETH = "Ethereum",
  BSC = "BinanceSmartChain",
  OPT = "Optimism",
  ARB = "Arbitrum",
  POLYGON = "Polygon",
  BASE = "Base",
  HAQQ = "Haqq",
  GNOSIS = "Gnosis",
};

export interface Asset {
  id: number;
  name: string;
  blockchain: string;
  chainId?: string; // token contract address
  decimals?: number;
}

export interface EvmAsset extends Asset {
  blockchain: EvmBlockchain;
}

