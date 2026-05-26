import { EvmBlockchain, type Blockchain } from "../types";

// Human-friendly labels for the supported chains. The enum values double as
// API/URL identities and stay unchanged; the labels only affect what the user
// sees. Chains without an override fall back to their identity string.
const BLOCKCHAIN_LABEL: Partial<Record<Blockchain, string>> = {
  [EvmBlockchain.BSC]: "BNB Smart Chain",
};

export function blockchainLabel(chain: Blockchain): string {
  return BLOCKCHAIN_LABEL[chain] ?? chain;
}
