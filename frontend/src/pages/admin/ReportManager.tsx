import React, { useState } from 'react';
import { WeeklyReport, ReportStatus } from '../../types';
import { reportService } from '../../services/reportService'; // <--- Import Service thật
import { Card } from '../../components/Card';
import { Check, X, Loader2 } from 'lucide-react'; // Thêm Loader

interface ReportManagerProps {
  reports: WeeklyReport[];
  onRefresh: () => void;
}

export const ReportManager: React.FC<ReportManagerProps> = ({ reports, onRefresh }) => {
  // State để biết đang xử lý report nào (hiện loading xoay vòng)
  const [processingId, setProcessingId] = useState<string | null>(null);

  const handleUpdateStatus = async (id: string, status: ReportStatus) => {
    // Xác nhận trước khi reject
    if (status === ReportStatus.REJECTED && !confirm('Are you sure you want to reject this report?')) {
      return;
    }

    setProcessingId(id); // Bật loading cho card này
    try {
      await reportService.updateStatus(id, status);
      onRefresh(); // Refresh lại dữ liệu từ App.tsx
    } catch (error: any) {
      alert(error.response?.data?.msg || 'Failed to update report status');
    } finally {
      setProcessingId(null); // Tắt loading
    }
  };

  // Sắp xếp: PENDING lên đầu, sau đó theo ngày
  const sortedReports = [...reports].sort((a, b) => {
    if (a.status === ReportStatus.PENDING && b.status !== ReportStatus.PENDING) return -1;
    if (a.status !== ReportStatus.PENDING && b.status === ReportStatus.PENDING) return 1;
    return new Date(b.weekStartDate).getTime() - new Date(a.weekStartDate).getTime();
  });

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-800">Distributor Reports Review</h2>
      
      <div className="space-y-4">
        {reports.length === 0 && (
          <div className="text-center py-8 text-slate-500 bg-white rounded-lg border border-dashed">
            No reports found.
          </div>
        )}
        
        {sortedReports.map(report => (
          <Card 
            key={report.id} 
            className={`flex flex-col gap-4 border-l-4 transition-all hover:shadow-md ${
              report.status === ReportStatus.PENDING ? 'border-l-yellow-400' : 
              report.status === ReportStatus.APPROVED ? 'border-l-green-500' : 'border-l-red-500'
            }`}
          >
            <div className="flex justify-between items-start">
               <div>
                 <div className="flex items-center gap-2">
                   <h3 className="font-bold text-lg text-slate-800">{report.distributorName || 'Unknown User'}</h3>
                   <span className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-600 font-medium">
                     {report.distributorGroup || 'N/A'}
                   </span>
                   <span className={`text-xs font-bold px-2 py-1 rounded uppercase ${
                     report.status === ReportStatus.PENDING ? 'bg-yellow-100 text-yellow-700' :
                     report.status === ReportStatus.APPROVED ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                   }`}>
                     {report.status}
                   </span>
                 </div>
                 <p className="text-sm text-slate-500">Week of: {new Date(report.weekStartDate).toLocaleDateString()}</p>
               </div>
               <div className="text-right">
                 <p className="text-2xl font-bold text-emerald-600">${report.totalRevenue.toLocaleString()}</p>
                 <p className="text-xs text-slate-400 font-medium uppercase">Total Revenue</p>
               </div>
            </div>
            
            <div className="bg-slate-50 p-4 rounded-lg text-sm border border-slate-100">
               <div className="overflow-x-auto">
                 <table className="w-full text-left">
                    <thead>
                       <tr className="text-slate-500 border-b border-slate-200">
                         <th className="pb-2 font-medium">Product</th>
                         <th className="pb-2 text-right font-medium">Rcvd</th>
                         <th className="pb-2 text-right font-medium">Sold</th>
                         <th className="pb-2 text-right font-medium">Dmg</th>
                         <th className="pb-2 text-right font-medium">Stock</th>
                         <th className="pb-2 text-right font-medium">Revenue</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {report.details.map((d, idx) => (
                        <tr key={idx}>
                          <td className="py-2 font-medium text-slate-700">{d.productName}</td>
                          <td className="py-2 text-right text-slate-500">{d.quantityReceived}</td>
                          <td className="py-2 text-right font-medium">{d.quantitySold}</td>
                          <td className="py-2 text-right text-red-500">{d.quantityDamaged}</td>
                          <td className="py-2 text-right text-blue-600 font-medium">{d.remainingStock}</td>
                          <td className="py-2 text-right font-medium text-emerald-600">${d.revenue.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                 </table>
               </div>
               {report.notes && (
                <div className="mt-4 pt-3 border-t border-slate-200">
                  <span className="font-bold text-xs uppercase text-slate-500 block mb-1">Distributor Notes:</span>
                  <p className="italic text-slate-600 bg-white p-2 rounded border border-slate-100">"{report.notes}"</p>
                </div>
              )}
            </div>

            {report.status === ReportStatus.PENDING && (
              <div className="flex justify-end space-x-3 pt-2">
                 <button 
                    onClick={() => handleUpdateStatus(report.id, ReportStatus.REJECTED)} 
                    disabled={processingId !== null}
                    className="flex items-center px-4 py-2 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-50"
                 >
                   {processingId === report.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <X className="w-4 h-4 mr-2"/>} 
                   Reject
                 </button>
                 <button 
                    onClick={() => handleUpdateStatus(report.id, ReportStatus.APPROVED)} 
                    disabled={processingId !== null}
                    className="flex items-center px-4 py-2 bg-green-600 text-white hover:bg-green-700 rounded-lg transition shadow-sm disabled:opacity-50"
                 >
                   {processingId === report.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <Check className="w-4 h-4 mr-2"/>}
                   Approve & Sync
                 </button>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
};