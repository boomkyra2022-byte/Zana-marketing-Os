// Pure math for the ROAS (Return On Ad Spend) Calculator — explicit user
// request: "ต้องการเพิ่มโปรแกรมคำนวณ ROAS Facebok เข้าไปด้วย" with a worked example
// (price 350, cost 120 → break-even ROAS ~1.52-1.53x).
//
// Two formulas exist for break-even ROAS and they should agree:
//   1) 1 / margin,           where margin = profit / price
//   2) price / profit
// These are mathematically identical (1 / (profit/price) = price/profit).
// The user's own worked example showed a small discrepancy (1.53 vs 1.52)
// because method 1 was computed using a margin ROUNDED to 65% first, instead
// of the exact margin. To avoid that rounding trap, this module always
// computes break-even ROAS directly from price/profit (unrounded) — margin%
// is still shown to the user for context, but never fed back into the ROAS
// formula after rounding.
//
// No external rate tables needed (unlike lib/pricing/, which mirrors real
// marketplace fee schedules) — ROAS math is self-contained, so this file has
// no sibling "data" module.

export interface BreakEvenResult {
  profitPerUnit: number;
  marginPct: number; // 0-100, for display only
  breakEvenRoas: number; // e.g. 1.52 means "ROAS must be at least 1.52x to break even"
}

export interface AdPerformanceResult extends BreakEvenResult {
  actualRoas: number | null; // null when adSpend is 0 (undefined ROAS)
  grossProfitFromRevenue: number; // revenue's implied profit BEFORE subtracting ad spend
  netProfit: number; // grossProfitFromRevenue - adSpend — the real bottom line
  isProfitable: boolean;
  roasGapVsBreakEven: number | null; // actualRoas - breakEvenRoas (positive = profitable)
}

// price and cost are per-unit (or blended average selling price / average
// cost, if the user is looking at a whole campaign rather than one SKU).
export function calcBreakEven(price: number, cost: number): BreakEvenResult {
  const safePrice = Math.max(0, price);
  const safeCost = Math.max(0, cost);
  const profitPerUnit = safePrice - safeCost;
  const marginPct = safePrice > 0 ? (profitPerUnit / safePrice) * 100 : 0;
  // Guard against profitPerUnit <= 0 (selling at or below cost — ROAS can
  // never make this profitable, no matter how high). Returning Infinity
  // communicates that honestly instead of a misleading negative/zero number.
  const breakEvenRoas = profitPerUnit > 0 ? safePrice / profitPerUnit : Infinity;
  return { profitPerUnit, marginPct, breakEvenRoas };
}

// adRevenue = total revenue attributed to the ad spend (Facebook Ads Manager
// "Purchase conversion value" / "Website purchases conversion value", or the
// user's own sales-from-ads tracking). adSpend = total ad spend for that
// same period ("Amount spent").
export function calcAdPerformance(price: number, cost: number, adSpend: number, adRevenue: number): AdPerformanceResult {
  const base = calcBreakEven(price, cost);
  const safeSpend = Math.max(0, adSpend);
  const safeRevenue = Math.max(0, adRevenue);

  const actualRoas = safeSpend > 0 ? safeRevenue / safeSpend : null;

  // Revenue came from selling units at this price/cost ratio, so the
  // portion of revenue that is gross profit (before ad cost) scales by the
  // same margin — this lets us turn "ad revenue" into "real profit" instead
  // of just comparing ROAS numbers in the abstract.
  const marginFraction = base.marginPct / 100;
  const grossProfitFromRevenue = safeRevenue * marginFraction;
  const netProfit = grossProfitFromRevenue - safeSpend;

  return {
    ...base,
    actualRoas,
    grossProfitFromRevenue,
    netProfit,
    isProfitable: netProfit > 0,
    roasGapVsBreakEven: actualRoas !== null && Number.isFinite(base.breakEvenRoas) ? actualRoas - base.breakEvenRoas : null
  };
}
