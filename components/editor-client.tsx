'use client';

import { useState } from 'react';

interface Props {
  products: { id: string; product_name: string; brand: string }[];
  recentJobs: { id: string; operation: string; status: string; result_kind: string | null; created_at: string; error: string | null }[];
}

type Operation = 'SILENCE_CUT' | 'RENDER' | 'SUBTITLE_SRT' | 'DEWATERMARK' | 'PUNCHY_SRT';

const OPERATIONS: { value: Operation; label: string; billing: string }[] = [
  { value: 'SILENCE_CUT', label: 'ตัดช่วงเงียบ (Silence-cut)', billing: 'ฟรีสำหรับแพ็กเกจที่เสียเงินของ Tamsub' },
  { value: 'RENDER', label: 'ใส่ซับ / เบิร์นข้อความลงคลิป (Render)', billing: 'หัก 1 เครดิต (clip) ต่อการ render สำเร็จ 1 ครั้ง' },
  { value: 'SUBTITLE_SRT', label: 'ถอดเป็นไฟล์ SRT อย่างเดียว (Tamsub)', billing: 'หัก 1 เครดิต (clip) ต่อไฟล์สำเร็จ 1 ครั้ง' },
  {
    value: 'PUNCHY_SRT',
    label: 'SRT แบบ Punchy — คุมกฎเอง (แนะนำสำหรับ CapCut)',
    billing: 'ไม่ผ่าน Tamsub เลย ใช้ OpenAI ของเราเอง — ไม่หัก credit ของ Tamsub'
  },
  { value: 'DEWATERMARK', label: 'ลบลายน้ำ AI (Dewatermark)', billing: 'ฟรีสำหรับแพ็กเกจที่เสียเงินของ Tamsub' }
];

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'กำลังเริ่มต้น...',
  DOWNLOADING: 'กำลังดาวน์โหลดวิดีโอต้นทาง...',
  PROCESSING: 'กำลังประมวลผล...',
  UPLOADING: 'กำลังอัปโหลดผลลัพธ์...',
  DONE: 'เสร็จสิ้น',
  FAILED: 'ล้มเหลว'
};

const STATUS_BADGE: Record<string, string> = {
  PENDING: 'bg-gray-50 text-gray-600 border-gray-200',
  DOWNLOADING: 'bg-blue-50 text-blue-700 border-blue-200',
  PROCESSING: 'bg-blue-50 text-blue-700 border-blue-200',
  UPLOADING: 'bg-blue-50 text-blue-700 border-blue-200',
  DONE: 'bg-green-50 text-green-700 border-green-200',
  FAILED: 'bg-red-50 text-red-700 border-red-200'
};

export default function EditorClient({ products, recentJobs }: Props) {
  const [operation, setOperation] = useState<Operation>('SILENCE_CUT');
  const [sourceUrl, setSourceUrl] = useState('');
  const [productId, setProductId] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [language, setLanguage] = useState('th');
  const [thresholdDb, setThresholdDb] = useState<number | ''>('');
  const [minSilenceMs, setMinSilenceMs] = useState<number | ''>('');

  const [phase, setPhase] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [progressStatus, setProgressStatus] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [result, setResult] = useState<{ kind: 'VIDEO' | 'SRT'; signed_url?: string; srt_text?: string } | null>(null);

  const selected = OPERATIONS.find((o) => o.value === operation)!;

  async function handleRun() {
    setPhase('running');
    setErrorMsg('');
    setResult(null);
    setProgressStatus('กำลังเริ่มต้น...');

    try {
      const res = await fetch('/api/tools/editor/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation,
          source_url: sourceUrl,
          product_id: productId || null,
          template_id: templateId || undefined,
          language: language || undefined,
          threshold_db: thresholdDb === '' ? undefined : thresholdDb,
          min_silence_ms: minSilenceMs === '' ? undefined : minSilenceMs
        })
      });

      if (!res.body) throw new Error('ไม่ได้รับข้อมูลตอบกลับจากเซิร์ฟเวอร์');
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || `เกิดข้อผิดพลาด (HTTP ${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line);
          if (event.type === 'status') {
            setProgressStatus(STATUS_LABELS[event.status] ?? event.status);
          } else if (event.type === 'done') {
            setResult(event.result);
            setPhase('done');
          } else if (event.type === 'error') {
            setErrorMsg(event.error);
            setPhase('error');
          }
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'เกิดข้อผิดพลาดระหว่างประมวลผล');
      setPhase('error');
    }
  }

  function useResultAsNextSource() {
    if (result?.kind === 'VIDEO' && result.signed_url) {
      setSourceUrl(result.signed_url);
      setResult(null);
      setPhase('idle');
    }
  }

  function downloadSrt() {
    if (!result?.srt_text) return;
    const blob = new Blob([result.srt_text], { type: 'application/x-subrip' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'subtitle.srt';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="card p-6 space-y-4">
        <h2 className="text-lg font-semibold">รันเครื่องมือ</h2>

        <div>
          <label className="field-label">การทำงาน *</label>
          <select value={operation} onChange={(e) => setOperation(e.target.value as Operation)}>
            {OPERATIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">💳 {selected.billing}</p>
        </div>

        <div>
          <label className="field-label">Source Video — Google Drive link หรือ URL วิดีโอโดยตรง *</label>
          <input
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https://drive.google.com/file/d/... หรือ https://..."
          />
          <p className="text-xs text-gray-500 mt-1">
            เชื่อมผลลัพธ์จากขั้นตอนก่อนหน้าต่อกันได้ — กด &quot;ใช้ผลลัพธ์นี้เป็น Source ต่อ&quot; ด้านล่างหลังรันเสร็จ
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="field-label">สินค้า (ไม่บังคับ)</label>
            <select value={productId} onChange={(e) => setProductId(e.target.value)}>
              <option value="">— ไม่ระบุ —</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.brand} — {p.product_name}
                </option>
              ))}
            </select>
          </div>

          {(operation === 'RENDER' || operation === 'SUBTITLE_SRT') && (
            <div>
              <label className="field-label">ภาษาซับ</label>
              <select value={language} onChange={(e) => setLanguage(e.target.value)}>
                <option value="th">ไทย</option>
                <option value="en">English</option>
              </select>
            </div>
          )}

          {operation === 'RENDER' && (
            <div>
              <label className="field-label">Template</label>
              <input value={templateId} onChange={(e) => setTemplateId(e.target.value)} placeholder="เช่น tiktok-karaoke, pop" />
            </div>
          )}

          {operation === 'SILENCE_CUT' && (
            <>
              <div>
                <label className="field-label">Threshold (dB, ไม่บังคับ)</label>
                <input
                  type="number"
                  value={thresholdDb}
                  onChange={(e) => setThresholdDb(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="-35"
                />
              </div>
              <div>
                <label className="field-label">ความยาวเงียบขั้นต่ำ (ms, ไม่บังคับ)</label>
                <input
                  type="number"
                  value={minSilenceMs}
                  onChange={(e) => setMinSilenceMs(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="500"
                />
              </div>
            </>
          )}
        </div>

        <button className="btn-primary" disabled={!sourceUrl || phase === 'running'} onClick={handleRun}>
          {phase === 'running' ? 'กำลังประมวลผล...' : 'Run'}
        </button>

        {phase === 'running' && (
          <div className="card p-4 bg-surface text-sm flex items-center gap-3">
            <span className="inline-block w-2 h-2 rounded-full bg-accentBlue animate-pulse" />
            {progressStatus}
          </div>
        )}
        {phase === 'error' && <div className="text-red-600 text-sm">{errorMsg}</div>}
      </div>

      {phase === 'done' && result?.kind === 'VIDEO' && result.signed_url && (
        <div className="card p-6 space-y-3">
          <h3 className="font-semibold">ผลลัพธ์</h3>
          <video src={result.signed_url} controls className="w-full max-w-md rounded-lg" />
          <div className="flex gap-3">
            <a href={result.signed_url} download className="btn-secondary">
              ดาวน์โหลดวิดีโอ
            </a>
            <button className="btn-primary" onClick={useResultAsNextSource}>
              ใช้ผลลัพธ์นี้เป็น Source ต่อ →
            </button>
          </div>
          <p className="text-xs text-gray-500">ลิงก์ดาวน์โหลดนี้หมดอายุใน 24 ชั่วโมง — ดูประวัติงานด้านล่างเพื่อขอลิงก์ใหม่ภายหลัง</p>
        </div>
      )}

      {phase === 'done' && result?.kind === 'SRT' && result.srt_text && (
        <div className="card p-6 space-y-3">
          <h3 className="font-semibold">ไฟล์ SRT</h3>
          <textarea readOnly value={result.srt_text} rows={12} className="w-full font-mono text-xs" />
          <button className="btn-secondary" onClick={downloadSrt}>
            ดาวน์โหลด .srt
          </button>
        </div>
      )}

      <div className="card p-4">
        <h3 className="font-semibold mb-3">ประวัติงานล่าสุด</h3>
        {recentJobs.length === 0 ? (
          <p className="text-gray-500 text-sm">ยังไม่มีประวัติ</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-surface text-left text-gray-500">
              <tr>
                <th className="px-2 py-2">การทำงาน</th>
                <th className="px-2 py-2">สถานะ</th>
                <th className="px-2 py-2">เวลา</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {recentJobs.map((j) => (
                <RecentJobRow key={j.id} job={j} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function RecentJobRow({
  job
}: {
  job: { id: string; operation: string; status: string; result_kind: string | null; created_at: string; error: string | null };
}) {
  const [loading, setLoading] = useState(false);

  async function redownload() {
    setLoading(true);
    try {
      const res = await fetch(`/api/tools/editor/jobs/${job.id}/download`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      if (json.kind === 'VIDEO' && json.signed_url) {
        window.open(json.signed_url, '_blank');
      } else if (json.kind === 'SRT' && json.srt_text) {
        const blob = new Blob([json.srt_text], { type: 'application/x-subrip' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'subtitle.srt';
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      /* silent — badge already shows FAILED if applicable */
    } finally {
      setLoading(false);
    }
  }

  const opLabel = OPERATIONS.find((o) => o.value === job.operation)?.label ?? job.operation;

  return (
    <tr className="border-t border-border align-top">
      <td className="px-2 py-2">{opLabel}</td>
      <td className="px-2 py-2">
        <span className={`px-2 py-0.5 rounded-full border text-xs font-semibold ${STATUS_BADGE[job.status] ?? ''}`}>{job.status}</span>
        {job.error && <div className="text-red-600 text-xs mt-1">{job.error}</div>}
      </td>
      <td className="px-2 py-2 whitespace-nowrap text-gray-500">{new Date(job.created_at).toLocaleString('th-TH')}</td>
      <td className="px-2 py-2">
        {job.status === 'DONE' && (
          <button className="text-accentBlue text-xs" disabled={loading} onClick={redownload}>
            {loading ? '...' : 'ดาวน์โหลดอีกครั้ง'}
          </button>
        )}
      </td>
    </tr>
  );
}
