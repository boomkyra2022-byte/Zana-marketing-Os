import { TikTokDownloaderClient } from '@/components/tiktok-downloader-client';

export default function TikTokDownloaderPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">TikTok Downloader</h1>
        <p className="text-gray-500">
          วางลิงก์คลิป TikTok แล้วดาวน์โหลดเป็นไฟล์ MP4 ไม่มีลายน้ำ ความคมชัดสูงสุดที่ต้นฉบับมี (HD) — ลิงก์ที่ได้นำไปวางใน Editor
          เพื่อตัดต่อต่อได้
        </p>
      </div>
      <TikTokDownloaderClient />
    </div>
  );
}
