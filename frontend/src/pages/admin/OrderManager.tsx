import React, { useState } from 'react';
import { Order, OrderStatus } from '../../types';
import { orderService } from '../../services/orderService'; // <--- Import Service thật
import { Card } from '../../components/Card';
import { Check, X, Loader2 } from 'lucide-react'; // Thêm icon Loader

interface OrderManagerProps {
  orders: Order[];
  onRefresh: () => void;
}

export const OrderManager: React.FC<OrderManagerProps> = ({ orders, onRefresh }) => {
  // State để theo dõi ID của đơn hàng đang được xử lý (để hiện loading trên đúng nút đó)
  const [processingId, setProcessingId] = useState<string | null>(null);

  const handleUpdateStatus = async (id: string, newStatus: OrderStatus) => {
    if (!confirm(`Are you sure you want to ${newStatus} this order?`)) return;

    setProcessingId(id); // Bắt đầu loading cho đơn này
    try {
      await orderService.updateStatus(id, newStatus);
      onRefresh(); // Load lại danh sách từ server
    } catch (error: any) {
      alert(error.response?.data?.msg || 'Failed to update order status');
    } finally {
      setProcessingId(null); // Tắt loading
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-800">Order Management</h2>
      
      {orders.length === 0 && (
        <div className="text-center py-10 bg-white rounded-xl border border-dashed border-slate-300">
          <p className="text-slate-500">No orders found in the system.</p>
        </div>
      )}

      {orders.map(order => (
        <Card key={order.id} className="flex flex-col md:flex-row justify-between md:items-center gap-4 hover:shadow-md transition duration-200">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="font-bold text-slate-800 text-lg">Order #{order.id.slice(-6).toUpperCase()}</span>
              <span className={`px-2.5 py-0.5 text-xs rounded-full font-bold uppercase tracking-wide ${
                order.status === OrderStatus.APPROVED ? 'bg-green-100 text-green-700 border border-green-200' : 
                order.status === OrderStatus.REJECTED ? 'bg-red-100 text-red-700 border border-red-200' : 
                'bg-yellow-100 text-yellow-700 border border-yellow-200'
              }`}>
                {order.status}
              </span>
            </div>
            <div className="text-sm text-slate-500 space-y-1">
              <p>From: <span className="font-medium text-slate-700">{order.distributorName}</span></p>
              <p>Date: {new Date(order.createdAt).toLocaleDateString()} {new Date(order.createdAt).toLocaleTimeString()}</p>
            </div>
            <div className="mt-3 text-base">
              <span className="font-medium text-slate-600">Total Amount:</span> 
              <span className="ml-2 font-bold text-blue-700">${order.totalAmount.toLocaleString()}</span>
            </div>
          </div>

          {/* Chỉ hiện nút bấm khi đơn hàng đang PENDING */}
          {order.status === OrderStatus.PENDING && (
            <div className="flex space-x-3 mt-4 md:mt-0">
              <button 
                onClick={() => handleUpdateStatus(order.id, OrderStatus.APPROVED)} 
                disabled={processingId !== null} // Khóa tất cả nút khi đang xử lý 1 đơn
                className="flex items-center px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processingId === order.id ? (
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <Check className="w-4 h-4 mr-1" />
                )}
                Approve
              </button>
              
              <button 
                onClick={() => handleUpdateStatus(order.id, OrderStatus.REJECTED)} 
                disabled={processingId !== null}
                className="flex items-center px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processingId === order.id ? (
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <X className="w-4 h-4 mr-1" />
                )}
                Reject
              </button>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
};