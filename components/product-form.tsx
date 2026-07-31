import type { Product } from '@/types/database';

export function ProductForm({
  product,
  action,
  error,
  submitLabel
}: {
  product?: Partial<Product>;
  action: (formData: FormData) => void;
  error?: string;
  submitLabel: string;
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

      <div className="flex gap-3">
        <button type="submit" className="btn-primary">{submitLabel}</button>
        <a href="/products" className="btn-secondary">ยกเลิก</a>
      </div>
    </form>
  );
}
