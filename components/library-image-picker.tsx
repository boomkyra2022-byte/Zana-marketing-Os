'use client';

import { useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

// Shared upload widget for Model Library reference photos AND Product
// Library packshots/reference images — same direct-to-Storage pattern
// already used by the Editor tool (components/editor-client.tsx) so a large
// photo never has to pass through a Vercel Function's 4.5MB request-body
// cap. Works both as a leaf inside a plain server-action <form> (via the
// hidden input it renders) and inside a client component that builds its
// own JSON payload (via the onChange callback) — Model Library uses the
// latter, the upgraded Product form uses the former.

export interface LibraryImage {
  path: string;
  signedUrl: string;
}

export function LibraryImagePicker({
  name,
  label,
  folder,
  multiple = true,
  maxFiles = 8,
  initial = [],
  onChange,
  help
}: {
  name: string;
  label: string;
  folder: string;
  multiple?: boolean;
  maxFiles?: number;
  initial?: LibraryImage[];
  onChange?: (paths: string[]) => void;
  help?: string;
}) {
  const [images, setImages] = useState<LibraryImage[]>(initial);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function commit(next: LibraryImage[]) {
    setImages(next);
    onChange?.(next.map((i) => i.path));
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setUploading(true);
    try {
      const supabase = createClient();
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) throw new Error('ต้องเข้าสู่ระบบก่อนอัปโหลด');

      const remaining = Math.max(maxFiles - images.length, 0);
      const toUpload = Array.from(files).slice(0, remaining);
      const next = [...images];
      for (const file of toUpload) {
        const ext = file.type.split('/')[1]?.split('+')[0] || file.name.split('.').pop() || 'jpg';
        const rand = Math.random().toString(36).slice(2, 8);
        const path = `${user.id}/${folder}/${Date.now()}_${rand}.${ext}`;
        const { error: uploadErr } = await supabase.storage.from('library-uploads').upload(path, file, {
          contentType: file.type,
          upsert: false
        });
        if (uploadErr) throw new Error(`อัปโหลด "${file.name}" ไม่สำเร็จ: ${uploadErr.message}`);
        next.push({ path, signedUrl: URL.createObjectURL(file) });
      }
      commit(next);
    } catch (e: any) {
      setError(e?.message || 'อัปโหลดไม่สำเร็จ');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function removeAt(idx: number) {
    commit(images.filter((_, i) => i !== idx));
  }

  return (
    <div>
      <label className="field-label">{label}</label>
      <input type="hidden" name={name} value={JSON.stringify(images.map((i) => i.path))} />
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {images.map((img, idx) => (
            <div key={img.path} className="relative w-20 h-20 rounded-lg overflow-hidden border border-border bg-surface">
              {/* eslint-disable-next-line @next/next/no-img-element -- Storage-signed / blob: preview URLs, not a static asset next/image can optimize */}
              <img src={img.signedUrl} alt="" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => removeAt(idx)}
                className="absolute top-0 right-0 bg-black/60 text-white text-xs w-5 h-5 flex items-center justify-center rounded-bl"
                aria-label="ลบรูปนี้"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple={multiple}
        disabled={uploading || images.length >= maxFiles}
        onChange={(e) => handleFiles(e.target.files)}
        className="text-sm"
      />
      {uploading && <p className="text-xs text-accentBlue mt-1">กำลังอัปโหลด...</p>}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      <p className="text-xs text-gray-500 mt-1">{help || `อัปโหลดตรงไปที่ Storage ไม่ผ่าน API — สูงสุด ${maxFiles} ไฟล์`}</p>
    </div>
  );
}
