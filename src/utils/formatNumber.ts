/**
 * Formats a number with Swiss-style thousands separators (apostrophes)
 * @param value - The number to format
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string with apostrophes as thousands separators
 */
export function formatSwissNumber(value: number, decimals: number = 2): string {
  // First, format with fixed decimals
  const parts = value.toFixed(decimals).split('.');

  // Add apostrophes as thousands separators
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, "'");

  // Join back with decimal point
  return parts.join('.');
}

/**
 * Renders a token-amount string at its natural precision: strip trailing
 * zeros from the fractional part and drop a dangling decimal point. Input is
 * expected to be a decimal string already (e.g. the output of
 * ethers.formatUnits or a sats/1e8 divide for BTC).
 *
 * Examples:
 *   "100.500000"   -> "100.5"
 *   "100.000000"   -> "100"
 *   "0.15906905"   -> "0.15906905"
 *   "1.230000000"  -> "1.23"
 */
export function formatTokenAmount(value: string): string {
  if (!value.includes(".")) return value;
  const trimmed = value.replace(/0+$/, "");
  return trimmed.endsWith(".") ? trimmed.slice(0, -1) : trimmed;
}