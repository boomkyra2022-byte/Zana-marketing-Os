import type { Product } from '@/types/database';
import { LibraryImagePicker, type LibraryImage } from '@/components/library-image-picker';

export function ProductForm({
  product,
  action,
  error,
  submitLabel,
  initialPackshots = [],
  initialReferenceImages = []
}: {
  product?: Partial<Product>;
  action: (formData: FormData) => void;
  error?: string;
  submitLabel: string;
  // Pre-signed URLs for this product's already-saved packshots/reference
  // images (server component computes these via signLibraryPaths before
  // rendering — a client component can't sign with the service-role key).
  initialPackshots?: LibraryImage[];
  initialReferenceImages?: LibraryImage[];
}) {
  return (
    <form action={action} className="space-y-6 max-w-3xl">
      {error && <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="field-label" htmlFor="brand">Brand *</label>
          <input id="brand" name="brand" defaultValue={product?.brand ?? ''} required />
        </div>
        <div>
          <label className="field-label" htmlFor="product_name">Product Name *</label>
          <input id="product_name" name="product_name" defaultValue={product?.product_name ?? ''} required />
        </div>
        <div>
          <label className="field-label" htmlFor="sku">SKU</label>
          <input id="sku" name="sku" defaultValue={product?.sku ?? ''} />
        </div>
        <div>
          <label className="field-label" htmlFor="category">Category</label>
          <input id="category" name="category" defaultValue={product?.category ?? ''} />
        </div>
        <div>
          <label className="field-label" htmlFor="status">Status</label>
          <select id="status" name="status" defaultValue={product?.status ?? 'active'}>
            <option value="active">active</option>
            <option value="inactive">inactive</option>
            <option value="discontinued">discontinued</option>
          </select>
        </div>
        <div className="flex items-end gap-2 pb-2">
          <input id="is_hero" name="is_hero" type="checkbox" defaultChecked={product?.is_hero ?? false} />
          <label htmlFor="is_hero" className="mb-0">Hero product</label>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="field-label" htmlFor="selling_price">Selling Price</label>
          <input id="selling_price" name="selling_price" type="number" step="0.01" defaultValue={product?.selling_price ?? ''} />
        </div>
        <div>
          <label className="field-label" htmlFor="promotion_price">Promotion Price</label>
          <input id="promotion_price" name="promotion_price" type="number" step="0.01" defaultValue={product?.promotion_price ?? ''} />
        </div>
        <div>
          <label className="field-label" htmlFor="cogs">COGS</label>
          <input id="cogs" name="cogs" type="number" step="0.01" defaultValue={product?.cogs ?? ''} />
        </div>
      </div>

      <div>
        <label className="field-label" htmlFor="usp">USP</label>
        <textarea id="usp" name="usp" rows={2} defaultValue={product?.usp ?? ''} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="field-label" htmlFor="ingredients">Ingredients / Material</label>
          <textarea id="ingredients" name="ingredients" rows={2} defaultValue={product?.ingredients ?? ''} />
        </div>
        <div>
          <label className="field-label" htmlFor="benefits">Benefits</label>
          <textarea id="benefits" name="benefits" rows={2} defaultValue={product?.benefits ?? ''} />
        </div>
        <div>
          <label className="field-label" htmlFor="usage">Usage</label>
          <textarea id="usage" name="usage" rows={2} defaultValue={product?.usage ?? ''} />
        </div>
        <div>
          <label className="field-label" htmlFor="customer_objections">Customer Objections</label>
          <textarea id="customer_objections" name="customer_objections" rows={2} defaultValue={product?.customer_objections ?? ''} />
        </div>
        <div>
          <label className="field-label" htmlFor="allowed_claims">Allowed Claims</label>
          <textarea id="allowed_claims" name="allowed_claims" rows={2} defaultValue={product?.allowed_claims ?? ''} />
        </div>
        <div>
          <label className="field-label" htmlFor="banned_claims">Banned Claims</label>
          <textarea id="banned_claims" name="banned_claims" rows={2} defaultValue={product?.banned_claims ?? ''} />
        </div>
      </div>
      <div>
        <label className="field-label" htmlFor="compliance_notes">Compliance Notes</label>
        <textarea id="compliance_notes" name="compliance_notes" rows={2} defaultValue={product?.compliance_notes ?? ''} />
      </div>

      {/* Product Library upgrade — explicit spec: "ภาพสินค้าจริง...ใช้เป็น
          Source of Truth". packshots/reference_images are LibraryImagePicker
          leaves (client components) rendered inside this otherwise
          server-action form; each writes its own hidden JSON-array input,
          parsed back out by productPayload() in actions.ts. */}
      <div className="grid grid-cols-2 gap-4">
        <LibraryImagePicker
          name="packshots"
          label="Packshot จริง (Source of Truth — ห้าม AI วาดใหม่)"
          folder="products"
          maxFiles={6}
          initial={initialPackshots}
        />
        <LibraryImagePicker
          name="reference_images"
          label="ภาพอ้างอิงเพิ่มเติม (ไม่บังคับ)"
          folder="products"
          maxFiles={6}
          initial={initialReferenceImages}
        />
      </div>

      <div className="flex items-center gap-2">
        <input id="preserve_packaging" name="preserve_packaging" type="checkbox" defaultChecked={product?.preserve_packaging ?? true} />
        <label htmlFor="preserve_packaging" className="mb-0">Preserve Packaging 100% (ห้ามเปลี่ยนโลโก้/รูปทรง/สี/ข้อความบนแพ็กเกจ)</label>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="field-label" htmlFor="target_audience">Target Audience</label>
          <textarea id="target_audience" name="target_audience" rows={2} defaultValue={product?.target_audience ?? ''} />
        </div>
        <div>
          <label className="field-label" htmlFor="pain_points">Pain Points</label>
          <textarea id="pain_points" name="pain_points" rows={2} defaultValue={product?.pain_points ?? ''} />
        </div>
        <div>
          <label className="field-label" htmlFor="product_reasons">Product Reasons (เหตุผลที่ควรซื้อ)</label>
          <textarea id="product_reasons" name="product_reasons" rows={2} defaultValue={product?.product_reasons ?? ''} />
        </div>
        <div>
          <label className="field-label" htmlFor="proofs">Proofs (หลักฐาน/รีวิว/ผลลัพธ์)</label>
          <textarea id="proofs" name="proofs" rows={2} defaultValue={product?.proofs ?? ''} />
        </div>
        <div>
          <label className="field-label" htmlFor="promotion">Promotion / Offer</label>
          <input id="promotion" name="promotion" defaultValue={product?.promotion ?? ''} />
        </div>
        <div>
          <label className="field-label" htmlFor="cta">CTA</label>
          <input id="cta" name="cta" defaultValue={product?.cta ?? ''} />
        </div>
        <div>
          <label className="field-label" htmlFor="brand_colors">Brand Colors</label>
          <input id="brand_colors" name="brand_colors" placeholder="เช่น #FF6B9D, #FFFFFF" defaultValue={product?.brand_colors ?? ''} />
        </div>
        <div>
          <label className="field-label" htmlFor="registration_number">เลขที่จดแจ้ง / อย.</label>
          <input id="registration_number" name="registration_number" defaultValue={product?.registration_number ?? ''} />
        </div>
      </div>

      <div>
        <label className="field-label" htmlFor="packaging_lock_prompt">Packaging Lock Prompt (ไม่บังคับ — ปล่อยว่างให้ระบบสร้างให้อัตโนมัติ)</label>
        <textarea id="packaging_lock_prompt" name="packaging_lock_prompt" rows={2} defaultValue={product?.packaging_lock_prompt ?? ''} />
      </div>

      <div className="flex gap-3">
        <button type="submit" className="btn-primary">{submitLabel}</button>
        <a href="/products" className="btn-secondary">ยกเลิก</a>
      </div>
    </form>
  );
}
