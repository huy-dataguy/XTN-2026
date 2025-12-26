import React from 'react';
import { WeeklyReport, ReportStatus } from '../../types';
import { ReportService } from '../../services/mockBackend';
import { Card } from '../../components/Card';
import { Check, X } from 'lucide-react';

interface ReportManagerProps {
  reports: WeeklyReport[];
  onRefresh: () => void;
}

export const ReportManager: React.FC<ReportManagerProps> = ({ reports, onRefresh }) => {
  const handleApprove = (id: string) => {
    ReportService.approve(id);
    onRefresh();
  };

  const handleReject = (id: string) => {
    ReportService.reject(id);
    onRefresh();
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-800">Distributor Reports Review</h2>
      <div className="space-y-4">
        {reports.length === 0 && <p className="text-slate-500">No reports found.</p>}
        {reports.sort((a,b) => b.status === ReportStatus.PENDING ? -1 : 1).map(report => (
          <Card key={report.id} className={`flex flex-col gap-4 border-l-4 ${report.status === ReportStatus.PENDING ? 'border-l-yellow-400' : report.status === ReportStatus.APPROVED ? 'border-l-green-500' : 'border-l-red-500'}`}>
            <div className="flex justify-between items-start">
               <div>
                 <div className="flex items-center gap-2">
                   <h3 className="font-bold text-lg">{report.distributorName}</h3>
                   <span className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-600">{report.distributorGroup || 'N/A'}</span>
                   <span className={`text-xs font-bold px-2 py-1 rounded uppercase ${
                     report.status === ReportStatus.PENDING ? 'bg-yellow-100 text-yellow-700' :
                     report.status === ReportStatus.APPROVED ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                   }`}>
                     {report.status}
                   </span>
                 </div>
                 <p className="text-sm text-slate-500">Week of: {report.weekStartDate}</p>
               </div>
               <div className="text-right">
                 <p className="text-2xl font-bold text-emerald-600">${report.totalRevenue.toLocaleString()}</p>
                 <p className="text-xs text-slate-400">Total Revenue</p>
               </div>
            </div>
            
            <div className="bg-slate-50 p-3 rounded-lg text-sm">
               <div className="overflow-x-auto">
                 <table className="w-full text-left">
                    <thead>
                       <tr className="text-slate-500 border-b">
                         <th className="pb-1">Product</th>
                         <th className="pb-1 text-right">Rcvd</th>
                         <th className="pb-1 text-right">Sold</th>
                         <th className="pb-1 text-right">Dmg</th>
                         <th className="pb-1 text-right">Stock</th>
                         <th className="pb-1 text-right">Revenue</th>
                       </tr>
                    </thead>
                    <tbody>
                      {report.details.map((d, idx) => (
                        <tr key={idx} className="border-b border-slate-100 last:border-0">
                          <td className="py-1 font-medium">{d.productName}</td>
                          <td className="py-1 text-right text-slate-500">{d.quantityReceived}</td>
                          <td className="py-1 text-right">{d.quantitySold}</td>
                          <td className="py-1 text-right text-red-500">{d.quantityDamaged}</td>
                          <td className="py-1 text-right text-blue-500">{d.remainingStock}</td>
                          <td className="py-1 text-right font-medium">${d.revenue.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                 </table>
               </div>
               {report.notes && (
                <div className="mt-3 pt-2 border-t border-slate-200">
                  <span className="font-bold text-xs uppercase text-slate-500">Distributor Notes:</span>
                  <p className="italic text-slate-600">{report.notes}</p>
                </div>
              )}
            </div>

            {report.status === ReportStatus.PENDING && (
              <div className="flex justify-end space-x-3 pt-2">
                 <button onClick={() => handleReject(report.id)} className="flex items-center px-4 py-2 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg transition">
                   <X className="w-4 h-4 mr-2"/> Reject
                 </button>
                 <button onClick={() => handleApprove(report.id)} className="flex items-center px-4 py-2 bg-green-600 text-white hover:bg-green-700 rounded-lg transition shadow-sm">
                   <Check className="w-4 h-4 mr-2"/> Approve & Sync
                 </button>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
};