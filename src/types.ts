export type Currency = "CHF" | "EUR" | "USD";

export enum EvmBlockchain {
  ETH = "Ethereum",
  BSC = "BinanceSmartChain",
  OPT = "Optimism",
  ARB = "Arbitrum",
  POLYGON = "Polygon",
  BASE = "Base",
  HAQQ = "Haqq",
  GNOSIS = "Gnosis",
}

export enum NonEvmBlockchain {
  BTC = "Bitcoin",
}

export type Blockchain = EvmBlockchain | NonEvmBlockchain;

export interface Asset {
  id: number;
  name: string;
  blockchain: string;
  chainId?: string; // token contract address (EVM only)
  decimals?: number;
  type?: "Coin" | "Token";
  sortOrder?: number; // DFX display priority — 1..9 = curated assets, 99 = rest
  comingSoon?: boolean; // DFX flags pre-launch tokens — we exclude these from the picker
}

export interface EvmAsset extends Asset {
  blockchain: EvmBlockchain;
}

export interface BtcAsset extends Asset {
  blockchain: NonEvmBlockchain.BTC;
}

export type SupportedAsset = EvmAsset | BtcAsset;

export const isEvmBlockchain = (blockchain: string): blockchain is EvmBlockchain =>
  Object.values(EvmBlockchain).includes(blockchain as EvmBlockchain);

export const isBtcBlockchain = (blockchain: string): blockchain is NonEvmBlockchain.BTC =>
  blockchain === NonEvmBlockchain.BTC;

export const isSupportedBlockchain = (blockchain: string): blockchain is Blockchain =>
  isEvmBlockchain(blockchain) || isBtcBlockchain(blockchain);
