import React, { useState, useEffect, useMemo } from 'react';
import { Product, User, WeeklyReport, Order, ReportStatus, OrderStatus } from '../../types';
import { reportService } from '../../services/reportService';
import { Card } from '../../components/Card';
import { AlertCircle, Save, Loader2 } from 'lucide-react';

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
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 1. Tính toán ngày bắt đầu (T2) và kết thúc (CN) của tuần báo cáo
  const weekRange = useMemo(() => {
    let startDate: Date;

    if (editReportId) {
      const report = myReports.find(r => r.id === editReportId);
      startDate = report ? new Date(report.weekStartDate) : new Date();
    } else {
      const d = new Date();
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      startDate = new Date(d.setDate(diff));
    }
    startDate.setHours(0, 0, 0, 0);

    // Tính ngày kết thúc tuần (Thứ 2 tuần sau 00:00:00 làm mốc chặn)
    const nextWeekStart = new Date(startDate);
    nextWeekStart.setDate(startDate.getDate() + 7);

    return { 
        start: startDate, 
        endLimit: nextWeekStart // Các đơn hàng phải nhỏ hơn thời gian này
    };
  }, [editReportId, myReports]);

  // Load dữ liệu khi edit
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

  // 2. Logic tính tồn kho đã SỬA
  const getProductStockStats = (productId: string) => {
    // A. Lấy số dư từ báo cáo APPROVED gần nhất TRƯỚC tuần này
    const previousReport = myReports
      .filter(r => 
          r.status === ReportStatus.APPROVED && 
          new Date(r.weekStartDate).getTime() < weekRange.start.getTime() // Phải là báo cáo cũ hơn tuần này
      )
      .sort((a, b) => new Date(b.weekStartDate).getTime() - new Date(a.weekStartDate).getTime())[0];
    
    let prevRemaining = 0;
    if (previousReport) {
      const prevDetail = previousReport.details.find(d => d.productId === productId);
      prevRemaining = prevDetail ? prevDetail.remainingStock : 0;
    }

    // B. Tính hàng nhập: CHỈ tính đơn hàng nằm TRONG tuần này
    // Logic: OrderDate >= Thứ 2 tuần này  VÀ OrderDate < Thứ 2 tuần sau
    const validOrders = myOrders.filter(o => {
      if (o.status !== OrderStatus.APPROVED) return false;
      
      const orderDate = new Date(o.createdAt);
      return orderDate >= weekRange.start && orderDate < weekRange.endLimit;
    });

    const newReceived = validOrders.reduce((acc, order) => {
      const item = order.items.find(i => i.productId === productId);
      return acc + (item ? item.quantity : 0);
    }, 0);

    return {
      prevRemaining,
      newReceived, // Số này giờ chỉ tính order trong tuần
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

  const submitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
        const details = products.map(p => {
          const input = reportDetails[p.id] || { sold: 0, damaged: 0 };
          const stats = getProductStockStats(p.id);
          
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
          totalRevenue,
          totalSold,
          totalDamaged,
          details,
          notes: reportNotes,
          weekStartDate: weekRange.start.toISOString() // Gửi đúng ngày T2 của tuần đang chọn
        };

        if (editReportId) {
          await reportService.update(editReportId, reportPayload);
        } else {
          await reportService.submit(reportPayload);
        }
        
        onReportSubmit();
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

  // ... (Phần render UI giữ nguyên, chỉ thay đổi logic bên trên)
  // Lưu ý: Phần UI Table bạn có thể thêm hiển thị "New Received (This Week)" để user dễ kiểm tra
  
  return (
    <Card title={editReportId ? "Edit Weekly Report" : "New Weekly Report"}>
       <div className="mb-6 p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-sm flex items-start">
         <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5"/>
         <div>
            <strong>Reporting Logic for {weekRange.start.toLocaleDateString()} - {new Date(weekRange.endLimit.getTime() - 1).toLocaleDateString()}:</strong> 
            <ul className="list-disc ml-4 mt-1 space-y-1">
               <li><strong>Previous Remaining:</strong> Stock carried over from last approved report.</li>
               <li><strong>Received This Week:</strong> Orders approved from Monday to Sunday of this week ONLY.</li>
               <li>Orders placed for <em>next week</em> will not appear here.</li>
            </ul>
         </div>
       </div>

       <form onSubmit={submitReport} className="space-y-6">
         <div className="overflow-x-auto border rounded-lg shadow-sm">
           <table className="w-full text-sm text-left">
             <thead className="text-xs text-slate-700 uppercase bg-slate-100">
               <tr>
                 <th className="px-4 py-3">Product</th>
                 {/* Chia cột rõ ràng để user dễ hiểu */}
                 <th className="px-4 py-3 text-center text-gray-500 w-20">Prev</th>
                 <th className="px-4 py-3 text-center text-blue-600 w-20">In-Week</th>
                 <th className="px-4 py-3 text-center bg-blue-50 w-24 border-l border-r border-blue-100 font-bold">Total Avail</th>
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
                     <td className="px-4 py-3 font-medium">{p.name}</td>
                     
                     {/* Cột Tồn cũ */}
                     <td className="px-4 py-3 text-center text-gray-500">{stats.prevRemaining}</td>
                     
                     {/* Cột Nhập mới trong tuần (Sửa lại logic hiển thị) */}
                     <td className="px-4 py-3 text-center text-blue-600 font-medium">+{stats.newReceived}</td>
                     
                     {/* Tổng có thể bán */}
                     <td className="px-4 py-3 text-center bg-blue-50 font-bold border-l border-r border-blue-100 text-blue-800">
                        {stats.totalAvailable}
                     </td>

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
         {/* ... Phần Footer giữ nguyên ... */}
         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           <div>
             <label className="block text-sm font-bold text-slate-700 mb-2">Notes / Issues</label>
             <textarea 
               className="w-full border p-3 rounded-lg h-24 text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
               value={reportNotes} 
               onChange={e => setReportNotes(e.target.value)} 
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