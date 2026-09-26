// Marketplace fee rate tables — Shopee, TikTok Shop, Lazada (Thailand, 2026).
//
// Source: KhumMai (https://khummai.com), published under CC BY 4.0.
// Downloaded from https://khummai.com/data/khummai-fee-rates-2026-08.csv on
// 2026-09-26. KhumMai's own rates are compiled directly from each
// platform's official Seller Centre / University documentation (Shopee
// Help Center article 77254, TikTok Shop University, Lazada Seller Center)
// and cross-checked against 120+ real settlement statements — see
// https://khummai.com/about#transparency. Attribution required by the
// license is kept here and in the calculator UI's footer.
//
// Effective dates: Shopee 2026-08-04 · TikTok Shop 2026-07-05 · Lazada 2026-08-01
// (Lazada's MSF table below is the ANNOUNCED 1 Aug rate set, already in effect).
//
// IMPORTANT — this is a snapshot, not a live feed. Platforms revise these
// rates every few months (see khummai.com/fee-updates for their change log).
// Re-pull the CSV and update this file when ZANA's actual invoiced fees
// stop matching these numbers — there is no automatic sync.
//
// All commission/service/growth/premium-package rates below are ALREADY
// VAT-inclusive (7%), exactly as published by KhumMai — do not multiply by
// 1.07 again. Transaction/Tx/Payment/Order fees are the one exception: see
// calculator.ts, which applies the ×1.07 explicitly where the platform
// quotes a pre-VAT rate.

export type Platform = 'shopee' | 'tiktok' | 'lazada';

// Shopee: 'non-mall' | 'mall'. TikTok: 'marketplace' | 'mall'. Lazada:
// 'marketplace' | 'lazmall'. Kept as a single union since the UI only ever
// needs "is this the premium/mall tier or not" per platform.
export type Tier = 'standard' | 'premium';

export interface FeeCategoryRate {
  category: string;
  /** Commission % (Shopee/TikTok/Lazada core commission), VAT-inclusive. */
  commissionPct: number;
  /** Shopee only — Service Fee % for ร้านโค้ดคุ้ม (Xtra) participants, VAT-inclusive. */
  serviceFeePct?: number;
  /** TikTok only — Growth Fee % (capped at ฿199/item), VAT-inclusive. */
  growthFeePct?: number;
}

export const SHOPEE_RATES: Record<Tier, FeeCategoryRate[]> = {
  standard: [
    { category: 'อิเล็กทรอนิกส์ (ต่ำสุด)', commissionPct: 7.49, serviceFeePct: 7.49 },
    { category: 'อิเล็กทรอนิกส์ (สูงสุด)', commissionPct: 16.05, serviceFeePct: 8.56 },
    { category: 'แฟชั่น', commissionPct: 17.12, serviceFeePct: 8.56 },
    { category: 'FMCG (อาหาร/ของใช้/ความงาม)', commissionPct: 16.05, serviceFeePct: 8.56 },
    { category: 'ไลฟ์สไตล์ (ต่ำสุด)', commissionPct: 11.77, serviceFeePct: 7.49 },
    { category: 'ไลฟ์สไตล์ (สูงสุด)', commissionPct: 16.05, serviceFeePct: 8.56 },
    { category: 'สินค้าอื่นๆ', commissionPct: 16.05, serviceFeePct: 8.56 },
    { category: 'ทอง & แพลตตินั่ม', commissionPct: 8.03, serviceFeePct: 5.35 },
    { category: 'เงิน (โลหะมีค่า)', commissionPct: 14.45, serviceFeePct: 7.49 },
    { category: 'เครื่องประดับ (แหวน/สร้อย/กำไล)', commissionPct: 13.38, serviceFeePct: 7.49 },
    { category: 'เครื่องประดับมีมูลค่า', commissionPct: 15.52, serviceFeePct: 8.56 },
    { category: 'มือถือ/แท็บเล็ต/แล็ปท็อป', commissionPct: 7.49, serviceFeePct: 7.49 },
    { category: 'เครื่องใช้ไฟฟ้าใหญ่ (ตู้เย็น/ซักผ้า)', commissionPct: 11.24, serviceFeePct: 7.49 },
    { category: 'คอมพิวเตอร์ (จอ/ชิ้นส่วน)', commissionPct: 8.56, serviceFeePct: 7.49 },
    { category: 'คอมพิวเตอร์ (จัดเก็บข้อมูล/ปริ้นเตอร์)', commissionPct: 11.77, serviceFeePct: 7.49 },
    { category: 'คอมพิวเตอร์ (อุปกรณ์ต่อพ่วง/เน็ตเวิร์ก)', commissionPct: 15.52, serviceFeePct: 8.56 },
    { category: 'เกม (แผ่น/ตลับ/เครื่องเกม)', commissionPct: 13.38, serviceFeePct: 8.56 },
    { category: 'กล้องวงจรปิด/โดรน/ซอฟต์แวร์', commissionPct: 16.05, serviceFeePct: 8.56 },
    { category: 'หนังสือ (การ์ตูน/เด็ก/ธุรกิจ/ภาษา)', commissionPct: 14.45, serviceFeePct: 7.49 },
    { category: 'เครื่องประดับ (เพชร/หยก เพื่อการลงทุน)', commissionPct: 16.59, serviceFeePct: 8.56 },
    { category: 'ยานยนต์/มอเตอร์ไซค์ (ตัวรถ)', commissionPct: 10.17, serviceFeePct: 7.49 },
    { category: 'เครื่องเสียง/โปรเจคเตอร์/เครื่องใช้ไฟฟ้าในบ้าน', commissionPct: 15.52, serviceFeePct: 8.56 },
    { category: 'ทีวีและอุปกรณ์', commissionPct: 11.77, serviceFeePct: 8.56 },
    { category: 'ทีวี (ตัวเครื่อง)', commissionPct: 8.56, serviceFeePct: 7.49 },
    { category: 'คีย์บอร์ด/เมาส์/กราฟิกแท็บเล็ต', commissionPct: 14.45, serviceFeePct: 8.56 },
    { category: 'อุปกรณ์สวมใส่ (สมาร์ตวอทช์/VR/GPS)', commissionPct: 14.45, serviceFeePct: 7.49 },
    { category: 'เครื่องทำความร้อน/เครื่องทำน้ำอุ่น', commissionPct: 13.38, serviceFeePct: 7.49 },
    { category: 'อุปกรณ์เสริมโดรน', commissionPct: 14.98, serviceFeePct: 8.56 },
    { category: 'ซิมการ์ด', commissionPct: 13.91, serviceFeePct: 7.49 }
  ],
  premium: [
    { category: 'อิเล็กทรอนิกส์ (ต่ำสุด)', commissionPct: 7.49, serviceFeePct: 7.49 },
    { category: 'อิเล็กทรอนิกส์ (สูงสุด)', commissionPct: 19.26, serviceFeePct: 8.56 },
    { category: 'แฟชั่น', commissionPct: 19.26, serviceFeePct: 8.56 },
    { category: 'FMCG (อาหาร/ของใช้/ความงาม)', commissionPct: 19.26, serviceFeePct: 8.56 },
    { category: 'ไลฟ์สไตล์ (ต่ำสุด)', commissionPct: 14.98, serviceFeePct: 8.56 },
    { category: 'ไลฟ์สไตล์ (สูงสุด)', commissionPct: 19.26, serviceFeePct: 8.56 },
    { category: 'สินค้าอื่นๆ', commissionPct: 19.26, serviceFeePct: 8.56 },
    { category: 'ทอง & แพลตตินั่ม', commissionPct: 11.24, serviceFeePct: 7.49 },
    { category: 'เงิน (โลหะมีค่า)', commissionPct: 16.59, serviceFeePct: 8.56 },
    { category: 'เครื่องประดับ (แหวน/สร้อย/กำไล)', commissionPct: 16.59, serviceFeePct: 8.56 },
    { category: 'เครื่องประดับมีมูลค่า', commissionPct: 18.73, serviceFeePct: 8.56 },
    { category: 'มือถือ/แท็บเล็ต/แล็ปท็อป', commissionPct: 7.49, serviceFeePct: 7.49 },
    { category: 'เครื่องใช้ไฟฟ้าใหญ่ (ตู้เย็น/ซักผ้า)', commissionPct: 11.77, serviceFeePct: 7.49 },
    { category: 'คอมพิวเตอร์ (จอ/ชิ้นส่วน)', commissionPct: 9.63, serviceFeePct: 7.49 },
    { category: 'คอมพิวเตอร์ (จัดเก็บข้อมูล/ปริ้นเตอร์)', commissionPct: 12.84, serviceFeePct: 7.49 },
    { category: 'คอมพิวเตอร์ (อุปกรณ์ต่อพ่วง/เน็ตเวิร์ก)', commissionPct: 16.59, serviceFeePct: 8.56 },
    { category: 'เกม (แผ่น/ตลับ/เครื่องเกม)', commissionPct: 14.45, serviceFeePct: 8.56 },
    { category: 'กล้องวงจรปิด/โดรน/ซอฟต์แวร์', commissionPct: 17.12, serviceFeePct: 8.56 },
    { category: 'หนังสือ (การ์ตูน/เด็ก/ธุรกิจ/ภาษา)', commissionPct: 17.66, serviceFeePct: 8.56 },
    { category: 'เครื่องประดับ (เพชร/หยก เพื่อการลงทุน)', commissionPct: 18.73, serviceFeePct: 8.56 },
    { category: 'ยานยนต์/มอเตอร์ไซค์ (ตัวรถ)', commissionPct: 13.38, serviceFeePct: 8.56 },
    { category: 'เครื่องเสียง/โปรเจคเตอร์/เครื่องใช้ไฟฟ้าในบ้าน', commissionPct: 16.59, serviceFeePct: 8.56 },
    { category: 'ทีวีและอุปกรณ์', commissionPct: 11.77, serviceFeePct: 8.56 },
    { category: 'ทีวี (ตัวเครื่อง)', commissionPct: 8.56, serviceFeePct: 7.49 },
    { category: 'คีย์บอร์ด/เมาส์/กราฟิกแท็บเล็ต', commissionPct: 15.52, serviceFeePct: 8.56 },
    { category: 'อุปกรณ์สวมใส่ (สมาร์ตวอทช์/VR/GPS)', commissionPct: 15.52, serviceFeePct: 7.49 },
    { category: 'เครื่องทำความร้อน/เครื่องทำน้ำอุ่น', commissionPct: 13.91, serviceFeePct: 7.49 },
    { category: 'อุปกรณ์เสริมโดรน', commissionPct: 16.05, serviceFeePct: 8.56 },
    { category: 'ซิมการ์ด', commissionPct: 17.12, serviceFeePct: 7.49 }
  ]
};

export const TIKTOK_RATES: Record<Tier, FeeCategoryRate[]> = {
  standard: [
    { category: 'อิเล็กทรอนิกส์ (อุปกรณ์หลัก มือถือ/PC/กล้อง)', commissionPct: 6.42, growthFeePct: 6.96 },
    { category: 'อิเล็กทรอนิกส์ (อุปกรณ์เสริม/เครื่องครัว)', commissionPct: 10.7, growthFeePct: 6.96 },
    { category: 'อิเล็กทรอนิกส์ (เครื่องใช้ในบ้าน/อะไหล่)', commissionPct: 9.63, growthFeePct: 6.96 },
    { category: 'แฟชั่น (เสื้อผ้า/รองเท้า/กระเป๋า)', commissionPct: 11.77, growthFeePct: 8.03 },
    { category: 'เครื่องประดับ (เพชร/อำพัน/อัญมณีเทียม)', commissionPct: 10.7, growthFeePct: 8.03 },
    { category: 'ทอง & แพลตตินั่ม', commissionPct: 6.42, growthFeePct: 8.03 },
    { category: 'แม่ & เด็ก / แฟชั่นเด็ก', commissionPct: 10.7, growthFeePct: 8.03 },
    { category: 'เครื่องประดับเงินแท้', commissionPct: 9.63, growthFeePct: 8.03 },
    { category: 'สุขภาพ & ความงาม', commissionPct: 10.7, growthFeePct: 8.03 },
    { category: 'อาหาร & เครื่องดื่ม', commissionPct: 10.7, growthFeePct: 8.03 },
    { category: 'ของใช้ในบ้าน / ไลฟ์สไตล์', commissionPct: 10.7, growthFeePct: 8.03 },
    { category: 'สัตว์เลี้ยง', commissionPct: 10.7, growthFeePct: 8.03 },
    { category: 'กีฬา', commissionPct: 10.7, growthFeePct: 8.03 },
    { category: 'รถยนต์ & มอเตอร์ไซค์ (อะไหล่)', commissionPct: 9.63, growthFeePct: 8.03 },
    { category: 'ยานยนต์/จักรยานยนต์ (ตัวรถ/อะไหล่/อุปกรณ์)', commissionPct: 7.49, growthFeePct: 8.03 },
    { category: 'หนังสือ / ของสะสม', commissionPct: 10.7, growthFeePct: 8.03 },
    { category: 'สินค้าทั่วไป/อื่นๆ', commissionPct: 10.7, growthFeePct: 8.03 }
  ],
  premium: [
    { category: 'อิเล็กทรอนิกส์ (อุปกรณ์หลัก)', commissionPct: 6.42, growthFeePct: 6.96 },
    { category: 'อิเล็กทรอนิกส์ (คอมพิวเตอร์/มือถือ/แล็ปท็อป)', commissionPct: 5.35, growthFeePct: 6.96 },
    { category: 'อิเล็กทรอนิกส์ (อุปกรณ์เสริม)', commissionPct: 11.77, growthFeePct: 6.96 },
    { category: 'อิเล็กทรอนิกส์ (เครื่องใช้ในบ้าน/อะไหล่)', commissionPct: 9.63, growthFeePct: 6.96 },
    { category: 'อิเล็กทรอนิกส์ (เครื่องใช้ไฟฟ้าภายในบ้าน)', commissionPct: 10.7, growthFeePct: 6.96 },
    { category: 'แฟชั่น (เสื้อผ้า/รองเท้า/กระเป๋า)', commissionPct: 13.91, growthFeePct: 8.03 },
    { category: 'เครื่องประดับ/นาฬิกา', commissionPct: 13.91, growthFeePct: 8.03 },
    { category: 'เครื่องประดับ (เพชร/อำพัน/อัญมณีเทียม)', commissionPct: 12.84, growthFeePct: 8.03 },
    { category: 'ทอง & แพลตตินั่ม', commissionPct: 8.56, growthFeePct: 8.03 },
    { category: 'สุขภาพ & ความงาม', commissionPct: 13.91, growthFeePct: 8.03 },
    { category: 'อาหาร & เครื่องดื่ม', commissionPct: 13.91, growthFeePct: 8.03 },
    { category: 'สินค้าทั่วไป/อื่นๆ', commissionPct: 13.91, growthFeePct: 8.03 }
  ]
};

export const LAZADA_RATES: Record<Tier, FeeCategoryRate[]> = {
  standard: [
    { category: 'อิเล็กทรอนิกส์ (มือถือ/แท็บเล็ต)', commissionPct: 6.96 },
    { category: 'อิเล็กทรอนิกส์ (กล้อง/เกม/ทีวี)', commissionPct: 6.96 },
    { category: 'อิเล็กทรอนิกส์ (เครื่องใช้ไฟฟ้า/เครื่องเสียง)', commissionPct: 16.05 },
    { category: 'อิเล็กทรอนิกส์ (เครื่องพิมพ์/อุปกรณ์เสริม/บัตรดิจิทัล)', commissionPct: 11.24 },
    { category: 'อิเล็กทรอนิกส์ (เครื่องใช้ไฟฟ้าขนาดใหญ่)', commissionPct: 10.17 },
    { category: 'อิเล็กทรอนิกส์ (สมาร์ทดีไวซ์/เครื่องเสียง/อุปกรณ์เสริม)', commissionPct: 13.91 },
    { category: 'อิเล็กทรอนิกส์ (กล้องวงจรปิด/โดรน/อุปกรณ์กล้อง)', commissionPct: 14.98 },
    { category: 'แฟชั่น', commissionPct: 17.12 },
    { category: 'แฟชั่น (เครื่องประดับแฟชั่น)', commissionPct: 17.12 },
    { category: 'สุขภาพ & ความงาม', commissionPct: 16.05 },
    { category: 'ของใช้ในบ้าน', commissionPct: 16.05 },
    { category: 'กีฬา', commissionPct: 16.05 },
    { category: 'อาหาร & เครื่องดื่ม', commissionPct: 16.05 },
    { category: 'ทอง & แพลตตินั่ม', commissionPct: 8.03 },
    { category: 'อุปกรณ์ช่าง/เครื่องเขียน', commissionPct: 16.05 },
    { category: 'สินค้าทั่วไป/อื่นๆ', commissionPct: 16.05 }
  ],
  premium: [
    { category: 'อิเล็กทรอนิกส์ (มือถือ/แท็บเล็ต)', commissionPct: 6.96 },
    { category: 'อิเล็กทรอนิกส์ (กล้อง/เกม/ทีวี)', commissionPct: 6.96 },
    { category: 'อิเล็กทรอนิกส์ (เครื่องใช้ไฟฟ้า/เครื่องเสียง)', commissionPct: 18.73 },
    { category: 'อิเล็กทรอนิกส์ (เครื่องพิมพ์/อุปกรณ์เสริม/บัตรดิจิทัล)', commissionPct: 11.24 },
    { category: 'อิเล็กทรอนิกส์ (เครื่องใช้ไฟฟ้าขนาดใหญ่)', commissionPct: 10.17 },
    { category: 'อิเล็กทรอนิกส์ (สมาร์ทดีไวซ์/เครื่องเสียง/อุปกรณ์เสริม)', commissionPct: 16.05 },
    { category: 'อิเล็กทรอนิกส์ (กล้องวงจรปิด/โดรน/อุปกรณ์กล้อง)', commissionPct: 15.52 },
    { category: 'แฟชั่น', commissionPct: 18.73 },
    { category: 'สุขภาพ & ความงาม', commissionPct: 18.73 },
    { category: 'ของใช้ในบ้าน', commissionPct: 18.73 },
    { category: 'อาหาร', commissionPct: 18.73 },
    { category: 'ทอง & แพลตตินั่ม', commissionPct: 9.63 },
    { category: 'อุปกรณ์ช่าง/เครื่องเขียน', commissionPct: 18.73 },
    { category: 'สินค้าทั่วไป/อื่นๆ', commissionPct: 18.73 }
  ]
};

export const TIER_LABEL: Record<Platform, Record<Tier, string>> = {
  shopee: { standard: 'ร้านทั่วไป', premium: 'Shopee Mall' },
  tiktok: { standard: 'Marketplace', premium: 'TikTok Mall' },
  lazada: { standard: 'Marketplace', premium: 'LazMall' }
};

export const PLATFORM_LABEL: Record<Platform, string> = {
  shopee: 'Shopee',
  tiktok: 'TikTok Shop',
  lazada: 'Lazada'
};

// Flat rate constants that aren't category-dependent.
export const SHOPEE_TX_FEE_PCT_PRE_VAT = 3; // × 1.07 = 3.21%, standard payment methods
export const SHOPEE_PLATFORM_FEE_BAHT = 1.07;

export const TIKTOK_TX_FEE_PCT = 3.21; // already VAT-inclusive as published
export const TIKTOK_INFRASTRUCTURE_FEE_BAHT = 1.07;
export const TIKTOK_GROWTH_FEE_CAP_BAHT = 199;

export const LAZADA_PAYMENT_FEE_PCT = 3.21; // already VAT-inclusive as published
export const LAZADA_PREMIUM_PACKAGE_PCT = 8.56;

export function getRates(platform: Platform, tier: Tier): FeeCategoryRate[] {
  if (platform === 'shopee') return SHOPEE_RATES[tier];
  if (platform === 'tiktok') return TIKTOK_RATES[tier];
  return LAZADA_RATES[tier];
}
