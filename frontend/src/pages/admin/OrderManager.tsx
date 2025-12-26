import React from 'react';
import { Order, OrderStatus } from '../../types';
import { OrderService } from '../../services/mockBackend';
import { Card } from '../../components/Card';
import { Check, X } from 'lucide-react';

interface OrderManagerProps {
  orders: Order[];
  onRefresh: () => void;
}

export const OrderManager: React.FC<OrderManagerProps> = ({ orders, onRefresh }) => {
  const handleApprove = (id: string) => {
    OrderService.approve(id);
    onRefresh();
  };

  const handleReject = (id: string) => {
    OrderService.reject(id);
    onRefresh();
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-800">Order Management</h2>
      {orders.length === 0 && <p className="text-slate-500">No orders to display.</p>}
      {orders.map(order => (
        <Card key={order.id} className="flex flex-col md:flex-row justify-between md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-800">Order #{order.id}</span>
              <span className={`px-2 py-0.5 text-xs rounded-full font-bold uppercase ${
                order.status === OrderStatus.APPROVED ? 'bg-green-100 text-green-700' : 
                order.status === OrderStatus.REJECTED ? 'bg-red-100 text-red-700' : 
                'bg-yellow-100 text-yellow-700'
              }`}>{order.status}</span>
            </div>
            <p className="text-sm text-slate-500">From: {order.distributorName} • {new Date(order.createdAt).toLocaleDateString()}</p>
            <div className="mt-2 text-sm"><span className="font-medium">Total:</span> ${order.totalAmount.toLocaleString()}</div>
          </div>
          {order.status === OrderStatus.PENDING && (
            <div className="flex space-x-2">
              <button onClick={() => handleApprove(order.id)} className="flex items-center px-3 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition shadow-sm"><Check className="w-4 h-4 mr-1" /> Approve</button>
              <button onClick={() => handleReject(order.id)} className="flex items-center px-3 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition shadow-sm"><X className="w-4 h-4 mr-1" /> Reject</button>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
};