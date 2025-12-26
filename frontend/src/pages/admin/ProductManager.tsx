import React, { useState } from 'react';
import { Product } from '../../types';
import { ProductService } from '../../services/mockBackend';
import { Plus } from 'lucide-react';

interface ProductManagerProps {
  products: Product[];
  onRefresh: () => void;
}

export const ProductManager: React.FC<ProductManagerProps> = ({ products, onRefresh }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newProduct, setNewProduct] = useState<Partial<Product>>({ name: '', price: 0, stock: 0, category: '', image: '' });

  const handleSave = () => {
    if (!newProduct.name || !newProduct.price) return;
    ProductService.create(newProduct as any);
    setIsModalOpen(false);
    setNewProduct({ name: '', price: 0, stock: 0, category: '', image: '' });
    onRefresh();
  };

  const handleDelete = (id: string) => {
    if(confirm('Are you sure?')) {
      ProductService.delete(id);
      onRefresh();
    }
  };

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Product Inventory</h2>
        <button onClick={() => setIsModalOpen(true)} className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" /> Add Product
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map(p => (
          <div key={p.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
            <div className="h-40 bg-slate-100 relative">
              <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
              <div className="absolute top-2 right-2 bg-white px-2 py-1 rounded-md text-xs font-bold shadow">Stock: {p.stock}</div>
            </div>
            <div className="p-4 flex-1 flex flex-col">
              <h3 className="font-bold text-slate-800">{p.name}</h3>
              <p className="text-slate-500 text-sm mb-4">{p.category}</p>
              <div className="mt-auto flex justify-between items-center">
                <span className="text-lg font-bold text-blue-600">${p.price.toLocaleString()}</span>
                <button onClick={() => handleDelete(p.id)} className="text-red-500 hover:text-red-700 text-sm">Delete</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl w-full max-w-md shadow-xl">
            <h3 className="text-xl font-bold mb-4">Add New Product</h3>
            <div className="space-y-3">
              <input type="text" placeholder="Name" className="w-full border p-2 rounded" value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} />
              <input type="number" placeholder="Price" className="w-full border p-2 rounded" value={newProduct.price || ''} onChange={e => setNewProduct({...newProduct, price: Number(e.target.value)})} />
              <input type="number" placeholder="Stock" className="w-full border p-2 rounded" value={newProduct.stock || ''} onChange={e => setNewProduct({...newProduct, stock: Number(e.target.value)})} />
              <input type="text" placeholder="Category" className="w-full border p-2 rounded" value={newProduct.category} onChange={e => setNewProduct({...newProduct, category: e.target.value})} />
              <input type="text" placeholder="Image URL" className="w-full border p-2 rounded" value={newProduct.image} onChange={e => setNewProduct({...newProduct, image: e.target.value})} />
            </div>
            <div className="flex justify-end space-x-2 mt-6">
              <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded">Cancel</button>
              <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Save</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};