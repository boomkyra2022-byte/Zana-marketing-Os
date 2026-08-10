// Delivers large Editor-tool result files to the browser without ever
// passing them through a Vercel Function's response body (hard 4.5MB cap,
// infra-level, not configurable). Server uploads the processed file to a
// private Supabase Storage bucket using the service-role client, then hands
// the browser a short-lived signed URL — the actual bytes flow browser ⟷
// Supabase's storage CDN directly.

import { randomUUID } from 'node:crypto';
import { createServiceRoleClient } from './server';

const BUCKET = 'edited-clips';
const SIGNED_URL_TTL_SEC = 60 * 60 * 24; // 24h — enough to download and to chain into the next Editor step

export async function uploadEditedClip(
  buffer: Buffer,
  filename: string,
  contentType: string
): Promise<{ path: string; signedUrl: string }> {
  const serviceClient = createServiceRoleClient();
  const path = `${randomUUID()}/${filename}`;

  const { error: uploadError } = await serviceClient.storage.from(BUCKET).upload(path, buffer, {
    contentType,
    upsert: false
  });
  if (uploadError) {
    throw new Error(`อัปโหลดผลลัพธ์ไปยัง Storage ไม่สำเร็จ: ${uploadError.message}`);
  }

  const { data: signedData, error: signError } = await serviceClient.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SEC);
  if (signError || !signedData?.signedUrl) {
    throw new Error(`สร้างลิงก์ดาวน์โหลดไม่สำเร็จ: ${signError?.message || 'unknown error'}`);
  }

  return { path, signedUrl: signedData.signedUrl };
}

// Re-issues a fresh signed URL for an already-uploaded result (e.g. when the
// original 24h link has expired but the file itself is still in the bucket).
export async function resignEditedClip(path: string): Promise<string> {
  const serviceClient = createServiceRoleClient();
  const { data, error } = await serviceClient.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL_SEC);
  if (error || !data?.signedUrl) {
    throw new Error(`สร้างลิงก์ดาวน์โหลดไม่สำเร็จ: ${error?.message || 'unknown error'}`);
  }
  return data.signedUrl;
}
