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