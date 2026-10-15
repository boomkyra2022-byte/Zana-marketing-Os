'use client';

import { useState } from 'react';

interface DownloadResult {
  video: {
    id: string;
    author: string | null;
    title: string;
    duration_sec: number | null;
    cover: string | null;
    quality: 'HD' | 'SD';
    bytes: number;
  };
  filename: string;
  download_url: string;
  expires_in_hours: number;
}

function fmtMb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function TikTokDownloaderClient() {
  const [input, setInput] = useState('');
  const [quality, setQuality] = useState<'hd' | 'compat'>('hd');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DownloadResult | null>(null);
  const [copied, setCopied] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (loading || !input.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setCopied(false);
    try {
      const res = await fetch('/api/tools/tiktok-download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: input.trim(), quality })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || `เกิดข้อผิดพลาด (HTTP ${res.status})`);
        return;
      }
      setResult(data as DownloadResult);
    } catch {
      setError('เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ ตรวจอินเทอร์เน็ตแล้วลองใหม่');
    } finally {
      setLoading(false);
    }
  }

  async function copyLink() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.download_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('คัดลอกลิงก์ไม่สำเร็จ — คลิกขวาที่ปุ่มดาวน์โหลดแล้วเลือกคัดลอกลิงก์แทน');
    }
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <form onSubmit={submit} className="card p-4 sm:p-5 space-y-3">
        <div>
          <label className="field-label" htmlFor="tiktok-url">
            ลิงก์วิดีโอ TikTok
          </label>
          <input
            id="tiktok-url"
            type="text"
            inputMode="url"
            autoComplete="off"
            placeholder="https://www.tiktok.com/@user/video/… หรือ https://vt.tiktok.com/…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
          />
          <p className="text-xs text-gray-500 mt-1">วางทั้งข้อความที่กดแชร์มาได้เลย ระบบจะดึงลิงก์ให้เอง</p>
        </div>
        <div>
          <label className="field-label" htmlFor="tiktok-quality">
            คุณภาพไฟล์
          </label>
          <select id="tiktok-quality" value={quality} onChange={(e) => setQuality(e.target.value as 'hd' | 'compat')} disabled={loading}>
            <option value="hd">HD — คมชัดสุด (โคเดก HEVC บางเครื่อง/โปรแกรมอาจเปิดไม่ได้)</option>
            <option value="compat">เปิดได้ทุกเครื่อง (H.264) — ความละเอียดต่ำกว่า HD เล็กน้อย</option>
          </select>
        </div>
        <button type="submit" className="btn-primary w-full sm:w-auto" disabled={loading || !input.trim()}>
          {loading ? 'กำลังดึงวิดีโอ… (อาจใช้เวลา 10–30 วินาที)' : 'ดาวน์โหลดแบบไม่มีลายน้ำ'}
        </button>
      </form>

      {error && (
        <div role="alert" className="card p-4 text-sm text-red-700 border-red-300">
          {error}
        </div>
      )}

      {result && (
        <div className="card p-4 sm:p-5 flex flex-col sm:flex-row gap-4">
          {result.video.cover && (
            // eslint-disable-next-line @next/next/no-img-element -- remote signed TikTok CDN thumbnail, not worth next/image config
            <img
              src={result.video.cover}
              alt="ภาพปกวิดีโอ"
              referrerPolicy="no-referrer"
              className="w-full sm:w-32 h-48 sm:h-44 object-cover rounded-lg bg-gray-100 shrink-0"
            />
          )}
          <div className="min-w-0 flex-1 space-y-2">
            <div className="text-sm text-gray-500">
              {result.video.author ? `@${result.video.author}` : 'TikTok'}
              {result.video.duration_sec ? ` · ${result.video.duration_sec} วินาที` : ''}
              {' · '}
              {fmtMb(result.video.bytes)}
              {' · '}
              <span className="font-semibold text-gray-700">
                {result.video.quality === 'HD' ? 'HD (HEVC)' : 'เปิดได้ทุกเครื่อง (H.264)'}
              </span>
            </div>
            <p className="text-sm line-clamp-3 break-words">{result.video.title || '(ไม่มีคำบรรยาย)'}</p>
            <div className="flex flex-wrap gap-2 pt-1">
              <a href={result.download_url} className="btn-primary" download={result.filename}>
                บันทึกวิดีโอ (.mp4)
              </a>
              <button type="button" className="btn-secondary" onClick={copyLink}>
                {copied ? 'คัดลอกแล้ว ✓' : 'คัดลอกลิงก์'}
              </button>
            </div>
            <p className="text-xs text-gray-500">
              ลิงก์ใช้ได้ {result.expires_in_hours} ชั่วโมง — วางในช่อง &quot;ลิงก์วิดีโอ&quot; ของ Editor เพื่อตัดต่อต่อได้เลย
            </p>
          </div>
        </div>
      )}

      <p className="text-xs text-gray-500">
        ใช้กับคลิปของตัวเองหรือคลิปที่ได้รับอนุญาตเท่านั้น — การนำคลิปคนอื่นไปโพสต์ซ้ำอาจผิดข้อกำหนดของ TikTok และละเมิดลิขสิทธิ์
        ระบบใช้ตัวช่วยแปลงลิงก์ภายนอกที่ไม่เป็นทางการ จึงอาจใช้ไม่ได้เป็นบางช่วง
      </p>
    </div>
  );
}
