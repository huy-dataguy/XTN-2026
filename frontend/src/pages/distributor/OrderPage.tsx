import React, { useState } from 'react';
import { Product, User } from '../../types';
import { OrderService } from '../../services/mockBackend';
import { ShoppingCart } from 'lucide-react';

interface OrderPageProps {
  user: User;
  products: Product[];
  onOrderSuccess: () => void;
}

export const OrderPage: React.FC<OrderPageProps> = ({ user, products, onOrderSuccess }) => {
  const [cart, setCart] = useState<{productId: string, quantity: number}[]>([]);

  const addToCart = (productId: string) => {
    setCart(prev => {
      const exists = prev.find(i => i.productId === productId);
      if (exists) return prev.map(i => i.productId === productId ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { productId, quantity: 1 }];
    });
  };

  const updateCartQuantity = (productId: string, newQty: number) => {
    if (newQty <= 0) {
      setCart(prev => prev.filter(i => i.productId !== productId));
    } else {
      setCart(prev => prev.map(i => i.productId === productId ? { ...i, quantity: newQty } : i));
    }
  };

  const submitOrder = () => {
    if (cart.length === 0) return;
    OrderService.create(user.id, user.name, cart);
    setCart([]);
    alert('Order placed successfully!');
    onOrderSuccess();
  };

  const cartTotal = cart.reduce((acc, item) => {
    const p = products.find(prod => prod.id === item.productId);
    return acc + (p ? p.price * item.quantity : 0);
  }, 0);

  return (
    <div className="flex flex-col md:flex-row gap-6 h-[calc(100vh-120px)]">
      <div className="flex-1 overflow-y-auto pr-2">
         <h2 className="text-2xl font-bold text-slate-800 mb-4">Product Catalog</h2>
         <div className="grid grid-cols-1 gap-4">
            {products.map(p => {
              const inCart = cart.find(c => c.productId === p.id);
              return (
                <div key={p.id} className="flex justify-between items-center p-4 bg-white border rounded-lg shadow-sm hover:shadow-md transition">
                  <div className="flex items-center gap-4">
                    <img src={p.image} alt="" className="w-16 h-16 rounded object-cover border border-slate-100" />
                    <div>
                      <p className="font-bold text-lg text-slate-800">{p.name}</p>
                      <p className="text-sm text-slate-500">{p.category} • Stock: {p.stock}</p>
                      <p className="text-blue-600 font-semibold mt-1">${p.price.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                     {inCart ? (
                       <div className="flex items-center border rounded-lg overflow-hidden">
                         <button onClick={() => updateCartQuantity(p.id, inCart.quantity - 1)} className="px-3 py-1 bg-slate-100 hover:bg-slate-200">-</button>
                         <span className="px-3 py-1 font-bold min-w-[40px] text-center">{inCart.quantity}</span>
                         <button onClick={() => updateCartQuantity(p.id, inCart.quantity + 1)} className="px-3 py-1 bg-slate-100 hover:bg-slate-200">+</button>
                       </div>
                     ) : (
                       <button 
                         onClick={() => addToCart(p.id)}
                         disabled={p.stock === 0}
                         className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
                       >
                         Add to Cart
                       </button>
                     )}
                     {inCart && (
                       <p className="text-xs text-slate-500 font-medium">Total: ${(inCart.quantity * p.price).toLocaleString()}</p>
                     )}
                  </div>
                </div>
              );
            })}
         </div>
      </div>

      <div className="md:w-96 bg-white rounded-xl shadow-lg border border-slate-200 flex flex-col h-fit">
         <div className="p-4 border-b border-slate-100 bg-slate-50 rounded-t-xl">
           <h3 className="font-bold text-lg flex items-center"><ShoppingCart className="w-5 h-5 mr-2"/> Current Order</h3>
         </div>
         <div className="p-4 flex-1 overflow-y-auto max-h-[300px]">
           {cart.length === 0 ? (
             <p className="text-center text-slate-400 py-8">Your cart is empty.</p>
           ) : (
             <ul className="space-y-3">
               {cart.map(item => {
                 const p = products.find(prod => prod.id === item.productId);
                 if(!p) return null;
                 return (
                   <li key={item.productId} className="flex justify-between text-sm">
                     <span className="text-slate-700 flex-1 truncate mr-2">{p.name} <span className="text-slate-400">x{item.quantity}</span></span>
                     <span className="font-medium">${(p.price * item.quantity).toLocaleString()}</span>
                   </li>
                 )
               })}
             </ul>
           )}
         </div>
         <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-xl">
           <div className="flex justify-between items-center mb-4">
             <span className="text-slate-600">Total Amount</span>
             <span className="text-2xl font-bold text-blue-700">${cartTotal.toLocaleString()}</span>
           </div>
           <button 
             onClick={submitOrder} 
             disabled={cart.length === 0}
             className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
           >
             Confirm Order
           </button>
         </div>
      </div>
    </div>
  );
};