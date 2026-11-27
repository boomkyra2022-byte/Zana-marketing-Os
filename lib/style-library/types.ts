export const STYLE_CODES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'] as const;
export const DEMO_PURPOSES = ['แอด', 'ออร์แกนิก'] as const;
export const DEMO_STATUSES = ['draft', 'approved'] as const;
export const STYLE_DEMO_BUCKET = 'style-demos';
export const MAX_DEMO_BYTES = 50 * 1024 * 1024;

export type StyleCode = typeof STYLE_CODES[number];
export type VideoStyle = {
  code: StyleCode;
  name_th: string;
  best_for: string;
  material_needed: string;
  zana_ok: boolean;
  needs_face: boolean;
  ad_ok: boolean;
  order_template: string;
  sort: number;
  updated_at: string;
};

export type StyleDemo = {
  id: string;
  style_code: StyleCode;
  title: string;
  brand: string;
  duration_s: number;
  purpose: typeof DEMO_PURPOSES[number];
  status: typeof DEMO_STATUSES[number];
  notes: string | null;
  video_url: string | null;
  poster_url: string | null;
};
