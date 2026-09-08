'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

function num(formData: FormData, key: string): number | null {
  const raw = formData.get(key);
  if (raw === null || raw === '') return null;
  const n = Number(raw);
  return Number.isNaN(n) ? null : n;
}

function str(formData: FormData, key: string): string | null {
  const raw = formData.get(key);
  if (raw === null) return null;
  const s = String(raw).trim();
  return s === '' ? null : s;
}

// Packshots/reference images arrive as a JSON-stringified array of Storage
// paths, written into a hidden input by LibraryImagePicker (see
// components/library-image-picker.tsx) after the browser uploads the actual
// file bytes straight to the `library-uploads` bucket — this form never
// receives raw file bytes.
function pathArray(formData: FormData, key: string): string[] {
  const raw = formData.get(key);
  if (raw === null) return [];
  try {
    const parsed = JSON.parse(String(raw));
    return Array.isArray(parsed) ? parsed.filter((p) => typeof p === 'string') : [];
  } catch {
    return [];
  }
}

function productPayload(formData: FormData) {
  return {
    brand: str(formData, 'brand') ?? '',
    sku: str(formData, 'sku'),
    product_name: str(formData, 'product_name') ?? '',
    category: str(formData, 'category'),
    status: str(formData, 'status') ?? 'active',
    selling_price: num(formData, 'selling_price'),
    promotion_price: num(formData, 'promotion_price'),
    cogs: num(formData, 'cogs'),
    usp: str(formData, 'usp'),
    ingredients: str(formData, 'ingredients'),
    benefits: str(formData, 'benefits'),
    usage: str(formData, 'usage'),
    customer_objections: str(formData, 'customer_objections'),
    allowed_claims: str(formData, 'allowed_claims'),
    banned_claims: str(formData, 'banned_claims'),
    compliance_notes: str(formData, 'compliance_notes'),
    is_hero: formData.get('is_hero') === 'on',
    // Product Library upgrade (explicit spec) — additive fields
    packshots: pathArray(formData, 'packshots'),
    reference_images: pathArray(formData, 'reference_images'),
    brand_colors: str(formData, 'brand_colors'),
    target_audience: str(formData, 'target_audience'),
    pain_points: str(formData, 'pain_points'),
    product_reasons: str(formData, 'product_reasons'),
    proofs: str(formData, 'proofs'),
    promotion: str(formData, 'promotion'),
    cta: str(formData, 'cta'),
    registration_number: str(formData, 'registration_number'),
    packaging_lock_prompt: str(formData, 'packaging_lock_prompt'),
    preserve_packaging: formData.get('preserve_packaging') === 'on' // same convention as is_hero above — unchecked checkboxes send nothing at all
  };
}

export async function createProduct(formData: FormData) {
  const supabase = createClient();
  const payload = productPayload(formData);

  if (!payload.brand || !payload.product_name) {
    redirect('/products/new?error=' + encodeURIComponent('Brand and Product Name are required'));
  }

  const { error } = await supabase.from('products').insert(payload);
  if (error) redirect('/products/new?error=' + encodeURIComponent(error.message));

  revalidatePath('/products');
  redirect('/products');
}

export async function updateProduct(id: string, formData: FormData) {
  const supabase = createClient();
  const payload = productPayload(formData);

  const { error } = await supabase
    .from('products')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) redirect(`/products/${id}?error=` + encodeURIComponent(error.message));

  revalidatePath('/products');
  redirect('/products');
}

// Non-redirecting variant for use from client components that shouldn't
// navigate away — explicit user request from the Banner Generator tool
// ("ถ้าอันไหนเป็นสินค้าใหม่ ไม่มีในคลัง ให้กดเพิ่มข้อมูลใหม่ตามนี้เลยก็ได้"):
// let a brand-new product typed into that form be saved straight into the
// shared Products catalog without leaving the page. Same `products` table,
// same RLS, just returns instead of redirecting.
export interface QuickProductPayload {
  brand: string;
  product_name: string;
  category?: string | null;
  usp?: string | null;
  ingredients?: string | null;
  benefits?: string | null;
  usage?: string | null;
  allowed_claims?: string | null;
  banned_claims?: string | null;
  compliance_notes?: string | null;
  selling_price?: number | null;
  promotion_price?: number | null;
}

export async function createProductQuick(
  payload: QuickProductPayload
): Promise<{ id: string; product_name: string; brand: string } | { error: string }> {
  const supabase = createClient();
  const brand = payload.brand?.trim();
  const productName = payload.product_name?.trim();
  if (!brand || !productName) {
    return { error: 'กรุณาระบุแบรนด์และชื่อสินค้าก่อนบันทึก' };
  }

  const { data, error } = await supabase
    .from('products')
    .insert({
      brand,
      product_name: productName,
      category: payload.category || null,
      usp: payload.usp || null,
      ingredients: payload.ingredients || null,
      benefits: payload.benefits || null,
      usage: payload.usage || null,
      allowed_claims: payload.allowed_claims || null,
      banned_claims: payload.banned_claims || null,
      compliance_notes: payload.compliance_notes || null,
      selling_price: payload.selling_price ?? null,
      promotion_price: payload.promotion_price ?? null,
      status: 'active'
    })
    .select('id, product_name, brand')
    .single();

  if (error) return { error: error.message };
  revalidatePath('/products');
  revalidatePath('/creative-generator');
  return data;
}

export async function deleteProduct(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) redirect(`/products/${id}?error=` + encodeURIComponent(error.message));
  revalidatePath('/products');
  redirect('/products');
}
