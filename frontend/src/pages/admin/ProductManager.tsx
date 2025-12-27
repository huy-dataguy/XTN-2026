import React, { useState } from 'react';
import { Product } from '../../types';
import { productService } from '../../services/productService'; // <--- Import Service thật
import { Plus, Trash2, Loader2 } from 'lucide-react'; // Thêm icon Loader

interface ProductManagerProps {
  products: Product[];
  onRefresh: () => void;
}

export const ProductManager: React.FC<ProductManagerProps> = ({ products, onRefresh }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false); // <--- State loading
  
  const [newProduct, setNewProduct] = useState<Partial<Product>>({ 
    name: '', 
    price: 0, 
    stock: 0, 
    category: '', 
    image: '' 
  });

  // --- XỬ LÝ TẠO MỚI ---
  const handleSave = async () => {
    if (!newProduct.name || !newProduct.price) {
      alert("Please fill in Name and Price");
      return;
    }

    setIsSubmitting(true); // Bắt đầu loading
    try {
      // Gọi API tạo mới
      await productService.create({
        ...newProduct,
        // Nếu không nhập ảnh thì dùng ảnh mặc định placeholder
        image: newProduct.image || 'https://placehold.co/400?text=No+Image'
      });

      // Thành công
      setIsModalOpen(false);
      setNewProduct({ name: '', price: 0, stock: 0, category: '', image: '' });
      onRefresh(); // Gọi App.tsx load lại danh sách
      alert('Product created successfully!');

    } catch (error: any) {
      alert(error.response?.data?.msg || 'Failed to create product');
    } finally {
      setIsSubmitting(false); // Tắt loading
    }
  };

  // --- XỬ LÝ XÓA ---
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;

    try {
      await productService.delete(id);
      onRefresh(); // Load lại danh sách sau khi xóa
    } catch (error: any) {
      alert(error.response?.data?.msg || 'Failed to delete product');
    }
  };

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Product Inventory</h2>
        <button 
          onClick={() => setIsModalOpen(true)} 
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition shadow-sm"
        >
          <Plus className="w-4 h-4 mr-2" /> Add Product
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map(p => (
          <div key={p.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col hover:shadow-md transition">
            <div className="h-48 bg-slate-100 relative group">
              <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
              <div className="absolute top-2 right-2 bg-white/90 backdrop-blur px-2 py-1 rounded-md text-xs font-bold shadow text-slate-700">
                Stock: {p.stock}
              </div>
            </div>
            <div className="p-4 flex-1 flex flex-col">
              <div className="flex justify-between items-start mb-2">
                <div>
                   <h3 className="font-bold text-slate-800 text-lg">{p.name}</h3>
                   <span className="inline-block bg-slate-100 text-slate-600 text-xs px-2 py-1 rounded mt-1">{p.category}</span>
                </div>
              </div>
              
              <div className="mt-auto flex justify-between items-center pt-4 border-t border-slate-100">
                <span className="text-xl font-bold text-blue-600">${p.price.toLocaleString()}</span>
                <button 
                  onClick={() => handleDelete(p.id)} 
                  className="flex items-center text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg transition text-sm font-medium"
                >
                  <Trash2 className="w-4 h-4 mr-1" /> Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-2xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200">
            <h3 className="text-xl font-bold mb-4 text-slate-800">Add New Product</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Product Name</label>
                <input type="text" className="w-full border border-slate-300 p-2.5 rounded-lg mt-1 focus:ring-2 focus:ring-blue-500 outline-none" 
                  value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Price ($)</label>
                  <input type="number" className="w-full border border-slate-300 p-2.5 rounded-lg mt-1 focus:ring-2 focus:ring-blue-500 outline-none" 
                    value={newProduct.price || ''} onChange={e => setNewProduct({...newProduct, price: Number(e.target.value)})} />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Stock Qty</label>
                  <input type="number" className="w-full border border-slate-300 p-2.5 rounded-lg mt-1 focus:ring-2 focus:ring-blue-500 outline-none" 
                    value={newProduct.stock || ''} onChange={e => setNewProduct({...newProduct, stock: Number(e.target.value)})} />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Category</label>
                <input type="text" className="w-full border border-slate-300 p-2.5 rounded-lg mt-1 focus:ring-2 focus:ring-blue-500 outline-none" 
                  value={newProduct.category} onChange={e => setNewProduct({...newProduct, category: e.target.value})} />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Image URL</label>
                <input type="text" placeholder="https://..." className="w-full border border-slate-300 p-2.5 rounded-lg mt-1 focus:ring-2 focus:ring-blue-500 outline-none" 
                  value={newProduct.image} onChange={e => setNewProduct({...newProduct, image: e.target.value})} />
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-8">
              <button 
                onClick={() => setIsModalOpen(false)} 
                disabled={isSubmitting}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
              >
                Cancel
              </button>
              <button 
                onClick={handleSave} 
                disabled={isSubmitting}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center disabled:opacity-70"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...
                  </>
                ) : 'Save Product'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};