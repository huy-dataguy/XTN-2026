import React, { useState } from 'react';
import { WeeklyReport, Order, ReportStatus, OrderStatus } from '../../types';
import { Eye, Edit, X, Package } from 'lucide-react';

interface HistoryPageProps {
  myReports: WeeklyReport[];
  myOrders: Order[];
  onEditReport: (report: WeeklyReport) => void;
}

export const HistoryPage: React.FC<HistoryPageProps> = ({ myReports, myOrders, onEditReport }) => {
  // State để xem chi tiết Report
  const [viewReport, setViewReport] = useState<WeeklyReport | null>(null);
  // 👇 State MỚI: Để xem chi tiết Order
  const [viewOrder, setViewOrder] = useState<Order | null>(null);

  // Helper function để format ngày
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6 pb-10">
      <h2 className="text-2xl font-bold text-slate-800">History Log</h2>

      {/* --- PHẦN 1: REPORTS HISTORY (Giữ nguyên) --- */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
         <div className="bg-slate-50 p-4 border-b flex justify-between items-center">
            <h3 className="font-bold text-slate-700">Submitted Reports</h3>
         </div>
         {myReports.length === 0 ? <div className="p-8 text-center text-slate-400">No reports found.</div> : (
           <table className="w-full text-sm text-left">
             <thead className="bg-slate-50 text-slate-500">
                <tr>
                   <th className="px-4 py-3">Week Of</th>
                   <th className="px-4 py-3">Status</th>
                   <th className="px-4 py-3 text-right">Revenue</th>
                   <th className="px-4 py-3 text-right">Sold</th>
                   <th className="px-4 py-3 text-right">Actions</th>
                </tr>
             </thead>
             <tbody className="divide-y divide-slate-100">
                {myReports.map(r => (
                   <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium">{new Date(r.weekStartDate).toLocaleDateString('en-GB')}</td>
                      <td className="px-4 py-3">
                         <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                            r.status === ReportStatus.APPROVED ? 'bg-green-100 text-green-700' : 
                            r.status === ReportStatus.REJECTED ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                          }`}>{r.status}</span>
                      </td>
                      <td className="px-4 py-3 text-right text-emerald-600 font-medium">${r.totalRevenue.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right">{r.totalSold}</td>
                      <td className="px-4 py-3 text-right">
                         <div className="flex justify-end gap-2">
                           <button onClick={() => setViewReport(r)} className="p-1.5 text-slate-500 hover:bg-slate-200 rounded-full" title="View Details">
                             <Eye className="w-4 h-4" />
                           </button>
                           {r.status === ReportStatus.PENDING && (
                             <button onClick={() => onEditReport(r)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-full" title="Edit">
                                <Edit className="w-4 h-4" />
                             </button>
                           )}
                         </div>
                      </td>
                   </tr>
                ))}
             </tbody>
           </table>
         )}
      </div>

      {/* --- PHẦN 2: ORDERS HISTORY (Đã Cập nhật nút xem chi tiết) --- */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
         <div className="bg-slate-50 p-4 border-b">
            <h3 className="font-bold text-slate-700">Order History</h3>
         </div>
         {myOrders.length === 0 ? <div className="p-8 text-center text-slate-400">No orders found.</div> : (
            <div className="divide-y divide-slate-100">
              {myOrders.map(o => (
                <div key={o.id} className="p-4 flex justify-between items-center hover:bg-slate-50 transition">
                   <div className="flex gap-4 items-center">
                      {/* Icon trang trí */}
                      <div className={`p-3 rounded-full ${o.status === OrderStatus.APPROVED ? 'bg-green-100 text-green-600' : 'bg-blue-50 text-blue-500'}`}>
                          <Package className="w-5 h-5" />
                      </div>
                      
                      <div>
                          <div className="flex items-center gap-2">
                             <span className="font-bold text-slate-700">Order #{o.id.slice(-6).toUpperCase()}</span>
                             <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                                o.status === OrderStatus.APPROVED ? 'bg-green-100 text-green-700' : 
                                o.status === OrderStatus.REJECTED ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                              }`}>{o.status}</span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">{formatDate(o.createdAt)}</p>
                       </div>
                   </div>

                   <div className="flex items-center gap-6">
                      <div className="text-right hidden sm:block">
                          <p className="font-bold text-blue-700">${o.totalAmount.toLocaleString()}</p>
                          <p className="text-xs text-slate-400">{o.items.reduce((acc, i) => acc + i.quantity, 0)} items</p>
                      </div>
                      
                      {/* 👇 Nút Xem Chi Tiết Đơn Hàng */}
                      <button 
                        onClick={() => setViewOrder(o)}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition"
                        title="View Order Details"
                      >
                          <Eye className="w-5 h-5" />
                      </button>
                   </div>
                </div>
              ))}
            </div>
         )}
      </div>

      {/* --- MODAL 1: VIEW REPORT DETAILS (Giữ nguyên) --- */}
      {viewReport && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
           <div className="bg-white rounded-xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in duration-200">
              <div className="p-6 border-b flex justify-between items-center bg-slate-50 rounded-t-xl">
                 <div>
                    <h3 className="text-xl font-bold text-slate-800">Report Details</h3>
                    <p className="text-slate-500 text-sm">Week of {new Date(viewReport.weekStartDate).toLocaleDateString('en-GB')}</p>
                 </div>
                 <button onClick={() => setViewReport(null)} className="text-slate-400 hover:text-red-500 transition">
                    <X className="w-6 h-6" />
                 </button>
              </div>
              <div className="p-6 overflow-y-auto flex-1">
                 {/* ... (Nội dung modal report giữ nguyên) ... */}
                 <div className="flex gap-4 mb-6">
                    <div className="flex-1 bg-emerald-50 p-3 rounded-lg border border-emerald-100">
                       <p className="text-xs text-emerald-600 uppercase font-bold">Revenue</p>
                       <p className="text-xl font-bold text-emerald-700">${viewReport.totalRevenue.toLocaleString()}</p>
                    </div>
                    <div className="flex-1 bg-blue-50 p-3 rounded-lg border border-blue-100">
                       <p className="text-xs text-blue-600 uppercase font-bold">Sold</p>
                       <p className="text-xl font-bold text-blue-700">{viewReport.totalSold}</p>
                    </div>
                    <div className="flex-1 bg-red-50 p-3 rounded-lg border border-red-100">
                       <p className="text-xs text-red-600 uppercase font-bold">Damaged</p>
                       <p className="text-xl font-bold text-red-700">{viewReport.totalDamaged}</p>
                    </div>
                 </div>
                 
                 <table className="w-full text-sm">
                    <thead className="text-slate-500 border-b bg-slate-50">
                       <tr>
                          <th className="text-left py-2 px-2">Product</th>
                          <th className="text-right py-2 px-2">Recv</th>
                          <th className="text-right py-2 px-2">Sold</th>
                          <th className="text-right py-2 px-2">Rem</th>
                          <th className="text-right py-2 px-2">Rev</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y">
                       {viewReport.details.map((d, i) => (
                          <tr key={i}>
                             <td className="py-2 px-2 font-medium">{d.productName}</td>
                             <td className="py-2 px-2 text-right text-slate-500">{d.quantityReceived}</td>
                             <td className="py-2 px-2 text-right">{d.quantitySold}</td>
                             <td className="py-2 px-2 text-right text-blue-500">{d.remainingStock}</td>
                             <td className="py-2 px-2 text-right font-medium text-emerald-600">${d.revenue.toLocaleString()}</td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
                 {viewReport.notes && (
                    <div className="mt-6 bg-slate-50 p-3 rounded text-sm italic text-slate-600 border border-slate-200">
                       Notes: " {viewReport.notes} "
                    </div>
                 )}
              </div>
           </div>
        </div>
      )}

      {/* --- MODAL 2: VIEW ORDER DETAILS (MỚI) --- */}
      {viewOrder && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
           <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
              
              {/* Header Modal */}
              <div className="p-5 border-b flex justify-between items-center bg-slate-50">
                 <div>
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <Package className="w-5 h-5 text-blue-600" />
                        Order Details
                    </h3>
                    <p className="text-slate-500 text-xs mt-1">
                        ID: #{viewOrder.id.slice(-6).toUpperCase()} • {formatDate(viewOrder.createdAt)}
                    </p>
                 </div>
                 <button onClick={() => setViewOrder(null)} className="text-slate-400 hover:text-slate-600 bg-white p-1 rounded-full border border-slate-200 hover:border-slate-300">
                    <X className="w-5 h-5" />
                 </button>
              </div>

              {/* Body Modal: Danh sách sản phẩm */}
              <div className="p-0 overflow-y-auto flex-1">
                  <table className="w-full text-sm text-left">
                      <thead className="bg-slate-100 text-slate-500 font-semibold uppercase text-xs">
                          <tr>
                              <th className="px-5 py-3">Product Name</th>
                              <th className="px-5 py-3 text-right">Price</th>
                              <th className="px-5 py-3 text-center">Qty</th>
                              <th className="px-5 py-3 text-right">Total</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                          {viewOrder.items.map((item, index) => (
                              <tr key={index} className="hover:bg-slate-50">
                                  <td className="px-5 py-3 font-medium text-slate-700">
                                      {item.productName}
                                  </td>
                                  <td className="px-5 py-3 text-right text-slate-500">
                                      ${item.price.toLocaleString()}
                                  </td>
                                  <td className="px-5 py-3 text-center font-bold text-slate-800 bg-slate-50">
                                      x{item.quantity}
                                  </td>
                                  <td className="px-5 py-3 text-right font-bold text-blue-600">
                                      ${(item.price * item.quantity).toLocaleString()}
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>

              {/* Footer Modal: Tổng tiền */}
              <div className="p-5 border-t bg-slate-50 flex justify-between items-center">
                  <span className="text-sm font-bold text-slate-500">Grand Total</span>
                  <span className="text-2xl font-black text-blue-700">
                      ${viewOrder.totalAmount.toLocaleString()}
                  </span>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};