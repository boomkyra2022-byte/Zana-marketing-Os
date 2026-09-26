'use client';

import { useMemo, useState } from 'react';
import {
  getRates,
  TIER_LABEL,
  PLATFORM_LABEL,
  type Platform,
  type Tier
} from '@/lib/pricing/marketplace-fee-data';
import { calcShopeeFees, calcTiktokFees, calcLazadaFees, type CalcResult } from '@/lib/pricing/calculator';

interface PlatformState {
  tier: Tier;
  category: string;
  xtra?: boolean;
  affiliatePct?: string;
  premiumPackage?: boolean;
}

function initState(platform: Platform): PlatformState {
  const first = getRates(platform, 'standard')[0]?.category ?? '';
  return { tier: 'standard', category: first, xtra: false, affiliatePct: '', premiumPackage: false };
}

function num(v: string): number {
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

function fmtBaht(n: number): string {
  return n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function PricingCalculatorClient() {
  const [mode, setMode] = useState<'single' | 'compare'>('single');
  const [activePlatform, setActivePlatform] = useState<Platform>('shopee');

  const [price, setPrice] = useState('299');
  const [cost, setCost] = useState('');
  const [packCost, setPackCost] = useState('');
  const [adCost, setAdCost] = useState('');
  const [customerShipping, setCustomerShipping] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [shopee, setShopee] = useState<PlatformState>(initState('shopee'));
  const [tiktok, setTiktok] = useState<PlatformState>(initState('tiktok'));
  const [lazada, setLazada] = useState<PlatformState>(initState('lazada'));

  function handleTierChange(platform: Platform, tier: Tier) {
    const list = getRates(platform, tier);
    const setter = platform === 'shopee' ? setShopee : platform === 'tiktok' ? setTiktok : setLazada;
    const current = platform === 'shopee' ? shopee : platform === 'tiktok' ? tiktok : lazada;
    const stillValid = list.some((r) => r.category === current.category);
    setter({ ...current, tier, category: stillValid ? current.category : list[0]?.category ?? '' });
  }

  const priceNum = num(price);
  const baseInput = {
    price: priceNum,
    cost: num(cost),
    packCost: num(packCost),
    adCost: num(adCost),
    customerShipping: num(customerShipping)
  };

  const shopeeResult: CalcResult = useMemo(
    () => calcShopeeFees({ ...baseInput, tier: shopee.tier, category: shopee.category, xtraParticipant: shopee.xtra }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [priceNum, cost, packCost, adCost, customerShipping, shopee]
  );
  const tiktokResult: CalcResult = useMemo(
    () =>
      calcTiktokFees({
        ...baseInput,
        tier: tiktok.tier,
        category: tiktok.category,
        affiliatePct: num(tiktok.affiliatePct ?? '')
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [priceNum, cost, packCost, adCost, customerShipping, tiktok]
  );
  const lazadaResult: CalcResult = useMemo(
    () => calcLazadaFees({ ...baseInput, tier: lazada.tier, category: lazada.category, premiumPackage: lazada.premiumPackage }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [priceNum, cost, packCost, adCost, customerShipping, lazada]
  );

  const results: Record<Platform, CalcResult> = { shopee: shopeeResult, tiktok: tiktokResult, lazada: lazadaResult };
  const bestPlatform = (['shopee', 'tiktok', 'lazada'] as Platform[]).reduce((best, p) =>
    results[p].netProfit > results[best].netProfit ? p : best
  , 'shopee' as Platform);

  return (
    <div className="space-y-4">
      <div className="card p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={mode === 'single' ? 'btn-primary text-sm py-1.5 px-3' : 'btn-secondary text-sm py-1.5 px-3'}
            onClick={() => setMode('single')}
          >
            คำนวณ
          </button>
          <button
            type="button"
            className={mode === 'compare' ? 'btn-primary text-sm py-1.5 px-3' : 'btn-secondary text-sm py-1.5 px-3'}
            onClick={() => setMode('compare')}
          >
            เทียบ 3 แพลตฟอร์ม
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="field-label">ราคาขาย (บาท) *</label>
            <input value={price} onChange={(e) => setPrice(e.target.value)} type="number" min="0" placeholder="299" />
          </div>
          <div>
            <label className="field-label">ต้นทุนสินค้า (บาท)</label>
            <input value={cost} onChange={(e) => setCost(e.target.value)} type="number" min="0" placeholder="0" />
          </div>
          <div>
            <label className="field-label">ค่าแพ็ค (บาท)</label>
            <input value={packCost} onChange={(e) => setPackCost(e.target.value)} type="number" min="0" placeholder="0" />
          </div>
          <div>
            <label className="field-label">ค่าโฆษณาต่อออเดอร์ (บาท)</label>
            <input value={adCost} onChange={(e) => setAdCost(e.target.value)} type="number" min="0" placeholder="0" />
          </div>
        </div>

        <button type="button" className="text-xs text-accentBlue" onClick={() => setShowAdvanced((v) => !v)}>
          {showAdvanced ? '− ซ่อนตั้งค่าขั้นสูง' : '+ ตั้งค่าขั้นสูง (ค่าส่งที่ลูกค้าจ่าย)'}
        </button>
        {showAdvanced && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="field-label">ค่าส่งที่ลูกค้าจ่าย (บาท)</label>
              <input value={customerShipping} onChange={(e) => setCustomerShipping(e.target.value)} type="number" min="0" placeholder="0" />
              <p className="text-xs text-gray-400 mt-1">ใช้คำนวณ Transaction/Payment Fee เท่านั้น (ค่าที่ลูกค้าจ่ายตอนเช็คเอาต์ ไม่ใช่ค่าส่งที่ร้านจ่ายจริง)</p>
            </div>
          </div>
        )}
      </div>

      {mode === 'single' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {(['shopee', 'tiktok', 'lazada'] as Platform[]).map((p) => (
              <button
                key={p}
                type="button"
                className={activePlatform === p ? 'btn-primary text-sm py-1.5 px-3' : 'btn-secondary text-sm py-1.5 px-3'}
                onClick={() => setActivePlatform(p)}
              >
                {PLATFORM_LABEL[p]}
              </button>
            ))}
          </div>

          <PlatformCard
            platform={activePlatform}
            state={activePlatform === 'shopee' ? shopee : activePlatform === 'tiktok' ? tiktok : lazada}
            setState={activePlatform === 'shopee' ? setShopee : activePlatform === 'tiktok' ? setTiktok : setLazada}
            onTierChange={(t) => handleTierChange(activePlatform, t)}
            result={results[activePlatform]}
          />
        </div>
      )}

      {mode === 'compare' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {(['shopee', 'tiktok', 'lazada'] as Platform[]).map((p) => (
            <PlatformCard
              key={p}
              platform={p}
              state={p === 'shopee' ? shopee : p === 'tiktok' ? tiktok : lazada}
              setState={p === 'shopee' ? setShopee : p === 'tiktok' ? setTiktok : setLazada}
              onTierChange={(t) => handleTierChange(p, t)}
              result={results[p]}
              isBest={p === bestPlatform && priceNum > 0}
              compact
            />
          ))}
        </div>
      )}

      <div className="text-xs text-gray-400 leading-relaxed">
        อัตราค่าธรรมเนียมจาก{' '}
        <a href="https://khummai.com" target="_blank" rel="noreferrer" className="text-accentBlue underline">
          KhumMai (khummai.com)
        </a>{' '}
        ภายใต้สัญญาอนุญาต CC BY 4.0 · Shopee ปรับปรุง 4 ส.ค. 2569 · TikTok Shop ปรับปรุง 5 ก.ค. 2569 · Lazada ปรับปรุง 1 ส.ค. 2569 —
        เป็นค่าประมาณจากอัตราประกาศทางการ ไม่รวมโปรแกรมสมัครใจอื่น (Flash Sale, Voucher, Campaign) และอาจต่างจากยอดหักจริงในบางกรณี
        แพลตฟอร์มปรับอัตราเป็นระยะ — ตัวเลขในหน้านี้เป็น snapshot ไม่ได้ sync สด ถ้ายอดหักจริงเริ่มไม่ตรง แจ้งให้อัปเดตอัตราใหม่ได้
      </div>
    </div>
  );
}

function PlatformCard({
  platform,
  state,
  setState,
  onTierChange,
  result,
  isBest,
  compact
}: {
  platform: Platform;
  state: PlatformState;
  setState: (s: PlatformState) => void;
  onTierChange: (t: Tier) => void;
  result: CalcResult;
  isBest?: boolean;
  compact?: boolean;
}) {
  const categories = getRates(platform, state.tier);
  const profitPositive = result.netProfit >= 0;

  return (
    <div className={`card p-4 sm:p-5 space-y-3 ${isBest ? 'border-2' : ''}`} style={isBest ? { borderColor: 'var(--accent-terracotta)' } : undefined}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-heading font-semibold">{PLATFORM_LABEL[platform]}</h3>
        {isBest && (
          <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: 'var(--accent-terracotta-tint)', color: 'var(--accent-terracotta-dark)' }}>
            กำไรสูงสุด
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <label className="field-label">ประเภทร้าน</label>
          <select value={state.tier} onChange={(e) => onTierChange(e.target.value as Tier)}>
            <option value="standard">{TIER_LABEL[platform].standard}</option>
            <option value="premium">{TIER_LABEL[platform].premium}</option>
          </select>
        </div>
        <div>
          <label className="field-label">หมวดสินค้า</label>
          <select value={state.category} onChange={(e) => setState({ ...state, category: e.target.value })}>
            {categories.map((c) => (
              <option key={c.category} value={c.category}>
                {c.category} · {c.commissionPct}%
              </option>
            ))}
          </select>
        </div>
      </div>

      {platform === 'shopee' && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={!!state.xtra} onChange={(e) => setState({ ...state, xtra: e.target.checked })} />
          เข้าร่วมร้านโค้ดคุ้ม (Xtra) — เก็บ Service Fee เพิ่ม
        </label>
      )}
      {platform === 'tiktok' && (
        <div>
          <label className="field-label">Affiliate % (ถ้ามี)</label>
          <input
            type="number"
            min="0"
            max="100"
            value={state.affiliatePct ?? ''}
            onChange={(e) => setState({ ...state, affiliatePct: e.target.value })}
            placeholder="0"
          />
        </div>
      )}
      {platform === 'lazada' && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={!!state.premiumPackage} onChange={(e) => setState({ ...state, premiumPackage: e.target.checked })} />
          เข้าร่วม Premium Package (8.56%)
        </label>
      )}

      {result.warning && <p className="text-xs text-amber-600">{result.warning}</p>}

      <div className="border-t pt-3 space-y-1.5" style={{ borderColor: 'var(--border)' }}>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">ราคาขาย</span>
          <span className="font-medium">฿{fmtBaht(result.price)}</span>
        </div>
        {result.lines.map((l) => (
          <div key={l.label} className="flex justify-between text-sm text-gray-500">
            <span className={compact ? 'truncate pr-2' : ''}>{l.label}</span>
            <span className="whitespace-nowrap">
              −฿{fmtBaht(l.amount)} ({l.pct}%)
            </span>
          </div>
        ))}
        {result.otherCosts > 0 && (
          <div className="flex justify-between text-sm text-gray-500">
            <span>ต้นทุน + แพ็ค + โฆษณา</span>
            <span className="whitespace-nowrap">−฿{fmtBaht(result.otherCosts)}</span>
          </div>
        )}
        <div className="flex justify-between pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
          <span className="font-semibold">กำไรสุทธิ</span>
          <span className={`font-bold ${profitPositive ? 'text-accentGreen' : 'text-red-600'}`}>
            ฿{fmtBaht(result.netProfit)} ({result.marginPct}%)
          </span>
        </div>
      </div>
    </div>
  );
}
