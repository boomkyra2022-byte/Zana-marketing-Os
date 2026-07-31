import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ProductForm } from '@/components/product-form';
import { updateProduct, deleteProduct } from '../actions';

export default async function EditProductPage({
  params,
  searchParams
}: {
  params: { id: string };
  searchParams: { error?: string };
}) {
  const supabase = createClient();
  const { data: product } = await supabase.from('products').select('*').eq('id', params.id).single();
  if (!product) notFound();

  const boundUpdate = updateProduct.bind(null, params.id);
  const boundDelete = deleteProduct.bind(null, params.id);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">แก้ไขสินค้า: {product.product_name}</h1>
        <form action={boundDelete}>
          <button type="submit" className="btn-secondary text-red-600 border-red-300">ลบสินค้า</button>
        </form>
      </div>
      <ProductForm product={product} action={boundUpdate} error={searchParams.error} submitLabel="บันทึกการแก้ไข" />
    </div>
  );
}
