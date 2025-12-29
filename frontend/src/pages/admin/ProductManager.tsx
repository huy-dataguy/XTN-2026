import React, { useState } from 'react';
import { Product } from '../../types';
import { productService } from '../../services/productService'; 
import { Plus, Trash2, Loader2, Image as ImageIcon, Pencil } from 'lucide-react'; // Thêm icon Pencil

interface ProductManagerProps {
  products: Product[];
  onRefresh: () => void;
}

export const ProductManager: React.FC<ProductManagerProps> = ({ products, onRefresh }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // State mới: Lưu ID của sản phẩm đang sửa (nếu null nghĩa là đang tạo mới)
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState<Partial<Product>>({ 
    name: '', 
    price: 0, 
    stock: 0, 
    category: '', 
    image: '' 
  });

  // --- ACTIONS ---

  // 1. Mở modal để TẠO MỚI
  const openCreateModal = () => {
    setEditingId(null); // Reset ID
    setFormData({ name: '', price: 0, stock: 0, category: '', image: '' }); // Reset Form
    setIsModalOpen(true);
  };

  // 2. Mở modal để SỬA
  const openEditModal = (product: Product) => {
    setEditingId(product.id); // Lưu ID đang sửa
    setFormData({ ...product }); // Đổ dữ liệu cũ vào form
    setIsModalOpen(true);
  };

  // 3. Xử lý LƯU (Create hoặc Update)
  const handleSave = async () => {
    if (!formData.name || !formData.price) {
      alert("Please fill in Name and Price");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        ...formData,
        image: formData.image || 'https://placehold.co/400?text=No+Image'
      };

      if (editingId) {
        // --- CASE UPDATE ---
        // Giả định service có hàm update(id, data)
        await productService.update(editingId, payload);
        alert('Product updated successfully!');
      } else {
        // --- CASE CREATE ---
        await productService.create(payload);
        alert('Product created successfully!');
      }

      setIsModalOpen(false);
      onRefresh(); // Refresh list
    } catch (error: any) {
      alert(error.response?.data?.msg || 'Failed to save product');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 4. Xử lý XÓA
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
          onClick={openCreateModal} // Đổi thành hàm openCreateModal
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
              
              <div className="mt-auto flex justify-between items-center pt-4 border-t border-slate-100 gap-2">
                <span className="text-xl font-bold text-blue-600 mr-auto">${p.price.toLocaleString()}</span>
                
                {/* BUTTON EDIT */}
                <button 
                  onClick={() => openEditModal(p)} 
                  className="flex items-center text-slate-500 hover:text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition text-sm font-medium"
                >
                  <Pencil className="w-4 h-4 mr-1" /> Edit
                </button>

                {/* BUTTON DELETE */}
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
            <h3 className="text-xl font-bold mb-4 text-slate-800">
              {editingId ? 'Edit Product' : 'Add New Product'}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Product Name</label>
                <input type="text" className="w-full border border-slate-300 p-2.5 rounded-lg mt-1 focus:ring-2 focus:ring-blue-500 outline-none" 
                  value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Price ($)</label>
                  <input type="number" className="w-full border border-slate-300 p-2.5 rounded-lg mt-1 focus:ring-2 focus:ring-blue-500 outline-none" 
                    value={formData.price || ''} onChange={e => setFormData({...formData, price: Number(e.target.value)})} />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Stock Qty</label>
                  <input type="number" className="w-full border border-slate-300 p-2.5 rounded-lg mt-1 focus:ring-2 focus:ring-blue-500 outline-none" 
                    value={formData.stock || ''} onChange={e => setFormData({...formData, stock: Number(e.target.value)})} />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Category</label>
                <input type="text" className="w-full border border-slate-300 p-2.5 rounded-lg mt-1 focus:ring-2 focus:ring-blue-500 outline-none" 
                  value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Image URL</label>
                <div className="relative">
                    <ImageIcon className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                    <input type="text" placeholder="https://..." className="w-full border border-slate-300 p-2.5 pl-9 rounded-lg mt-1 focus:ring-2 focus:ring-blue-500 outline-none" 
                    value={formData.image} onChange={e => setFormData({...formData, image: e.target.value})} />
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
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> {editingId ? 'Updating...' : 'Saving...'}
                  </>
                ) : (
                  editingId ? 'Update Product' : 'Save Product'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// src/components/admin/ProductManager.tsx

// import React, { useState, useMemo } from 'react';
// import { Product, Order, OrderStatus } from '../../types'; // Import từ types.ts của bạn
// import { productService } from '../../services/productService'; 
// import { Plus, Trash2, Loader2, Image as ImageIcon, Pencil, Package, TrendingUp } from 'lucide-react';

// interface ProductManagerProps {
//   products: Product[];
//   orders: Order[]; // Sử dụng Interface Order chuẩn
//   onRefresh: () => void;
// }

// export const ProductManager: React.FC<ProductManagerProps> = ({ products, orders, onRefresh }) => {
//   const [isModalOpen, setIsModalOpen] = useState(false);
//   const [isSubmitting, setIsSubmitting] = useState(false);
  
//   // Lưu ID sản phẩm đang sửa
//   const [editingId, setEditingId] = useState<string | null>(null);

//   // Form state
//   const [formData, setFormData] = useState<Partial<Product>>({ 
//     name: '', 
//     price: 0, 
//     stock: 0, 
//     category: '', 
//     image: '' 
//   });

//   // --- LOGIC TÍNH TOÁN SỐ LƯỢNG ĐÃ BÁN (SOLD) ---
//   const stockInfo = useMemo(() => {
//     const soldMap: Record<string, number> = {};

//     if (!orders) return soldMap;

//     orders.forEach(order => {
//       // Dùng Enum OrderStatus để kiểm tra trạng thái
//       if (order.status === OrderStatus.APPROVED) {
//         order.items.forEach(item => {
//           // item.productId khớp với Product.id
//           if (!soldMap[item.productId]) {
//             soldMap[item.productId] = 0;
//           }
//           soldMap[item.productId] += item.quantity;
//         });
//       }
//     });

//     return soldMap;
//   }, [orders]);

//   // --- ACTIONS ---

//   const openCreateModal = () => {
//     setEditingId(null);
//     setFormData({ name: '', price: 0, stock: 0, category: '', image: '' });
//     setIsModalOpen(true);
//   };

//   const openEditModal = (product: Product) => {
//     setEditingId(product.id);
//     setFormData({ ...product });
//     setIsModalOpen(true);
//   };

//   const handleSave = async () => {
//     if (!formData.name || !formData.price) {
//       alert("Please fill in Name and Price");
//       return;
//     }

//     setIsSubmitting(true);
//     try {
//       const payload = {
//         ...formData,
//         image: formData.image || 'https://placehold.co/400?text=No+Image'
//       };

//       if (editingId) {
//         await productService.update(editingId, payload);
//         alert('Product updated successfully!');
//       } else {
//         await productService.create(payload);
//         alert('Product created successfully!');
//       }

//       setIsModalOpen(false);
//       onRefresh();
//     } catch (error: any) {
//       alert(error.response?.data?.msg || 'Failed to save product');
//     } finally {
//       setIsSubmitting(false);
//     }
//   };

//   const handleDelete = async (id: string) => {
//     if (!confirm('Are you sure you want to delete this product?')) return;

//     try {
//       await productService.delete(id);
//       onRefresh();
//     } catch (error: any) {
//       alert(error.response?.data?.msg || 'Failed to delete product');
//     }
//   };

//   return (
//     <>
//       <div className="flex justify-between items-center mb-6">
//         <h2 className="text-2xl font-bold text-slate-800">Inventory Management</h2>
//         <button 
//           onClick={openCreateModal}
//           className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition shadow-sm"
//         >
//           <Plus className="w-4 h-4 mr-2" /> Add Product
//         </button>
//       </div>

//       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
//         {products.map(p => {
//           // Tính toán
//           const totalSold = stockInfo[p.id] || 0;
//           const remainingStock = p.stock - totalSold;

//           return (
//             <div key={p.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col hover:shadow-md transition">
//               <div className="h-48 bg-slate-100 relative group">
//                 <img 
//                   src={p.image} 
//                   alt={p.name} 
//                   className="w-full h-full object-cover" 
//                   onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/400?text=Error'; }}
//                 />
                
//                 {/* Badge trạng thái kho */}
//                 <div className={`absolute top-2 right-2 px-2 py-1 rounded-md text-xs font-bold shadow backdrop-blur-md border 
//                   ${remainingStock <= 0 ? 'bg-red-100 text-red-700 border-red-200' : 'bg-white/90 text-slate-700 border-slate-200'}`}>
//                   {remainingStock <= 0 ? 'Out of Stock' : `In Stock: ${remainingStock}`}
//                 </div>
//               </div>

//               <div className="p-4 flex-1 flex flex-col">
//                 <div className="mb-2">
//                    <h3 className="font-bold text-slate-800 text-lg">{p.name}</h3>
//                    <span className="inline-block bg-slate-100 text-slate-600 text-xs px-2 py-1 rounded mt-1 font-medium">{p.category}</span>
//                 </div>
                
//                 {/* Thống kê chi tiết Import vs Sold */}
//                 <div className="grid grid-cols-2 gap-2 my-3 text-xs text-slate-500 bg-slate-50 p-2 rounded-lg">
//                     <div className="flex items-center" title="Total Imported Quantity">
//                         <Package className="w-3 h-3 mr-1" /> Import: <span className="font-semibold ml-1 text-slate-700">{p.stock}</span>
//                     </div>
//                     <div className="flex items-center" title="Total Approved Orders">
//                         <TrendingUp className="w-3 h-3 mr-1" /> Sold: <span className="font-semibold ml-1 text-blue-600">{totalSold}</span>
//                     </div>
//                 </div>

//                 <div className="mt-auto flex justify-between items-center pt-4 border-t border-slate-100 gap-2">
//                   <span className="text-xl font-bold text-blue-600 mr-auto">${p.price.toLocaleString()}</span>
                  
//                   <button 
//                     onClick={() => openEditModal(p)} 
//                     className="flex items-center text-slate-500 hover:text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition text-sm font-medium"
//                   >
//                     <Pencil className="w-4 h-4 mr-1" /> Edit
//                   </button>

//                   <button 
//                     onClick={() => handleDelete(p.id)} 
//                     className="flex items-center text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg transition text-sm font-medium"
//                   >
//                     <Trash2 className="w-4 h-4 mr-1" /> Delete
//                   </button>
//                 </div>
//               </div>
//             </div>
//           );
//         })}
//       </div>

//       {/* Modal Form */}
//       {isModalOpen && (
//         <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
//           <div className="bg-white p-6 rounded-2xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200">
//             <h3 className="text-xl font-bold mb-4 text-slate-800">
//               {editingId ? 'Edit Product' : 'Add New Product'}
//             </h3>
            
//             <div className="space-y-4">
//               <div>
//                 <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Product Name</label>
//                 <input type="text" className="w-full border border-slate-300 p-2.5 rounded-lg mt-1 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" 
//                   value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
//               </div>
              
//               <div className="grid grid-cols-2 gap-4">
//                 <div>
//                   <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Price (VND)</label>
//                   <input type="number" className="w-full border border-slate-300 p-2.5 rounded-lg mt-1 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" 
//                     value={formData.price || ''} onChange={e => setFormData({...formData, price: Number(e.target.value)})} />
//                 </div>
//                 <div>
//                   <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Import Stock</label>
//                   <input type="number" className="w-full border border-slate-300 p-2.5 rounded-lg mt-1 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" 
//                     value={formData.stock || ''} onChange={e => setFormData({...formData, stock: Number(e.target.value)})} />
//                 </div>
//               </div>

//               <div>
//                 <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Category</label>
//                 <input type="text" className="w-full border border-slate-300 p-2.5 rounded-lg mt-1 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" 
//                   value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} />
//               </div>

//               <div>
//                 <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Image URL</label>
//                 <div className="relative">
//                     <ImageIcon className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
//                     <input type="text" placeholder="https://..." className="w-full border border-slate-300 p-2.5 pl-9 rounded-lg mt-1 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" 
//                     value={formData.image} onChange={e => setFormData({...formData, image: e.target.value})} />
//                 </div>
//               </div>
//             </div>

//             <div className="flex justify-end space-x-3 mt-8">
//               <button 
//                 onClick={() => setIsModalOpen(false)} 
//                 disabled={isSubmitting}
//                 className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition"
//               >
//                 Cancel
//               </button>
//               <button 
//                 onClick={handleSave} 
//                 disabled={isSubmitting}
//                 className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center disabled:opacity-70 transition shadow-lg shadow-blue-200"
//               >
//                 {isSubmitting ? (
//                   <>
//                     <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...
//                   </>
//                 ) : (
//                   editingId ? 'Update Product' : 'Save Product'
//                 )}
//               </button>
//             </div>
//           </div>
//         </div>
//       )}
//     </>
//   );
// };