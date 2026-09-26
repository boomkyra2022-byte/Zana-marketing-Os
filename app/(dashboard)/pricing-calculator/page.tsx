import { PricingCalculatorClient } from '@/components/pricing-calculator-client';

// Pure client-side calculator — no Supabase reads/writes, no AI calls, no
// cost. Explicit user request: "แกะโปรแกรมคำนวณ คำนวณราคาขาย + กำไรจริงหลัง
// หักค่าธรรมเนียม https://khummai.com/ แบบอันนี้เพื่อเข้ามาอยู่ในโปรแกรมเรา" —
// scoped to a standalone new tool page (not wired into Products) per the
// user's own choice when asked. Rate data + formulas in lib/pricing/ are
// sourced from KhumMai (CC BY 4.0) — see that folder's file headers for the
// full attribution and verification notes.
export default function PricingCalculatorPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">คำนวณราคาขาย + กำไรจริง</h1>
        <p className="text-gray-500">หักค่าธรรมเนียม Shopee / TikTok Shop / Lazada ให้ครบ ก่อนตั้งราคาขาย</p>
      </div>
      <PricingCalculatorClient />
    </div>
  );
}
