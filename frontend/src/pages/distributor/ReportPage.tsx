import React, { useState, useEffect, useMemo } from 'react';
import { Product, User, WeeklyReport, Order, ReportStatus, OrderStatus } from '../../types';
import { reportService } from '../../services/reportService';
import { Card } from '../../components/Card';
import { Save, Loader2, Calendar, Info } from 'lucide-react';

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

  // --- 1. TÍNH CHU KỲ THỜI GIAN ---
  const weekRange = useMemo(() => {
    let anchorMonday: Date;
    if (editReportId) {
      const report = myReports.find(r => r.id === editReportId);
      anchorMonday = report ? new Date(report.weekStartDate) : new Date();
    } else {
      const d = new Date();
      d.setHours(0, 0, 0, 0); 
      const currentDay = d.getDay(); 
      const diffToMonday = d.getDate() - (currentDay === 0 ? 6 : currentDay - 1);
      anchorMonday = new Date(d.setDate(diffToMonday));
    }
    anchorMonday.setHours(0, 0, 0, 0);

    const orderStartDate = new Date(anchorMonday);
    orderStartDate.setDate(anchorMonday.getDate() - 2); // T7 tuần trước
    orderStartDate.setHours(0, 0, 0, 0);

    const orderEndLimit = new Date(anchorMonday);
    orderEndLimit.setDate(anchorMonday.getDate() + 5); // T7 tuần này
    orderEndLimit.setHours(0, 0, 0, 0);

    const reportingStart = new Date(orderEndLimit);
    const reportingEnd = new Date(reportingStart);
    reportingEnd.setDate(reportingStart.getDate() + 1);

    return { anchorMonday, orderStartDate, orderEndLimit, reportingStart, reportingEnd };
  }, [editReportId, myReports]);

  // Load data edit
  useEffect(() => {
    if (editReportId) {
      const report = myReports.find(r => r.id === editReportId);
      if (report) {
        setReportNotes(report.notes || '');
        const details: Record<string, { sold: number, damaged: number }> = {};
        report.details.forEach(d => {
          // Xử lý an toàn: d.productId có thể là object hoặc string
          const pId = typeof d.productId === 'object' && d.productId !== null 
            ? (d.productId as any)._id 
            : d.productId;
          details[pId] = { sold: d.quantitySold, damaged: d.quantityDamaged };
        });
        setReportDetails(details);
      }
    } else {
      setReportNotes('');
      setReportDetails({});
    }
  }, [editReportId, myReports]);

  // --- 2. LOGIC TỒN KHO (ĐÃ FIX SO SÁNH ID) ---
  const getProductStockStats = (productId: string) => {
    // A. Tồn đầu kỳ
    const previousReport = myReports
      .filter(r => 
          r.status === ReportStatus.APPROVED && 
          new Date(r.weekStartDate).getTime() < weekRange.anchorMonday.getTime()
      )
      .sort((a, b) => new Date(b.weekStartDate).getTime() - new Date(a.weekStartDate).getTime())[0];
    
    let prevRemaining = 0;
    if (previousReport) {
      const prevDetail = previousReport.details.find(d => {
          // FIX: So sánh an toàn cả object lẫn string
          const idInDetail = typeof d.productId === 'object' && d.productId !== null
             ? (d.productId as any)._id || (d.productId as any).id
             : d.productId;
          return idInDetail === productId;
      });
      prevRemaining = prevDetail ? prevDetail.remainingStock : 0;
    }

    // B. Nhập trong kỳ
    const validOrders = myOrders.filter(o => {
      if (o.status !== OrderStatus.APPROVED) return false;
      const orderDate = new Date(o.createdAt);
      return orderDate >= weekRange.orderStartDate && orderDate < weekRange.orderEndLimit;
    });

    const newReceived = validOrders.reduce((acc, order) => {
      const item = order.items.find(i => i.productId === productId);
      return acc + (item ? item.quantity : 0);
    }, 0);

    // C. ĐÃ BÁO CÁO (TRỪ ĐI)
    const alreadyReportedInThisCycle = myReports
      .filter(r => {
          const rDate = new Date(r.weekStartDate); rDate.setHours(0,0,0,0);
          const anchorM = new Date(weekRange.anchorMonday); anchorM.setHours(0,0,0,0);
          
          const isSameWeek = rDate.getTime() === anchorM.getTime();
          const isNotCurrentEditing = r.id !== editReportId;
          const isValidStatus = r.status !== ReportStatus.REJECTED;
          
          return isSameWeek && isNotCurrentEditing && isValidStatus;
      })
      .reduce((acc, report) => {
          // --- FIX QUAN TRỌNG TẠI ĐÂY ---
          const detail = report.details.find(d => {
             // Kiểm tra xem d.productId là string hay object để lấy ID so sánh
             const idToCheck = (typeof d.productId === 'object' && d.productId !== null)
                ? (d.productId as any)._id || (d.productId as any).id
                : d.productId;
             
             return idToCheck === productId;
          });
          
          return acc + (detail ? (detail.quantitySold + detail.quantityDamaged) : 0);
      }, 0);

    const totalInput = prevRemaining + newReceived;
    const currentAvailable = totalInput - alreadyReportedInThisCycle;

    return {
      prevRemaining,
      newReceived,
      alreadyReported: alreadyReportedInThisCycle,
      totalAvailable: Math.max(0, currentAvailable)
    };
  };

  const handleReportChange = (productId: string, field: 'sold' | 'damaged', value: number) => {
    setReportDetails(prev => ({
      ...prev,
      [productId]: { ...prev[productId], [field]: Math.max(0, value) }
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

        const reportPayload = {
          totalRevenue: details.reduce((sum, d) => sum + d.revenue, 0),
          totalSold: details.reduce((sum, d) => sum + d.quantitySold, 0),
          totalDamaged: details.reduce((sum, d) => sum + d.quantityDamaged, 0),
          details,
          notes: reportNotes,
          weekStartDate: weekRange.anchorMonday.toISOString()
        };

        editReportId ? await reportService.update(editReportId, reportPayload) : await reportService.submit(reportPayload);
        onReportSubmit();
    } catch (error: any) {
        alert(error.response?.data?.msg || "Failed to submit report");
    } finally {
        setIsSubmitting(false);
    }
  };

  const calculatedRevenue = products.reduce((acc, p) => acc + ((reportDetails[p.id]?.sold || 0) * p.price), 0);

  return (
    <Card title={editReportId ? "Chỉnh sửa báo cáo" : "Tạo báo cáo doanh số"}>
       <div className="mb-6 p-4 bg-blue-50 border border-blue-200 text-blue-900 rounded-lg text-sm flex items-start shadow-sm">
         <Info className="w-5 h-5 mr-3 flex-shrink-0 text-blue-600 mt-0.5"/>
         <div className="space-y-1">
            <p className="font-bold text-base">Chu kỳ tuần: {weekRange.anchorMonday.toLocaleDateString('vi-VN')}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1 mt-1">
                <p>🛒 <strong>Thời gian đặt hàng:</strong> <br/> 
                   {weekRange.orderStartDate.toLocaleDateString('vi-VN')} (Thứ 7) ➔ {new Date(weekRange.orderEndLimit.getTime() - 1).toLocaleDateString('vi-VN')} (Thứ 6)</p>
                <p>📝 <strong>Thời gian báo cáo:</strong> <br/>
                   {weekRange.reportingStart.toLocaleDateString('vi-VN')} (Thứ 7) & {weekRange.reportingEnd.toLocaleDateString('vi-VN')} (CN)</p>
            </div>
            <p className="text-xs text-blue-500 italic mt-2 border-t border-blue-200 pt-1">
                * Số lượng "Khả dụng" đã tự động trừ đi các sản phẩm bạn đã báo cáo trong các phiếu khác của Thứ 7/CN này.
            </p>
         </div>
       </div>

       <form onSubmit={submitReport} className="space-y-6">
         <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white">
           <table className="w-full text-sm text-left">
             <thead className="text-xs text-slate-600 uppercase bg-slate-50 border-b">
               <tr>
                 <th className="px-4 py-4 font-bold">Sản phẩm</th>
                 <th className="px-2 py-4 text-center text-slate-400">Tổng Nhập</th>
                 <th className="px-2 py-4 text-center text-orange-600 font-bold bg-orange-50 border-x border-orange-100">Đã báo cáo</th>
                 <th className="px-2 py-4 text-center bg-indigo-50 text-indigo-800 font-bold border-r border-indigo-100">Khả dụng</th>
                 <th className="px-4 py-4 w-28">Bán thêm</th>
                 <th className="px-4 py-4 w-28">Hỏng thêm</th>
                 <th className="px-2 py-4 text-center font-bold text-slate-700">Tồn cuối</th>
               </tr>
             </thead>
             <tbody className="divide-y divide-slate-100">
               {products.map(p => {
                 const stats = getProductStockStats(p.id);
                 const sold = reportDetails[p.id]?.sold || 0;
                 const damaged = reportDetails[p.id]?.damaged || 0;
                 const remaining = stats.totalAvailable - sold - damaged;

                 return (
                   <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                     <td className="px-4 py-4 font-semibold text-slate-800">
                        {p.name}
                        <div className="text-[10px] text-slate-400">Giá: {p.price.toLocaleString()}đ</div>
                     </td>
                     <td className="px-2 py-4 text-center text-slate-500 font-medium">
                        {stats.prevRemaining + stats.newReceived}
                     </td>
                     <td className="px-2 py-4 text-center text-orange-600 font-bold bg-orange-50/30 border-x border-orange-50">
                        {stats.alreadyReported > 0 ? `-${stats.alreadyReported}` : '-'}
                     </td>
                     <td className="px-2 py-4 text-center bg-indigo-50/30 font-black border-r border-indigo-50 text-indigo-700 text-base">
                        {stats.totalAvailable}
                     </td>
                     <td className="px-4 py-4">
                       <input 
                         type="number" min="0" max={stats.totalAvailable}
                         className="w-full border border-slate-200 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-indigo-500 outline-none"
                         value={reportDetails[p.id]?.sold ?? ''}
                         onChange={(e) => handleReportChange(p.id, 'sold', parseInt(e.target.value) || 0)}
                       />
                     </td>
                     <td className="px-4 py-4">
                       <input 
                         type="number" min="0"
                         className="w-full border border-slate-200 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-red-500 outline-none"
                         value={reportDetails[p.id]?.damaged ?? ''}
                         onChange={(e) => handleReportChange(p.id, 'damaged', parseInt(e.target.value) || 0)}
                       />
                     </td>
                     <td className={`px-2 py-4 text-center font-bold ${remaining < 0 ? 'text-red-500' : 'text-slate-700'}`}>
                       {remaining}
                     </td>
                   </tr>
                 );
               })}
             </tbody>
           </table>
         </div>
         <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
             <div className="space-y-2">
                 <label className="text-sm font-bold text-slate-700 ml-1">Ghi chú</label>
                 <textarea className="w-full border border-slate-200 p-4 rounded-xl h-32 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" value={reportNotes} onChange={e => setReportNotes(e.target.value)}></textarea>
             </div>
             <div className="bg-slate-900 text-white p-8 rounded-2xl shadow-xl space-y-6">
                 <div className="flex justify-between items-end">
                     <div><p className="text-slate-400 text-sm mb-1 uppercase tracking-wider">Doanh thu lần này</p><p className="text-4xl font-black text-emerald-400">{calculatedRevenue.toLocaleString('vi-VN')} đ</p></div>
                 </div>
                 <button type="submit" disabled={isSubmitting} className="w-full flex items-center justify-center px-6 py-4 bg-indigo-500 text-white rounded-xl hover:bg-indigo-400 font-bold shadow-lg">{isSubmitting ? <Loader2 className="animate-spin"/> : <Save/>} GỬI BÁO CÁO</button>
             </div>
         </div>
       </form>
    </Card>
  );
};