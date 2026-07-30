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
    commission_rate: num(formData, 'commission_rate'),
    shipping_subsidy: num(formData, 'shipping_subsidy'),
    usp: str(formData, 'usp'),
    ingredients: str(formData, 'ingredients'),
    benefits: str(formData, 'benefits'),
    usage: str(formData, 'usage'),
    customer_objections: str(formData, 'customer_objections'),
    allowed_claims: str(formData, 'allowed_claims'),
    banned_claims: str(formData, 'banned_claims'),
    compliance_notes: str(formData, 'compliance_notes'),
    stock: num(formData, 'stock'),
    is_hero: formData.get('is_hero') === 'on'
  };
}

export async function createProduct(formData: FormData) {
  const supabase = createClient();
  const payload = productPayload(formData);

  if (!payload.brand || !payload.product_name) {
    redirect('/products/new?error=' + encodeURIComponent('Brand and Product Name are required'));
  }

  const { error } = await supabase.from('products').insert(payload);

  if (error) {
    redirect('/products/new?error=' + encodeURIComponent(error.message));
  }

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

  if (error) {
    redirect(`/products/${id}?error=` + encodeURIComponent(error.message));
  }

  revalidatePath('/products');
  redirect('/products');
}

export async function deleteProduct(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) {
    redirect(`/products/${id}?error=` + encodeURIComponent(error.message));
  }
  revalidatePath('/products');
  redirect('/products');
}
