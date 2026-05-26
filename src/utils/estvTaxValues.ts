// Official year-end tax values published by the Swiss Federal Tax Administration
// (Eidgenössische Steuerverwaltung, ESTV) via the ICTax price list at
// https://www.estv.admin.ch/de/kurslisten-ictax. These are the binding CHF
// valuations for the wealth tax declaration as of the respective record date.
//
// Source per record date is documented inline. Add new years as ESTV publishes
// them (typically a few weeks after year end).

export const ESTV_BTC_CHF: Record<string, number> = {
  // ICTax Kursliste 2025 — closing rate per 31.12.2025
  "2025-12-31": 69571.988489,
};

export function getEstvBtcChf(date: string): number | undefined {
  return ESTV_BTC_CHF[date];
}
