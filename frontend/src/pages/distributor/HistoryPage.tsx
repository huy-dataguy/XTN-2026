import React, { useState } from 'react';
import { WeeklyReport, Order, ReportStatus, OrderStatus } from '../../types';
import { Eye, Edit, X } from 'lucide-react';

interface HistoryPageProps {
  myReports: WeeklyReport[];
  myOrders: Order[];
  onEditReport: (report: WeeklyReport) => void;
}

export const HistoryPage: React.FC<HistoryPageProps> = ({ myReports, myOrders, onEditReport }) => {
  const [viewReport, setViewReport] = useState<WeeklyReport | null>(null);

  // Helper function để format ngày
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB');
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-800">History Log</h2>

      {/* Reports History */}
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
                      <td className="px-4 py-3 font-medium">{formatDate(r.weekStartDate)}</td>
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
                           {/* Chỉ cho phép sửa khi trạng thái là PENDING */}
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

      {/* Orders History */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
         <div className="bg-slate-50 p-4 border-b">
            <h3 className="font-bold text-slate-700">Order History</h3>
         </div>
         {myOrders.length === 0 ? <div className="p-8 text-center text-slate-400">No orders found.</div> : (
            <div className="divide-y divide-slate-100">
              {myOrders.map(o => (
                <div key={o.id} className="p-4 flex justify-between items-center hover:bg-slate-50">
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
                   <div className="text-right">
                      <p className="font-bold text-blue-700">${o.totalAmount.toLocaleString()}</p>
                      <p className="text-xs text-slate-400">{o.items.reduce((acc, i) => acc + i.quantity, 0)} items</p>
                   </div>
                </div>
              ))}
            </div>
         )}
      </div>

      {/* VIEW REPORT MODAL */}
      {viewReport && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
           <div className="bg-white rounded-xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in duration-200">
              <div className="p-6 border-b flex justify-between items-center">
                 <div>
                    <h3 className="text-xl font-bold">Report Details</h3>
                    <p className="text-slate-500 text-sm">Week of {formatDate(viewReport.weekStartDate)}</p>
                 </div>
                 <button onClick={() => setViewReport(null)} className="text-slate-400 hover:text-slate-600">
                    <X className="w-6 h-6" />
                 </button>
              </div>
              <div className="p-6 overflow-y-auto flex-1">
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
                    <thead className="text-slate-500 border-b">
                       <tr>
                          <th className="text-left py-2">Product</th>
                          <th className="text-right py-2">Recv</th>
                          <th className="text-right py-2">Sold</th>
                          <th className="text-right py-2">Rem</th>
                          <th className="text-right py-2">Rev</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y">
                       {viewReport.details.map((d, i) => (
                          <tr key={i}>
                             <td className="py-2 font-medium">{d.productName}</td>
                             <td className="py-2 text-right text-slate-500">{d.quantityReceived}</td>
                             <td className="py-2 text-right">{d.quantitySold}</td>
                             <td className="py-2 text-right text-blue-500">{d.remainingStock}</td>
                             <td className="py-2 text-right font-medium text-emerald-600">${d.revenue.toLocaleString()}</td>
                          </tr>
                       ))}
                    </tbody>
                 </table>

                 {viewReport.notes && (
                    <div className="mt-6 bg-slate-50 p-3 rounded text-sm italic text-slate-600">
                       " {viewReport.notes} "
                    </div>
                 )}
              </div>
           </div>
        </div>
      )}
    </div>
  );
};