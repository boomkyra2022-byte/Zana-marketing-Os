export function PhasePlaceholder({ title, phase }: { title: string; phase: number }) {
  return (
    <div className="card p-8 text-center">
      <h2 className="text-xl font-semibold mb-2">{title}</h2>
      <p className="text-gray-400">
        ยังไม่ถูกสร้าง — อยู่ใน Phase {phase} ตามแผนใน{' '}
        <code className="text-accentTeal">PLAN.md</code> / <code className="text-accentTeal">TODO.md</code>
      </p>
      <p className="text-gray-500 text-sm mt-2">
        หน้านี้จะแสดงข้อมูลจริงจาก Database เมื่อ Phase {phase} ถูก implement — ไม่มีข้อมูลตัวอย่างปลอมแสดงที่นี่
      </p>
    </div>
  );
}
