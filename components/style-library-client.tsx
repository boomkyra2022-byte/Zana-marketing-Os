'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  DEMO_PURPOSES, MAX_DEMO_BYTES, STYLE_DEMO_BUCKET,
  type StyleCode, type StyleDemo, type VideoStyle,
} from '@/lib/style-library/types';

type Library = { styles: VideoStyle[]; demos: StyleDemo[]; canWrite: boolean };
type UploadTarget = { path: string; token: string };
type PreparedUpload = { id: string; video: UploadTarget; poster: UploadTarget };

const filters = [
  { key: 'demo', label: 'มีคลิปตัวอย่าง' },
  { key: 'ads', label: 'เหมาะกับแอด' },
  { key: 'zana', label: 'ใช้กับ ZANA ได้' },
  { key: 'faceless', label: 'ไม่ต้องออกหน้า' },
] as const;

const fieldClass = 'w-full rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-sm';
const demoRoute = '/api/style-library/demos';

async function requestJson<T>(url: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method,
    cache: 'no-store',
    ...(body === undefined ? {} : {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result) throw new Error(result?.error ?? 'เชื่อมต่อไม่สำเร็จ');
  return result as T;
}

function message(error: unknown) {
  return error instanceof Error ? error.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่';
}

async function capturePoster(file: File) {
  const video = document.createElement('video');
  const url = URL.createObjectURL(file);
  video.muted = true;
  video.playsInline = true;
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    return await new Promise<{ poster: Blob; duration: number }>((resolve, reject) => {
      timeout = setTimeout(() => reject(new Error('อ่านเฟรมวิดีโอไม่สำเร็จ')), 15000);
      video.onerror = () => reject(new Error('เบราว์เซอร์เปิดวิดีโอไฟล์นี้ไม่ได้'));
      video.onloadeddata = () => {
        if (!Number.isFinite(video.duration) || video.duration <= 0 || !video.videoWidth) {
          reject(new Error('ไฟล์วิดีโอไม่มีภาพหรือไม่มีความยาว'));
          return;
        }
        video.currentTime = video.duration > 1 ? 1 : video.duration / 2;
      };
      video.onseeked = () => {
        const canvas = document.createElement('canvas');
        const scale = Math.min(1, 960 / Math.max(video.videoWidth, video.videoHeight));
        canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
        canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
        const context = canvas.getContext('2d');
        if (!context) {
          reject(new Error('สร้างภาพปกไม่ได้'));
          return;
        }
        const duration = video.duration;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((poster) => {
          if (poster) resolve({ poster, duration });
          else reject(new Error('สร้างภาพปก JPG ไม่สำเร็จ'));
        }, 'image/jpeg', 0.88);
      };
      video.src = url;
    });
  } finally {
    clearTimeout(timeout);
    video.removeAttribute('src');
    video.load();
    URL.revokeObjectURL(url);
  }
}

function UploadForm({ style, onUploaded }: { style: VideoStyle; onUploaded: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState<{ id: string; duration_s: number }>();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    setBusy(true);
    setNotice('');

    try {
      let upload = pending;
      if (!upload) {
        const input = fields.get('video');
        if (!(input instanceof File) || !/\.mp4$/i.test(input.name) || input.size === 0 || input.size > MAX_DEMO_BYTES) {
          throw new Error('เลือกไฟล์ MP4 ขนาดไม่เกิน 50 MB');
        }
        const video = input.type === 'video/mp4' ? input : new File([input], input.name, { type: 'video/mp4' });
        const { poster, duration } = await capturePoster(video);
        const targets = await requestJson<PreparedUpload>(demoRoute, 'POST', { action: 'prepare' });
        const bucket = createClient().storage.from(STYLE_DEMO_BUCKET);
        const results = await Promise.allSettled([
          bucket.uploadToSignedUrl(targets.video.path, targets.video.token, video, { contentType: 'video/mp4' }),
          bucket.uploadToSignedUrl(targets.poster.path, targets.poster.token, poster, { contentType: 'image/jpeg' }),
        ]);
        const failed = results.find((result) => result.status === 'rejected' || result.value.error);
        if (failed) {
          await bucket.remove([targets.video.path, targets.poster.path]).catch(() => undefined);
          throw failed.status === 'rejected' ? failed.reason : failed.value.error;
        }
        upload = { id: targets.id, duration_s: duration };
        setPending(upload);
      }

      await requestJson(demoRoute, 'POST', {
        action: 'complete',
        ...upload,
        style_code: style.code,
        title: fields.get('title'),
        brand: fields.get('brand'),
        purpose: fields.get('purpose'),
        notes: fields.get('notes') || null,
      });

      setPending(undefined);
      form.reset();
      setNotice('เพิ่มคลิปตัวอย่างแล้ว');
      await onUploaded();
    } catch (error) {
      setNotice(message(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <details>
      <summary className="btn-secondary w-fit cursor-pointer">อัปโหลดคลิปตัวอย่าง</summary>
      <form className="mt-3 grid gap-3" onSubmit={submit}>
        {!pending && <label>วิดีโอ MP4 สูงสุด 50 MB<input className={fieldClass} type="file" name="video" accept="video/mp4,.mp4" required /></label>}
        <label>ชื่อคลิป<input className={fieldClass} name="title" required maxLength={200} /></label>
        <label>แบรนด์<input className={fieldClass} name="brand" defaultValue="จ้างซาน่า" required maxLength={120} /></label>
        <label>วัตถุประสงค์<select className={fieldClass} name="purpose">{DEMO_PURPOSES.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>หมายเหตุ<textarea className={fieldClass} name="notes" maxLength={2000} /></label>
        <button type="submit" className="btn-primary w-fit" disabled={busy}>{busy ? 'กำลังบันทึก…' : pending ? 'ลองบันทึกอีกครั้ง' : 'บันทึกเป็น Draft'}</button>
      </form>
      {notice && <p className="mt-2 text-sm" role="status">{notice}</p>}
    </details>
  );
}

function StyleCard({ style, demos, canWrite, refresh, choose }: {
  style: VideoStyle;
  demos: StyleDemo[];
  canWrite: boolean;
  refresh: () => Promise<void>;
  choose: (code: StyleCode) => void;
}) {
  const [selectedId, setSelectedId] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const demo = demos.find(({ id }) => id === selectedId) ?? demos[0];

  async function act(operation: () => Promise<string>) {
    setBusy(true);
    setNotice('');
    try { setNotice(await operation()); }
    catch (error) { setNotice(message(error)); }
    finally { setBusy(false); }
  }

  return (
    <article className="card grid content-start gap-3 p-4 text-sm">
      <h2 className="text-lg font-semibold"><span className="mr-2 text-[var(--accent-terracotta)]">{style.code}</span>{style.name_th}</h2>
      <p>{style.best_for}</p>
      <p className="text-gray-500">วัตถุดิบ {style.material_needed}</p>
      <p className="text-gray-500">
        {[style.ad_ok ? 'เหมาะกับแอด' : 'ออร์แกนิก', style.zana_ok ? 'ใช้กับ ZANA ได้' : 'งดใช้กับสินค้าเด็ก ZANA', style.needs_face ? 'ต้องออกหน้า' : 'ไม่ต้องออกหน้า'].join(' · ')}
      </p>
      {demo ? (
        <>
          {demo.video_url ? (
            <video key={demo.id} className="aspect-video w-full rounded-lg bg-black object-contain"
              src={demo.video_url} poster={demo.poster_url ?? undefined} preload="metadata" autoPlay muted loop playsInline controls aria-label={demo.title} />
          ) : <p className="rounded-lg bg-gray-100 p-4 text-gray-700">เปิดไฟล์วิดีโอนี้ไม่ได้</p>}
          <label>คลิปตัวอย่าง
            <select className={fieldClass} value={demo.id} onChange={(event) => setSelectedId(event.target.value)}>
              {demos.map((item) => <option key={item.id} value={item.id}>{item.title} · {item.brand} · {item.status}</option>)}
            </select>
          </label>
          <p>{demo.purpose} · {Math.round(demo.duration_s)} วิ{demo.notes && ' · ' + demo.notes}</p>
          {canWrite && <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary" disabled={busy} onClick={() => void act(async () => {
              await requestJson(demoRoute, 'PATCH', { id: demo.id, status: demo.status === 'draft' ? 'approved' : 'draft' });
              await refresh();
              return 'อัปเดตสถานะแล้ว';
            })}>{demo.status === 'draft' ? 'อนุมัติคลิป' : 'เปลี่ยนเป็น Draft'}</button>
            <button type="button" className="btn-secondary" disabled={busy} onClick={() => {
              if (!window.confirm('ลบคลิปตัวอย่าง “' + demo.title + '” หรือไม่?')) return;
              void act(async () => {
                const result = await requestJson<{ warning?: string }>(demoRoute + '?id=' + demo.id, 'DELETE');
                await refresh();
                return result.warning ?? 'ลบคลิปแล้ว';
              });
            }}>ลบคลิป</button>
          </div>}
        </>
      ) : <p className="grid aspect-video place-items-center rounded-lg border border-dashed border-gray-300 text-gray-500">ยังไม่มีคลิปตัวอย่าง</p>}
      {canWrite && <UploadForm style={style} onUploaded={refresh} />}
      <button type="button" className="btn-primary w-fit" onClick={() => choose(style.code)}>ใช้สไตล์นี้สร้างคำสั่ง</button>
      <details>
        <summary className="btn-secondary w-fit cursor-pointer">คำสั่งสำเร็จรูป จ้างซาน่า</summary>
        <textarea aria-label="คำสั่งสำเร็จรูป จ้างซาน่า" className={fieldClass + ' mt-2'} rows={10}
          value={editing ?? style.order_template} readOnly={!canWrite} maxLength={20000}
          onChange={(event) => setEditing(event.target.value)} />
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" className="btn-secondary" disabled={busy} onClick={() => void act(async () => {
            await navigator.clipboard.writeText(editing ?? style.order_template);
            return 'คัดลอกคำสั่งแล้ว';
          })}>คัดลอกคำสั่ง</button>
          {canWrite && editing !== null && <button type="button" className="btn-primary" disabled={busy || !editing.trim()} onClick={() => void act(async () => {
            await requestJson('/api/style-library', 'PATCH', { code: style.code, order_template: editing });
            await refresh();
            setEditing(null);
            return 'บันทึกคำสั่งแล้ว';
          })}>บันทึกคำสั่งสำเร็จรูป</button>}
        </div>
      </details>
      {notice && <p role="status">{notice}</p>}
    </article>
  );
}

const briefFields = [
  ['duration', 'ความยาว (วินาที)'],
  ['brand', 'แบรนด์ / ลูกค้า'],
  ['voice', 'เสียง'],
  ['materials', 'วัตถุดิบ'],
  ['offer', 'ข้อความหลัก / ข้อเสนอ'],
  ['confirmed', 'วันที่ยืนยันราคา'],
  ['music', 'เพลง'],
] as const;

function OrderBuilder({ styles, code, setCode }: {
  styles: VideoStyle[];
  code: StyleCode;
  setCode: (code: StyleCode) => void;
}) {
  const [purpose, setPurpose] = useState('ออร์แกนิก');
  const [brief, setBrief] = useState({ duration: '45', brand: '', voice: '', materials: '', offer: '', confirmed: '', music: '' });
  const [copyNotice, setCopyNotice] = useState('');
  const style = styles.find((item) => item.code === code) ?? styles[0];
  if (!style) return null;

  const offer = brief.offer.trim();
  const brand = brief.brand.normalize('NFKC');
  const text = Object.values(brief).join(' ').normalize('NFKC');
  const hasPrice = /(?:ราคา|฿|บาท|[฿$€£]|THB|USD|(?:โปร|ลดเหลือ|เหลือ|เพียง|แค่)\s*[\d๐-๙]|[\d๐-๙][\d๐-๙,.]*\s*-\s*(?:$|\s))/iu.test(offer);
  const warnings = [
    !style.zana_ok && /zana|ซาน่า/iu.test(brand) && !/จ้าง\s*ซาน่า|jang\s*zana/iu.test(brand) && 'สไตล์นี้ไม่เหมาะกับสินค้าเด็ก ZANA',
    hasPrice && !brief.confirmed && 'มีราคาในข้อเสนอ กรุณาระบุวันที่ยืนยันราคา',
    /รวย|การันตี|[1๑][0๐][0๐]\s*[%％]|หายป่วย/u.test(text) && 'ตรวจข้อความที่มีคำว่า รวย, การันตี, 100% หรือ หายป่วย ก่อนนำไปใช้',
  ].filter(Boolean);

  const order = [
    'ใช้สกิล jangzana-video-editor ตัดคลิปให้หน่อย',
    'สไตล์: ' + style.code + ' ' + style.name_th,
    'ใช้ทำ: ' + purpose,
    'ความยาว: ' + (brief.duration || '[ระบุ]') + ' วิ',
    'แบรนด์: ' + (brief.brand.trim() || '[ระบุ]'),
    'เสียง: ' + (brief.voice.trim() || '[ระบุ]'),
    'วัตถุดิบ: ' + (brief.materials.trim() || '[ระบุ]'),
    'ข้อความหลัก / ข้อเสนอ: ' + (offer || '[ระบุ]'),
    ...(brief.confirmed ? ['วันที่ยืนยันราคา: ' + brief.confirmed] : []),
    'เพลง: ' + (brief.music.trim() || '[ระบุ]'),
    ...(purpose === 'แอด' ? ['(ใช้โครง ADS45: เสนอ 3 Angle ให้เลือกก่อน)'] : []),
    'เริ่มจากส่งแผน + ชุดเตรียมงานให้ดูก่อน ยังไม่ต้องตัด',
  ].join('\n');

  return (
    <section id="style-order" tabIndex={-1} className="card grid scroll-mt-20 gap-4 p-5 text-sm">
      <h2 className="text-lg font-semibold">ตัวสร้างคำสั่งตัดต่อ</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label>สไตล์<select className={fieldClass} value={style.code} onChange={(event) => { setCode(event.target.value as StyleCode); setCopyNotice(''); }}>
          {styles.map((item) => <option key={item.code} value={item.code}>{item.code} · {item.name_th}</option>)}
        </select></label>
        <label>ใช้ทำ<select className={fieldClass} value={purpose} onChange={(event) => { setPurpose(event.target.value); setCopyNotice(''); }}>
          {['แอด', 'ออร์แกนิก', 'สอน'].map((item) => <option key={item}>{item}</option>)}
        </select></label>
        {briefFields.map(([key, label]) => (
          <label key={key}>{label}
            {key === 'offer' || key === 'materials' ? (
              <textarea className={fieldClass} rows={2} value={brief[key]} onChange={(event) => { setBrief({ ...brief, [key]: event.target.value }); setCopyNotice(''); }} />
            ) : (
              <input className={fieldClass} type={key === 'confirmed' ? 'date' : key === 'duration' ? 'number' : 'text'}
                min={key === 'duration' ? 1 : undefined} value={brief[key]}
                onChange={(event) => { setBrief({ ...brief, [key]: event.target.value }); setCopyNotice(''); }} />
            )}
          </label>
        ))}
      </div>
      {warnings.length > 0 && <ul className="list-disc rounded-lg bg-amber-50 py-2 pl-6 text-amber-900" aria-live="polite">
        {warnings.map((warning) => <li key={String(warning)}>{warning}</li>)}
      </ul>}
      <textarea aria-label="คำสั่งตัดต่อ" className={fieldClass} readOnly rows={12} value={order} />
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn-primary" onClick={async () => {
          try { await navigator.clipboard.writeText(order); setCopyNotice('คัดลอกคำสั่งแล้ว'); }
          catch (error) { setCopyNotice(message(error)); }
        }}>คัดลอกคำสั่ง</button>
        {copyNotice && <p role="status">{copyNotice}</p>}
      </div>
    </section>
  );
}

export default function StyleLibraryClient() {
  const [library, setLibrary] = useState<Library>();
  const [error, setError] = useState('');
  const [active, setActive] = useState<string[]>([]);
  const [selectedCode, setSelectedCode] = useState<StyleCode>('A');

  const refresh = useCallback(async () => {
    try {
      setLibrary(await requestJson<Library>('/api/style-library'));
      setError('');
    } catch (reason) { setError(message(reason)); }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = setInterval(() => void refresh(), 50 * 60 * 1000);
    function refreshOnReturn() {
      if (document.visibilityState === 'visible') void refresh();
    }
    document.addEventListener('visibilitychange', refreshOnReturn);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', refreshOnReturn);
    };
  }, [refresh]);

  const visibleStyles = library?.styles.filter((style) =>
    (!active.includes('demo') || library.demos.some((demo) => demo.style_code === style.code)) &&
    (!active.includes('ads') || style.ad_ok) &&
    (!active.includes('zana') || style.zana_ok) &&
    (!active.includes('faceless') || !style.needs_face)
  );

  return (
    <div className="grid gap-5">
      <h1 className="text-2xl font-bold">Style Library</h1>
      {error && <div className="card flex items-center gap-3 p-4" role="alert">
        <p>โหลดคลังไม่สำเร็จ {error}</p>
        <button type="button" className="btn-secondary" onClick={() => void refresh()}>ลองใหม่</button>
      </div>}
      {!library && !error && <p role="status">กำลังโหลดคลังสไตล์…</p>}
      {library && <>
        <div className="flex flex-wrap gap-2" aria-label="ตัวกรองสไตล์">
          {filters.map(({ key, label }) => <button type="button" key={key} aria-pressed={active.includes(key)}
            className={active.includes(key) ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setActive((items) => items.includes(key) ? items.filter((item) => item !== key) : [...items, key])}>{label}</button>)}
        </div>
        {visibleStyles?.length === 0 && <p>ไม่พบสไตล์ที่ตรงกับตัวกรอง</p>}
        <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleStyles?.map((style) => <StyleCard key={style.code} style={style}
            demos={library.demos.filter((demo) => demo.style_code === style.code)}
            canWrite={library.canWrite} refresh={refresh} choose={(code) => {
              setSelectedCode(code);
              const builder = document.getElementById('style-order');
              builder?.focus({ preventScroll: true });
              builder?.scrollIntoView({ block: 'start' });
            }} />)}
        </div>
        <OrderBuilder styles={library.styles} code={selectedCode} setCode={setSelectedCode} />
      </>}
    </div>
  );
}
