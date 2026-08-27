import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createRule } from '../actions';

export default async function NewRulePage({ searchParams }: { searchParams: { error?: string } }) {
  const supabase = createClient();
  const { data: accounts } = await supabase.from('ad_accounts').select('id, name').eq('status', 'active').order('name');

  return (
    <div className="max-w-2xl">
      <Link href="/ads/rules" className="ads-muted text-sm hover:text-white">
        ← กลับไปรายการ Rules
      </Link>
      <h1 className="text-2xl font-bold text-white mt-2 mb-6">สร้าง Automation Rule</h1>

      {searchParams.error && <div className="ads-card p-4 mb-4 text-red-400 text-sm">{searchParams.error}</div>}

      <form action={createRule} className="ads-card p-6 space-y-5">
        <div>
          <label className="ads-field-label">ชื่อ Rule</label>
          <input name="name" required placeholder="เช่น เตือน ROAS ต่ำ" />
        </div>

        <div>
          <label className="ads-field-label">ขอบเขต (ไม่เลือก = ใช้กับทุกบัญชี)</label>
          <select name="ad_account_id" defaultValue="">
            <option value="">ทุกบัญชี</option>
            {accounts?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="ads-field-label">Metric</label>
            <select name="metric" required defaultValue="roas">
              <option value="roas">ROAS</option>
              <option value="cpa">CPA</option>
              <option value="spend">Spend</option>
              <option value="frequency">Frequency</option>
              <option value="ctr">CTR</option>
              <option value="cpc">CPC</option>
            </select>
          </div>
          <div>
            <label className="ads-field-label">Operator</label>
            <select name="operator" required defaultValue="<">
              <option value="<">&lt;</option>
              <option value="<=">&le;</option>
              <option value=">">&gt;</option>
              <option value=">=">&ge;</option>
              <option value="=">=</option>
            </select>
          </div>
          <div>
            <label className="ads-field-label">Threshold</label>
            <input name="threshold" type="number" step="any" required placeholder="1.5" />
          </div>
        </div>

        <div>
          <label className="ads-field-label">ต้องเข้าเงื่อนไขต่อเนื่องกี่นาที (กัน false positive)</label>
          <input name="time_window_minutes" type="number" defaultValue={180} min={1} />
        </div>

        <div>
          <label className="ads-field-label">Action เมื่อเข้าเงื่อนไข</label>
          <select name="action" required defaultValue="pause">
            <option value="pause">หยุด (pause)</option>
            <option value="activate">เปิดใหม่ (activate)</option>
            <option value="scale_budget">ปรับ budget</option>
          </select>
        </div>

        <div>
          <label className="ads-field-label">% เพิ่ม/ลด budget (เฉพาะ action = ปรับ budget, ใส่ค่าลบเพื่อลด, สูงสุด ±20%)</label>
          <input name="budget_change_percent" type="number" step="any" min={-20} max={20} placeholder="เช่น 10 หรือ -10" />
        </div>

        <div>
          <label className="ads-field-label">Cooldown (ชั่วโมง) — กันยิงซ้ำ rule เดิม+ad set เดิมถี่เกินไป</label>
          <input name="cooldown_hours" type="number" defaultValue={6} min={0} step="any" />
        </div>

        <button type="submit" className="ads-btn-primary">
          บันทึก Rule
        </button>
      </form>
    </div>
  );
}
