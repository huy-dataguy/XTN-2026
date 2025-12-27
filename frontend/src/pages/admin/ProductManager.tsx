import React, { useState } from 'react';
import { Product } from '../../types';
import { productService } from '../../services/productService'; // Service thật
import { Plus, Trash2, Loader2, Image as ImageIcon } from 'lucide-react'; 

interface ProductManagerProps {
  products: Product[];
  onRefresh: () => void;
}

export const ProductManager: React.FC<ProductManagerProps> = ({ products, onRefresh }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [newProduct, setNewProduct] = useState<Partial<Product>>({ 
    name: '', 
    price: 0, 
    stock: 0, 
    category: '', 
    image: '' 
  });

  // --- CREATE ---
  const handleSave = async () => {
    if (!newProduct.name || !newProduct.price) {
      alert("Please fill in Name and Price");
      return;
    }

    setIsSubmitting(true);
    try {
      await productService.create({
        ...newProduct,
        // Placeholder nếu không có ảnh
        image: newProduct.image || 'https://placehold.co/400?text=No+Image'
      });

      setIsModalOpen(false);
      setNewProduct({ name: '', price: 0, stock: 0, category: '', image: '' });
      onRefresh(); // Refresh list
      alert('Product created successfully!');
    } catch (error: any) {
      alert(error.response?.data?.msg || 'Failed to create product');
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- DELETE ---
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;

    try {
      await productService.delete(id);
      onRefresh();
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
              <img 
                src={p.image} 
                alt={p.name} 
                className="w-full h-full object-cover" 
                onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/400?text=Error'; }}
              />
              <div className="absolute top-2 right-2 bg-white/90 backdrop-blur px-2 py-1 rounded-md text-xs font-bold shadow text-slate-700">
                Stock: {p.stock}
              </div>
            </div>
            <div className="p-4 flex-1 flex flex-col">
              <div className="mb-2">
                 <h3 className="font-bold text-slate-800 text-lg">{p.name}</h3>
                 <span className="inline-block bg-slate-100 text-slate-600 text-xs px-2 py-1 rounded mt-1 font-medium">{p.category}</span>
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
                <div className="relative">
                    <ImageIcon className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                    <input type="text" placeholder="https://..." className="w-full border border-slate-300 p-2.5 pl-9 rounded-lg mt-1 focus:ring-2 focus:ring-blue-500 outline-none" 
                    value={newProduct.image} onChange={e => setNewProduct({...newProduct, image: e.target.value})} />
                </div>
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