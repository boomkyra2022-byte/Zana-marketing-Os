// ZANA Creative City — station data for /creative-city.
//
// Ported 1:1 from docs/creative-factory/zana-creative-city.html (the
// first single-page version of the map) with one change from the handoff
// (docs/creative-factory/CREATIVE_FACTORY_HANDOFF.md §5 / §8.1): station 5
// Editor is split into two competing positions, 5A (AI) and 5B (คน), so
// their output can be compared clip-for-clip.
//
// Status values are hard-coded as of 10 Nov 2026. Handoff §8.2 moves them
// into Supabase (multi-brand schema); keep this shape close to what the
// table rows will look like so the swap is a data-source change only.

export type StationStatus = 'ok' | 'todo' | 'human';

export type BuildingKind =
  | 'dome'
  | 'gable'
  | 'saw'
  | 'shed'
  | 'marquee'
  | 'gate'
  | 'columns'
  | 'billboard'
  | 'clock'
  | 'hall';

export interface Station {
  /** Stable key, also the label in the number badge ("5A"). */
  id: string;
  /** Pipeline step 1–10 (both editor positions are step 5). */
  step: number;
  name: string;
  sub: string;
  kind: BuildingKind;
  status: StationStatus;
  note: string;
  job: string;
  inp: string;
  out: string;
  who: string;
  dirs: string[];
  /** Wall / roof palette slots (--cc-w1..4 / --cc-r1..4). */
  w: 1 | 2 | 3 | 4;
  r: 1 | 2 | 3 | 4;
  /** Map placement. */
  x: number;
  y: number;
  scale?: number;
  hall?: boolean;
  /** Narrower pill used for the paired editor positions. */
  compact?: boolean;
  editorTrack?: 'AI' | 'HM';
}

export const STATUS_LABEL: Record<StationStatus, string> = {
  ok: 'พร้อมใช้',
  todo: 'รอสร้าง',
  human: 'คนทำ'
};

// Map geometry (SVG viewBox 0 0 720 1000).
export const CX = 360;
export const CY = 520;
const RX = 250;
const RY = 360;

function onRing(angleDeg: number) {
  const t = (angleDeg * Math.PI) / 180;
  return { x: Math.round(CX + RX * Math.sin(t)), y: Math.round(CY - RY * Math.cos(t)) };
}

// Angles were respaced from the original even 40° steps so the two editor
// buildings fit side by side at the bottom of the ring without crowding
// stations 4 and 6.
export const RING_ANGLES = [20, 58, 95, 132, 180, 228, 265, 302, 340];

type StationInput = Omit<Station, 'x' | 'y'> & { angle?: number; x?: number; y?: number };

const RAW: StationInput[] = [
  {
    id: '1', step: 1, name: 'Scout', sub: 'หาเทรนด์', kind: 'dome', angle: 20, w: 3, r: 1, status: 'ok',
    note: 'ตั้งแล้ว รันทุกวัน 05:35 น.',
    job: 'หาข่าว เทรนด์ มุมใหม่ และความเคลื่อนไหวของคู่แข่ง ทุกเช้า',
    inp: 'Brand Card + ผลแอดรอบก่อน', out: 'Trend Brief 5–8 หัวข้อ พร้อมลิงก์ที่มา', who: 'AI',
    dirs: ['02_TrendBrief']
  },
  {
    id: '2', step: 2, name: 'Content', sub: 'คิดไอเดีย', kind: 'gable', angle: 58, w: 2, r: 2, status: 'ok',
    note: 'ตั้งแล้ว รันต่อจาก Scout',
    job: 'เลือกหัวข้อ คิด hook 3 วินาทีแรก และเขียนสคริปต์',
    inp: 'Trend Brief + Brand Card', out: '5 ไอเดีย พร้อมสคริปต์ 15–30 วินาที', who: 'AI',
    dirs: ['03_Scripts']
  },
  {
    id: '3', step: 3, name: 'Prompt', sub: 'เจนฉาก', kind: 'saw', angle: 95, w: 4, r: 3, status: 'ok',
    note: 'ตั้งแล้ว รันต่อจาก Content',
    job: 'หามีม คิดฉาก เขียน prompt เจนภาพและฟุตเทจ',
    inp: 'สคริปต์', out: 'Scene List + prompt ต่อฉาก', who: 'AI',
    dirs: ['04_Footage/GEN', '04_Footage/MEME']
  },
  {
    id: '4', step: 4, name: 'Gap Check', sub: 'เช็กของขาด', kind: 'shed', angle: 132, w: 1, r: 4, status: 'ok',
    note: 'ตั้งแล้ว ส่ง Shot List ทุกเช้า',
    job: 'เทียบ Scene List กับคลังฟุตเทจ หาฉากที่ยังขาด',
    inp: 'Scene List + คลังฟุตเทจ', out: 'Shot List ให้บูมกับน้ำถ่ายเพิ่ม', who: 'AI ตรวจ, ทีม Content ถ่าย',
    dirs: ['05_ShotList']
  },
  {
    id: '5A', step: 5, name: 'Editor AI', sub: 'ตัดต่อ ตำแหน่ง A', kind: 'marquee', x: 285, y: 880, scale: 0.85,
    compact: true, editorTrack: 'AI', w: 3, r: 2, status: 'todo',
    note: 'ยังไม่มี template ตัดต่อ และยังไม่พบสกิล jangzana-video-editor ในเครื่อง',
    job: 'AI ตัดต่อตาม template เมื่อวัตถุดิบครบ (9:16, 15–30 วิ, ภาษาไทย)',
    inp: 'สคริปต์ + ฟุตเทจชุดเดียวกับตำแหน่ง B', out: 'คลิปร่าง + แคปชัน ชื่อไฟล์ลงท้าย _AI',
    who: 'AI (สกิล jangzana-video-editor)', dirs: ['06_Drafts']
  },
  {
    id: '5B', step: 5, name: 'Editor คน', sub: 'ตัดต่อ ตำแหน่ง B', kind: 'marquee', x: 435, y: 880, scale: 0.85,
    compact: true, editorTrack: 'HM', w: 2, r: 4, status: 'human',
    note: 'ทีม Content ตัดเอง แข่งกับตำแหน่ง A',
    job: 'ทีม Content ตัดต่อด้วยมือจากวัตถุดิบชุดเดียวกับตำแหน่ง A',
    inp: 'สคริปต์ + ฟุตเทจชุดเดียวกับตำแหน่ง A', out: 'คลิปร่าง + แคปชัน ชื่อไฟล์ลงท้าย _HM',
    who: 'ทีม Content', dirs: ['06_Drafts']
  },
  {
    id: '6', step: 6, name: 'อนุมัติ', sub: 'ด่านตรวจ', kind: 'gate', angle: 228, w: 4, r: 1, status: 'human',
    note: 'บูมตรวจเองทุกคลิป',
    job: 'ตรวจเคลม แบรนด์ ลิขสิทธิ์ ราคาและโปร',
    inp: 'คลิปร่าง _AI และ _HM + ลิงก์', out: 'ผ่าน / แก้ / ทิ้ง', who: 'บูม (งานลูกค้า: ลูกค้าตรวจชั้นที่ 2)',
    dirs: ['06_Drafts → 07_Approved']
  },
  {
    id: '7', step: 7, name: 'Drive', sub: 'คลังคลิป', kind: 'columns', angle: 265, w: 1, r: 3, status: 'todo',
    note: 'ยังไม่ได้สร้างโครงโฟลเดอร์',
    job: 'เก็บคลิปที่ผ่านเข้าคลัง และสรุปงานรายวัน',
    inp: 'คลิปที่ผ่านอนุมัติ', out: 'ลิงก์คลัง + Daily Summary', who: 'AI',
    dirs: ['07_Approved', '08_Reports']
  },
  {
    id: '8', step: 8, name: 'Ads', sub: 'ยิงแอด', kind: 'billboard', angle: 302, w: 2, r: 4, status: 'human',
    note: 'ทีมแอดเลือกคลิปเอง',
    job: 'เลือกคลิปจากคลังไปสร้างแคมเปญ คู่ _AI/_HM ยิงงบ กลุ่มเป้าหมาย และวันเริ่มเดียวกัน',
    inp: 'คลังคลิป', out: 'แคมเปญที่ยิงจริงในบัญชี Kid02', who: 'ทีมแอด',
    dirs: ['07_Approved']
  },
  {
    id: '9', step: 9, name: 'Report', sub: 'วัดผล', kind: 'clock', angle: 340, w: 3, r: 1, status: 'todo',
    note: 'ยังไม่ได้ตั้งรายงาน',
    job: 'สรุปผลหลังยิง 3–5 วัน ตามยอดรับของ COD และแยกผลสาย _AI กับ _HM',
    inp: 'ข้อมูลแอด + ออเดอร์', out: 'รายงานผลต่อคลิป', who: 'AI',
    dirs: ['08_Reports']
  },
  {
    id: '10', step: 10, name: 'CEO', sub: 'วางแผน', kind: 'hall', hall: true, x: CX, y: CY, w: 1, r: 2, status: 'human',
    note: 'บูมตัดสินใจรอบถัดไป',
    job: 'ตัดสินใจ scale ปรับ หรือหยุด',
    inp: 'รายงานผล', out: 'แผนรอบถัดไป ส่งกลับ Scout และ Content', who: 'บูม',
    dirs: ['08_Reports']
  }
];

export const STATIONS: Station[] = RAW.map(({ angle, x, y, ...rest }) => {
  const pos = angle !== undefined ? onRing(angle) : { x: x ?? CX, y: y ?? CY };
  return { ...rest, x: pos.x, y: pos.y };
});

// Draft contest rules for the two editor positions — handoff §5, proposed
// by บูม on 10 Nov 2026, NOT yet confirmed. Shown on the 5A/5B panels.
export const EDITOR_CONTEST_RULES = [
  'ทั้งสองตำแหน่งตัดจากสคริปต์และฟุตเทจชุดเดียวกัน',
  'ยิงแอดด้วยงบ กลุ่มเป้าหมาย และวันเริ่มเดียวกัน',
  'ชื่อไฟล์คลิปลงท้าย _AI หรือ _HM',
  'เก็บอย่างน้อย 10 คู่ก่อนสรุป',
  'วัด: ต้นทุนต่อคลิป, เวลาต่อคลิป, อัตราผ่านอนุมัติรอบแรก, CAC ต่อคลิป, กำไรต่อคลิปหลังยอดรับของ COD'
];
