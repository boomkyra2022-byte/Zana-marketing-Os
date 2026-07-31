import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import type { Product } from '@/types/database';

export default async function ProductsPage() {
  const supabase = createClient();
  const { data: products, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Products</h1>
          <p className="text-gray-500">ฐานข้อมูลสินค้าจริงจาก Supabase</p>
        </div>
        <Link href="/products/new" className="btn-primary">+ เพิ่มสินค้า</Link>
      </div>

      {error && <div className="card p-4 mb-4 border-red-300 text-red-700 text-sm">โหลดข้อมูลไม่สำเร็จ: {error.message}</div>}

      {!error && (products?.length ?? 0) === 0 && (
        <div className="card p-8 text-center text-gray-500">ยังไม่มีสินค้าในระบบ — กด &quot;+ เพิ่มสินค้า&quot; เพื่อเริ่มต้น</div>
      )}

      {(products?.length ?? 0) > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface text-left text-gray-500">
              <tr>
                <th className="px-4 py-3">Brand</th>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Selling Price</th>
                <th className="px-4 py-3">Hero</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {(products as Product[]).map((p) => (
                <tr key={p.id} className="border-t border-border">
                  <td className="px-4 py-3">{p.brand}</td>
                  <td className="px-4 py-3">{p.product_name}</td>
                  <td className="px-4 py-3 text-gray-500">{p.sku || '—'}</td>
                  <td className="px-4 py-3">{p.status}</td>
                  <td className="px-4 py-3">{p.selling_price ? `฿${p.selling_price}` : '—'}</td>
                  <td className="px-4 py-3">{p.is_hero ? '⭐' : ''}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/products/${p.id}`} className="text-accentBlue">แก้ไข</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
