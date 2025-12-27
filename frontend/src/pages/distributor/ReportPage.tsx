import React, { useState, useEffect } from 'react';
import { Product, User, WeeklyReport, Order, ReportStatus, OrderStatus } from '../../types';
import { reportService } from '../../services/reportService'; // <--- Dùng Service thật
import { Card } from '../../components/Card';
import { AlertCircle, Save, Loader2 } from 'lucide-react'; // Thêm Loader icon

interface ReportPageProps {
  user: User;
  products: Product[];
  myReports: WeeklyReport[];
  myOrders: Order[];
  editReportId?: string | null;
  onReportSubmit: () => void;
}

export const ReportPage: React.FC<ReportPageProps> = ({ user, products, myReports, myOrders, editReportId, onReportSubmit }) => {
  const [reportNotes, setReportNotes] = useState('');
  const [reportDetails, setReportDetails] = useState<Record<string, { sold: number, damaged: number }>>({});
  const [isSubmitting, setIsSubmitting] = useState(false); // <--- Loading state

  // Load dữ liệu khi sửa báo cáo
  useEffect(() => {
    if (editReportId) {
      const report = myReports.find(r => r.id === editReportId);
      if (report) {
        setReportNotes(report.notes || '');
        const details: Record<string, { sold: number, damaged: number }> = {};
        report.details.forEach(d => {
          details[d.productId] = { sold: d.quantitySold, damaged: d.quantityDamaged };
        });
        setReportDetails(details);
      }
    } else {
      setReportNotes('');
      setReportDetails({});
    }
  }, [editReportId, myReports]);

  // Logic tính ngày đầu tuần (Thứ 2)
  const getCurrentWeekStart = () => {
    // Nếu đang Edit, giữ nguyên ngày của báo cáo cũ, nếu không thì lấy tuần hiện tại
    if (editReportId) {
       const report = myReports.find(r => r.id === editReportId);
       if (report) return report.weekStartDate;
    }

    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); 
    const monday = new Date(d.setDate(diff));
    // Reset giờ về 0 để tránh lệch múi giờ khi so sánh string
    monday.setHours(0,0,0,0);
    return monday.toISOString(); // Backend lưu Date object
  };

  // Logic tính tồn kho: Lấy báo cáo đã duyệt gần nhất + Đơn hàng mới nhập
  const getProductStockStats = (productId: string) => {
    const approvedReports = myReports
      .filter(r => r.status === ReportStatus.APPROVED)
      .sort((a,b) => new Date(b.weekStartDate).getTime() - new Date(a.weekStartDate).getTime());
    
    const previousReport = approvedReports.length > 0 ? approvedReports[0] : null;
    
    let prevRemaining = 0;
    if (previousReport) {
      const prevDetail = previousReport.details.find(d => d.productId === productId);
      prevRemaining = prevDetail ? prevDetail.remainingStock : 0;
    }

    // Chỉ tính các đơn hàng đã Approved và ngày tạo > ngày báo cáo trước đó
    const validOrders = myOrders.filter(o => {
      if (o.status !== OrderStatus.APPROVED) return false;
      if (previousReport) {
         return new Date(o.createdAt).getTime() > new Date(previousReport.weekStartDate).getTime();
      }
      return true;
    });

    const newReceived = validOrders.reduce((acc, order) => {
      const item = order.items.find(i => i.productId === productId);
      return acc + (item ? item.quantity : 0);
    }, 0);

    return {
      prevRemaining,
      newReceived,
      totalAvailable: prevRemaining + newReceived
    };
  };

  const handleReportChange = (productId: string, field: 'sold' | 'damaged', value: number) => {
    setReportDetails(prev => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        [field]: Math.max(0, value)
      }
    }));
  };

  // --- HÀM SUBMIT (GỌI API THẬT) ---
  const submitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setIsSubmitting(true);
    try {
        const weekStart = getCurrentWeekStart();
        
        // Tính toán chi tiết từng sản phẩm để gửi lên Server
        const details = products.map(p => {
          const input = reportDetails[p.id] || { sold: 0, damaged: 0 };
          const stats = getProductStockStats(p.id);
          
          // Validate logic: Không thể bán nhiều hơn số đang có
          const sold = Math.min(input.sold, stats.totalAvailable);
          const damaged = Math.min(input.damaged, stats.totalAvailable - sold);
          const remaining = stats.totalAvailable - sold - damaged;

          return {
            productId: p.id,
            productName: p.name,
            quantityReceived: stats.totalAvailable,
            quantitySold: sold,
            quantityDamaged: damaged,
            revenue: sold * p.price,
            remainingStock: remaining
          };
        });

        const totalRevenue = details.reduce((sum, d) => sum + d.revenue, 0);
        const totalSold = details.reduce((sum, d) => sum + d.quantitySold, 0);
        const totalDamaged = details.reduce((sum, d) => sum + d.quantityDamaged, 0);

        const reportPayload = {
          // distributorId: user.id, // Backend tự lấy từ Token
          totalRevenue,
          totalSold,
          totalDamaged,
          details,
          notes: reportNotes,
          weekStartDate: weekStart
        };

        if (editReportId) {
          await reportService.update(editReportId, reportPayload);
        } else {
          await reportService.submit(reportPayload);
        }
        
        onReportSubmit(); // Refresh data ở App.tsx
    } catch (error: any) {
        alert(error.response?.data?.msg || "Failed to submit report");
    } finally {
        setIsSubmitting(false);
    }
  };

  const calculatedRevenue = products.reduce((acc, p) => {
    const info = reportDetails[p.id] || { sold: 0 };
    return acc + (info.sold * p.price);
  }, 0);

  return (
    <Card title={editReportId ? "Edit Weekly Report" : "New Weekly Report"}>
       <div className="mb-6 p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-sm flex items-start">
         <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5"/>
         <div>
            <strong>Inventory Logic:</strong> 
            <ul className="list-disc ml-4 mt-1 space-y-1">
               <li>Received = (Remaining from Last Approved Report) + (New Approved Orders this week).</li>
               <li>Remaining = Received - Sold - Damaged.</li>
               <li>Once approved, the "Remaining" count carries over to next week.</li>
            </ul>
         </div>
       </div>

       <form onSubmit={submitReport} className="space-y-6">
         <div className="overflow-x-auto border rounded-lg shadow-sm">
           <table className="w-full text-sm text-left">
             <thead className="text-xs text-slate-700 uppercase bg-slate-100">
               <tr>
                 <th className="px-4 py-3">Product</th>
                 <th className="px-4 py-3 text-center bg-blue-50">Received</th>
                 <th className="px-4 py-3 w-24">Sold</th>
                 <th className="px-4 py-3 w-24">Damaged</th>
                 <th className="px-4 py-3 text-center bg-slate-50">Remaining</th>
                 <th className="px-4 py-3 text-right">Revenue</th>
               </tr>
             </thead>
             <tbody>
               {products.map(p => {
                 const stats = getProductStockStats(p.id);
                 const sold = reportDetails[p.id]?.sold || 0;
                 const damaged = reportDetails[p.id]?.damaged || 0;
                 const revenue = sold * p.price;
                 const remaining = stats.totalAvailable - sold - damaged;

                 return (
                   <tr key={p.id} className="border-b hover:bg-slate-50">
                     <td className="px-4 py-3 font-medium">
                        {p.name}
                        {stats.prevRemaining > 0 && <div className="text-[10px] text-slate-400">Prev: {stats.prevRemaining}</div>}
                     </td>
                     <td className="px-4 py-3 text-center text-blue-700 font-medium bg-blue-50/50">{stats.totalAvailable}</td>
                     <td className="px-4 py-3">
                       <input 
                         type="number" 
                         min="0"
                         max={stats.totalAvailable}
                         className="w-full border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 outline-none transition"
                         value={reportDetails[p.id]?.sold || ''}
                         placeholder="0"
                         onChange={(e) => handleReportChange(p.id, 'sold', parseInt(e.target.value) || 0)}
                       />
                     </td>
                     <td className="px-4 py-3">
                       <input 
                         type="number" 
                         min="0"
                         className="w-full border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-red-500 outline-none transition"
                         value={reportDetails[p.id]?.damaged || ''}
                         placeholder="0"
                         onChange={(e) => handleReportChange(p.id, 'damaged', parseInt(e.target.value) || 0)}
                       />
                     </td>
                     <td className={`px-4 py-3 text-center font-medium ${remaining < 0 ? 'text-red-600' : 'text-slate-600'}`}>
                       {remaining}
                     </td>
                     <td className="px-4 py-3 text-right font-semibold text-emerald-600">
                       ${revenue.toLocaleString()}
                     </td>
                   </tr>
                 );
               })}
             </tbody>
           </table>
         </div>
         
         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           <div>
             <label className="block text-sm font-bold text-slate-700 mb-2">Notes / Issues</label>
             <textarea 
               className="w-full border p-3 rounded-lg h-24 text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
               value={reportNotes} 
               onChange={e => setReportNotes(e.target.value)} 
               placeholder="Describe market feedback, delivery issues, etc..."
             ></textarea>
           </div>
           <div className="bg-slate-50 p-6 rounded-lg flex flex-col justify-between border border-slate-200">
             <div>
               <p className="text-sm text-slate-500">Total Estimated Revenue</p>
               <p className="text-3xl font-bold text-emerald-600">${calculatedRevenue.toLocaleString()}</p>
             </div>
             <div className="flex gap-2 mt-4">
               <button 
                 type="submit" 
                 disabled={isSubmitting}
                 className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-sm transition disabled:opacity-70 disabled:cursor-not-allowed"
               >
                  {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <Save className="w-4 h-4 mr-2"/>}
                  {editReportId ? "Update Report" : "Submit Report"}
               </button>
             </div>
           </div>
         </div>
       </form>
    </Card>
  );
};