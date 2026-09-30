'use client';

import { useMemo, useState } from 'react';
import { calcBreakEven, calcAdPerformance } from '@/lib/roas/calculator';

// ROAS (Return On Ad Spend) Calculator — explicit user request:
// "ต้องการเพิ่มโปรแกรมคำนวณ ROAS Facebok เข้าไปด้วย", with a worked example (price
// 350, cost 120 → break-even ROAS ~1.52-1.53x). Two independent sections:
//
// 1) Break-even ROAS — "ROAS ขั้นต่ำที่ต้องทำได้" from just price + cost, no ad
//    data needed. Useful BEFORE launching a campaign.
// 2) Actual ad performance — plug in real ad spend + ad revenue from Meta
//    Ads Manager and see whether the campaign is actually profitable right
//    now, not just whether ROAS "looks high" on the dashboard (which is the
//    exact trap the user's own example calls out: "แม้หน้าจอจะบอกว่าขายได้เยอะก็ตาม").
//
// Pure client-side math (see lib/roas/calculator.ts) — no Supabase, no AI
// calls, no cost. Same pattern as components/pricing-calculator-client.tsx.

function num(v: string): number {
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

function fmtBaht(n: number): string {
  return n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtRoas(n: number): string {
  if (!Number.isFinite(n)) return '∞';
  return n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function RoasCalculatorClient() {
  const [price, setPrice] = useState('350');
  const [cost, setCost] = useState('120');
  const [adSpend, setAdSpend] = useState('');
  const [adRevenue, setAdRevenue] = useState('');

  const priceNum = num(price);
  const costNum = num(cost);
  const adSpendNum = num(adSpend);
  const adRevenueNum = num(adRevenue);

  const breakEven = useMemo(() => calcBreakEven(priceNum, costNum), [priceNum, costNum]);
  const performance = useMemo(
    () => calcAdPerformance(priceNum, costNum, adSpendNum, adRevenueNum),
    [priceNum, costNum, adSpendNum, adRevenueNum]
  );

  const hasAdData = adSpendNum > 0 && adRevenueNum > 0;
  const costTooHigh = priceNum > 0 && costNum >= priceNum;

  return (
    <div className="space-y-4">
      {/* Section 1: Break-even ROAS from price + cost */}
      <div className="card p-4 sm:p-5 space-y-4">
        <div>
          <label className="field-label">1. หา Break-even ROAS (ทำก่อนยิงแอด)</label>
          <p className="text-xs text-gray-500 mt-1">ใส่ราคาขายและต้นทุนต่อชิ้น — ระบบจะบอกว่า ROAS ต้องได้อย่างน้อยเท่าไหร่ถึงจะเสมอตัว</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="field-label">ราคาขายต่อชิ้น (บาท) *</label>
            <input type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="เช่น 350" />
          </div>
          <div>
            <label className="field-label">ต้นทุนต่อชิ้น (บาท) *</label>
            <input type="number" min="0" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="เช่น 120" />
            <p className="text-xs text-gray-400 mt-1">รวมทุกต้นทุนต่อชิ้น: ต้นทุนสินค้า + แพ็กเกจ + ค่าส่ง + ค่าธรรมเนียมแพลตฟอร์ม (ถ้ามี)</p>
          </div>
        </div>

        {costTooHigh ? (
          <p className="text-sm text-red-600">
            ต้นทุนต่อชิ้น ({fmtBaht(costNum)} บาท) ≥ ราคาขาย ({fmtBaht(priceNum)} บาท) — ขายเท่าไหร่ก็ไม่มีทางคุ้ม ไม่ว่า ROAS จะสูงแค่ไหน
            ต้องปรับราคาขายหรือลดต้นทุนก่อน
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-xs text-gray-500">กำไรต่อชิ้น</p>
              <p className="text-lg font-bold">{fmtBaht(breakEven.profitPerUnit)} บาท</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-xs text-gray-500">อัตรากำไร (Margin)</p>
              <p className="text-lg font-bold">{breakEven.marginPct.toFixed(1)}%</p>
            </div>
            <div className="rounded-lg p-3" style={{ background: 'var(--accent-terracotta-tint)', color: 'var(--accent-terracotta-dark)' }}>
              <p className="text-xs opacity-70">Break-even ROAS</p>
              <p className="text-lg font-bold">{fmtRoas(breakEven.breakEvenRoas)}x</p>
            </div>
          </div>
        )}

        {!costTooHigh && priceNum > 0 && (
          <p className="text-xs text-gray-500">
            ความหมาย: ยิงแอด 1 บาท ต้องได้ยอดขายคืนอย่างน้อย {fmtRoas(breakEven.breakEvenRoas)} บาท ถึงจะเสมอตัว — ต่ำกว่านี้คือขาดทุน แม้ยอดขายจะดูเยอะก็ตาม
          </p>
        )}
      </div>

      {/* Section 2: Check actual ad performance */}
      <div className="card p-4 sm:p-5 space-y-4">
        <div>
          <label className="field-label">2. เช็คแอดที่ยิงอยู่จริง (ไม่บังคับ)</label>
          <p className="text-xs text-gray-500 mt-1">
            เอาตัวเลขจาก Meta Ads Manager มาใส่ — "จำนวนเงินที่ใช้ไป" (Amount spent) และ "มูลค่า Conversion การซื้อ" (Purchase conversion value)
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="field-label">ค่าโฆษณาที่ใช้ไป (บาท)</label>
            <input type="number" min="0" value={adSpend} onChange={(e) => setAdSpend(e.target.value)} placeholder="เช่น 5000" />
          </div>
          <div>
            <label className="field-label">ยอดขายที่ได้จากแอด (บาท)</label>
            <input type="number" min="0" value={adRevenue} onChange={(e) => setAdRevenue(e.target.value)} placeholder="เช่น 9000" />
          </div>
        </div>

        {!hasAdData ? (
          <p className="text-xs text-gray-400">ใส่ทั้งค่าโฆษณาและยอดขายเพื่อดูผลลัพธ์</p>
        ) : costTooHigh ? (
          <p className="text-sm text-red-600">แก้ต้นทุน/ราคาขายด้านบนก่อน ถึงจะเช็คผลจริงได้</p>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs text-gray-500">ROAS จริง</p>
                <p className="text-lg font-bold">{performance.actualRoas !== null ? `${fmtRoas(performance.actualRoas)}x` : '—'}</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs text-gray-500">Break-even ROAS</p>
                <p className="text-lg font-bold">{fmtRoas(performance.breakEvenRoas)}x</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs text-gray-500">ส่วนต่าง ROAS</p>
                <p className={`text-lg font-bold ${performance.roasGapVsBreakEven !== null && performance.roasGapVsBreakEven >= 0 ? 'text-accentGreen' : 'text-red-600'}`}>
                  {performance.roasGapVsBreakEven !== null
                    ? `${performance.roasGapVsBreakEven >= 0 ? '+' : ''}${fmtRoas(performance.roasGapVsBreakEven)}x`
                    : '—'}
                </p>
              </div>
            </div>

            <div className={`rounded-lg p-4 ${performance.isProfitable ? 'bg-green-50' : 'bg-red-50'}`}>
              <p className="text-xs text-gray-500">กำไร/ขาดทุนสุทธิ (หลังหักค่าโฆษณา)</p>
              <p className={`text-2xl font-bold ${performance.isProfitable ? 'text-accentGreen' : 'text-red-600'}`}>
                {performance.isProfitable ? '+' : ''}
                {fmtBaht(performance.netProfit)} บาท
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {performance.isProfitable
                  ? `แอดนี้ทำกำไรจริง — ROAS ${fmtRoas(performance.actualRoas ?? 0)}x สูงกว่า Break-even ${fmtRoas(performance.breakEvenRoas)}x`
                  : `แอดนี้ขาดทุนจริง แม้ยอดขายจะดูเยอะ — ROAS ${fmtRoas(performance.actualRoas ?? 0)}x ยังไม่ถึง Break-even ${fmtRoas(performance.breakEvenRoas)}x`}
              </p>
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400">
        หมายเหตุ: คำนวณจากสมมติฐานว่ายอดขายทั้งหมดที่ได้จากแอดมีอัตรากำไรเท่ากับที่กรอกไว้ (ราคาขาย/ต้นทุนต่อชิ้นเดียวกันทุกออเดอร์) —
        หากขายหลายสินค้าที่มีต้นทุน/ราคาไม่เท่ากันในแคมเปญเดียว ตัวเลขนี้จะเป็นค่าประมาณ ไม่ใช่ตัวเลขที่แม่นยำ 100%
      </p>
    </div>
  );
}
