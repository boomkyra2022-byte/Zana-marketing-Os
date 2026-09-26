// Marketplace profit calculator — pure functions, no side effects, no
// network calls. Formulas verified line-by-line against KhumMai's own 3
// published worked examples (Shopee fashion ฿500, TikTok lipstick ฿299,
// Lazada household item ฿199 — see khummai.com/shopee-fees,
// /tiktok-shop-fees, /lazada-fees) — every line item matched to the baht
// exactly before this was considered done.
//
// Formula shape is the same across all 3 platforms:
//   totalFees = sum of platform-specific fee lines (commission + tx/payment
//               fee + platform-specific extras)
//   otherCosts = cogs + packCost + adCost   (flat baht, NOT including shipping)
//   netProfit = price - totalFees - otherCosts
//   marginPct = netProfit / price × 100
//
// `customerShipping` (the shipping fee the CUSTOMER pays, not what the
// seller spends on couriers) is used ONLY as part of the Transaction/Order/
// Payment fee base — it never gets subtracted from profit directly. This
// matches every platform's documented Tx-fee base ("ราคา + ค่าส่ง") and
// KhumMai's own worked examples exactly.

import {
  getRates,
  type Platform,
  type Tier,
  SHOPEE_TX_FEE_PCT_PRE_VAT,
  SHOPEE_PLATFORM_FEE_BAHT,
  TIKTOK_TX_FEE_PCT,
  TIKTOK_INFRASTRUCTURE_FEE_BAHT,
  TIKTOK_GROWTH_FEE_CAP_BAHT,
  LAZADA_PAYMENT_FEE_PCT,
  LAZADA_PREMIUM_PACKAGE_PCT
} from './marketplace-fee-data';

export interface BaseCalcInput {
  price: number;
  cost?: number;
  packCost?: number;
  adCost?: number;
  customerShipping?: number;
  category: string;
  tier: Tier;
}

export interface ShopeeCalcInput extends BaseCalcInput {
  xtraParticipant?: boolean;
}

export interface TiktokCalcInput extends BaseCalcInput {
  affiliatePct?: number;
}

export interface LazadaCalcInput extends BaseCalcInput {
  premiumPackage?: boolean;
}

export interface FeeLine {
  label: string;
  amount: number;
  pct: number;
}

export interface CalcResult {
  platform: Platform;
  price: number;
  categoryUsed: string;
  lines: FeeLine[];
  totalFees: number;
  otherCosts: number;
  netProfit: number;
  marginPct: number;
  /** Set when the requested category wasn't found in the rate table — result falls back to the first row of the tier so the UI never silently shows zero. */
  warning?: string;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function pctOfPrice(amount: number, price: number): number {
  if (!price) return 0;
  return round2((amount / price) * 100);
}

function findRate(platform: Platform, tier: Tier, category: string) {
  const rates = getRates(platform, tier);
  const found = rates.find((r) => r.category === category);
  if (found) return { rate: found, warning: undefined as string | undefined };
  return {
    rate: rates[0],
    warning: `ไม่พบหมวด "${category}" ในตาราง ใช้อัตราของ "${rates[0].category}" แทนชั่วคราว`
  };
}

function buildResult(
  platform: Platform,
  price: number,
  categoryUsed: string,
  lines: FeeLine[],
  otherCosts: number,
  warning?: string
): CalcResult {
  const totalFees = round2(lines.reduce((sum, l) => sum + l.amount, 0));
  const netProfit = round2(price - totalFees - otherCosts);
  const marginPct = price ? round2((netProfit / price) * 100) : 0;
  return { platform, price, categoryUsed, lines, totalFees, otherCosts: round2(otherCosts), netProfit, marginPct, warning };
}

export function calcShopeeFees(input: ShopeeCalcInput): CalcResult {
  const { price, cost = 0, packCost = 0, adCost = 0, customerShipping = 0, category, tier, xtraParticipant = false } = input;
  const { rate, warning } = findRate('shopee', tier, category);

  const commission = round2(price * (rate.commissionPct / 100));
  const txFee = round2((price + customerShipping) * (SHOPEE_TX_FEE_PCT_PRE_VAT / 100) * 1.07);
  const platformFee = SHOPEE_PLATFORM_FEE_BAHT;

  const lines: FeeLine[] = [
    { label: `ค่าคอมมิชชั่น (${rate.category})`, amount: commission, pct: pctOfPrice(commission, price) },
    { label: 'Transaction Fee (3% ก่อน VAT × 1.07)', amount: txFee, pct: pctOfPrice(txFee, price) },
    { label: 'Platform Fee', amount: platformFee, pct: pctOfPrice(platformFee, price) }
  ];

  if (xtraParticipant && rate.serviceFeePct) {
    const serviceFee = round2(price * (rate.serviceFeePct / 100));
    lines.push({ label: 'Service Fee (ร้านโค้ดคุ้ม / Xtra)', amount: serviceFee, pct: pctOfPrice(serviceFee, price) });
  }

  return buildResult('shopee', price, rate.category, lines, cost + packCost + adCost, warning);
}

export function calcTiktokFees(input: TiktokCalcInput): CalcResult {
  const { price, cost = 0, packCost = 0, adCost = 0, customerShipping = 0, category, tier, affiliatePct = 0 } = input;
  const { rate, warning } = findRate('tiktok', tier, category);

  const commission = round2(price * (rate.commissionPct / 100));
  const txFee = round2((price + customerShipping) * (TIKTOK_TX_FEE_PCT / 100));
  const growthFeeRaw = price * ((rate.growthFeePct ?? 0) / 100);
  const growthFee = round2(Math.min(growthFeeRaw, TIKTOK_GROWTH_FEE_CAP_BAHT));
  const infraFee = TIKTOK_INFRASTRUCTURE_FEE_BAHT;

  const lines: FeeLine[] = [
    { label: `ค่าคอมมิชชั่น (${rate.category})`, amount: commission, pct: pctOfPrice(commission, price) },
    { label: 'Transaction/Order Fee (3.21%)', amount: txFee, pct: pctOfPrice(txFee, price) },
    { label: `Growth Fee${growthFeeRaw > TIKTOK_GROWTH_FEE_CAP_BAHT ? ' (ชน cap ฿199)' : ''}`, amount: growthFee, pct: pctOfPrice(growthFee, price) },
    { label: 'Infrastructure Fee', amount: infraFee, pct: pctOfPrice(infraFee, price) }
  ];

  if (affiliatePct > 0) {
    const affiliateFee = round2(price * (affiliatePct / 100));
    lines.push({ label: `Affiliate Fee (${affiliatePct}%)`, amount: affiliateFee, pct: pctOfPrice(affiliateFee, price) });
  }

  return buildResult('tiktok', price, rate.category, lines, cost + packCost + adCost, warning);
}

export function calcLazadaFees(input: LazadaCalcInput): CalcResult {
  const { price, cost = 0, packCost = 0, adCost = 0, customerShipping = 0, category, tier, premiumPackage = false } = input;
  const { rate, warning } = findRate('lazada', tier, category);

  const commission = round2(price * (rate.commissionPct / 100));
  const paymentFee = round2((price + customerShipping) * (LAZADA_PAYMENT_FEE_PCT / 100));

  const lines: FeeLine[] = [
    { label: `MSF Commission (${rate.category})`, amount: commission, pct: pctOfPrice(commission, price) },
    { label: 'Payment Fee (3.21%)', amount: paymentFee, pct: pctOfPrice(paymentFee, price) }
  ];

  if (premiumPackage) {
    const ppFee = round2(price * (LAZADA_PREMIUM_PACKAGE_PCT / 100));
    lines.push({ label: 'Premium Package (8.56%)', amount: ppFee, pct: pctOfPrice(ppFee, price) });
  }

  return buildResult('lazada', price, rate.category, lines, cost + packCost + adCost, warning);
}
