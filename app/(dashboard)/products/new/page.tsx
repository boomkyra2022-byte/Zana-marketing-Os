import { ProductImageImport } from '@/components/product-image-import';
import { createProduct } from '../actions';

export default function NewProductPage({ searchParams }: { searchParams: { error?: string } }) {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">เพิ่มสินค้าใหม่</h1>
      <ProductImageImport action={createProduct} error={searchParams.error} submitLabel="บันทึกสินค้า" />
    </div>
  );
}
