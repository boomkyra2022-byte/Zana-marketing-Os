import { RoasCalculatorClient } from '@/components/roas-calculator-client';

// Pure client-side calculator — no Supabase reads/writes, no AI calls, no
// cost. Explicit user request: "ต้องการเพิ่มโปรแกรมคำนวณ ROAS Facebok เข้าไปด้วย"
// with a worked example (price 350, cost 120 → break-even ROAS ~1.52x). See
// lib/roas/calculator.ts for the formulas and a note on why break-even ROAS
// is always computed from unrounded price/profit rather than a rounded
// margin% (the user's own two example formulas gave 1.53 vs 1.52 for that
// exact reason).
export default function RoasCalculatorPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">คำนวณ ROAS (Facebook Ads)</h1>
        <p className="text-gray-500">หา Break-even ROAS ก่อนยิงแอด แล้วเช็คว่าแอดที่ยิงอยู่กำไรจริงหรือขาดทุน</p>
      </div>
      <RoasCalculatorClient />
    </div>
  );
}
