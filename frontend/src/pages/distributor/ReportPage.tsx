import React, { useState, useEffect, useMemo } from 'react';
import { Product, User, WeeklyReport, Order, ReportStatus, OrderStatus } from '../../types';
import { reportService } from '../../services/reportService';
import { Card } from '../../components/Card';
import { Save, Loader2, Calendar, Info, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';

interface ReportPageProps {
  user: User;
  products: Product[];
  myReports: WeeklyReport[];
  myOrders: Order[];
  editReportId?: string | null;
  onReportSubmit: () => void;
}

// Hàm helper để tìm ngày Thứ 2 của tuần chứa ngày d
const getMonday = (d: Date) => {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - (day === 0 ? 6 : day - 1);
  const monday = new Date(date.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
};

export const ReportPage: React.FC<ReportPageProps> = ({ user, products, myReports, myOrders, editReportId, onReportSubmit }) => {
  // --- STATE ---
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [reportNotes, setReportNotes] = useState('');
  const [reportDetails, setReportDetails] = useState<Record<string, { sold: number, damaged: number }>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- 1. TÍNH CHU KỲ THỜI GIAN DỰA TRÊN NGÀY CHỌN ---
  const weekRange = useMemo(() => {
    let anchorMonday: Date;
    
    if (editReportId) {
      const report = myReports.find(r => r.id === editReportId);
      anchorMonday = report ? getMonday(new Date(report.weekStartDate)) : getMonday(selectedDate);
    } else {
      anchorMonday = getMonday(selectedDate);
    }

    const orderStartDate = new Date(anchorMonday);
    orderStartDate.setDate(anchorMonday.getDate() - 2); // T7 tuần trước
    orderStartDate.setHours(0, 0, 0, 0);

    const orderEndLimit = new Date(anchorMonday);
    orderEndLimit.setDate(anchorMonday.getDate() + 5); // T7 tuần này
    orderEndLimit.setHours(0, 0, 0, 0);

    const reportingStart = new Date(orderEndLimit); // T7
    const reportingEnd = new Date(reportingStart);
    reportingEnd.setDate(reportingStart.getDate() + 1); // CN

    return { anchorMonday, orderStartDate, orderEndLimit, reportingStart, reportingEnd };
  }, [editReportId, myReports, selectedDate]);

  // Load dữ liệu khi chỉnh sửa
  useEffect(() => {
    if (editReportId) {
      const report = myReports.find(r => r.id === editReportId);
      if (report) {
        setReportNotes(report.notes || '');
        const details: Record<string, { sold: number, damaged: number }> = {};
        report.details.forEach(d => {
          const pId = typeof d.productId === 'object' && d.productId !== null 
            ? (d.productId as any)._id || (d.productId as any).id
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

  // --- 2. LOGIC TỒN KHO ---
  const getProductStockStats = (productId: string) => {
    // A. Tồn đầu kỳ (Lấy từ báo cáo APPROVED gần nhất trước tuần này)
    const previousReport = myReports
      .filter(r => 
          r.status === ReportStatus.APPROVED && 
          new Date(r.weekStartDate).getTime() < weekRange.anchorMonday.getTime()
      )
      .sort((a, b) => new Date(b.weekStartDate).getTime() - new Date(a.weekStartDate).getTime())[0];
    
    let prevRemaining = 0;
    if (previousReport) {
      const prevDetail = previousReport.details.find(d => {
          const idInDetail = (typeof d.productId === 'object' && d.productId !== null)
             ? (d.productId as any)._id || (d.productId as any).id
             : d.productId;
          return idInDetail === productId;
      });
      prevRemaining = prevDetail ? prevDetail.remainingStock : 0;
    }

    // B. Nhập trong kỳ (Đơn hàng APPROVED trong khoảng T7 tuần trước đến T6 tuần này)
    const validOrders = myOrders.filter(o => {
      if (o.status !== OrderStatus.APPROVED) return false;
      const orderDate = new Date(o.createdAt);
      return orderDate >= weekRange.orderStartDate && orderDate < weekRange.orderEndLimit;
    });

    const newReceived = validOrders.reduce((acc, order) => {
      const item = order.items.find(i => i.productId === productId);
      return acc + (item ? item.quantity : 0);
    }, 0);

    // C. Đã báo cáo trong các phiếu khác cùng tuần này
    const alreadyReportedInThisCycle = myReports
      .filter(r => {
          const rDate = new Date(r.weekStartDate); rDate.setHours(0,0,0,0);
          const anchorM = new Date(weekRange.anchorMonday); anchorM.setHours(0,0,0,0);
          return rDate.getTime() === anchorM.getTime() && r.id !== editReportId && r.status !== ReportStatus.REJECTED;
      })
      .reduce((acc, report) => {
          const detail = report.details.find(d => {
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

  const handleWeekChange = (offsetDays: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(selectedDate.getDate() + offsetDays);
    setSelectedDate(newDate);
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
        alert(error.response?.data?.msg || "Lỗi khi gửi báo cáo");
    } finally {
        setIsSubmitting(false);
    }
  };

  const calculatedRevenue = products.reduce((acc, p) => acc + ((reportDetails[p.id]?.sold || 0) * p.price), 0);

  return (
    <Card title={editReportId ? "Chỉnh sửa báo cáo" : "Tạo báo cáo doanh số"}>
       
       {/* BỘ CHỌN THỜI GIAN */}
       <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Tuần báo cáo</p>
              <p className="text-sm font-black text-slate-800">
                Thứ 2, {weekRange.anchorMonday.toLocaleDateString('vi-VN')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button type="button" onClick={() => handleWeekChange(-7)} className="p-2 hover:bg-white hover:shadow-sm rounded-lg border border-transparent hover:border-slate-200 transition-all">
              <ChevronLeft className="w-5 h-5 text-slate-600" />
            </button>
            
            <input 
              type="date" 
              className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"
              value={selectedDate.toISOString().split('T')[0]}
              onChange={(e) => setSelectedDate(new Date(e.target.value))}
            />

            <button type="button" onClick={() => handleWeekChange(7)} className="p-2 hover:bg-white hover:shadow-sm rounded-lg border border-transparent hover:border-slate-200 transition-all">
              <ChevronRight className="w-5 h-5 text-slate-600" />
            </button>

            <div className="w-[1px] h-8 bg-slate-200 mx-2 hidden md:block"></div>

            <button 
              type="button" 
              onClick={() => setSelectedDate(new Date())}
              className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Hiện tại
            </button>
          </div>
       </div>

       {/* CHI TIẾT CHU KỲ */}
       <div className="mb-6 p-4 bg-blue-50 border border-blue-100 text-blue-900 rounded-xl text-sm flex items-start">
         <Info className="w-5 h-5 mr-3 flex-shrink-0 text-blue-600 mt-0.5"/>
         <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 w-full">
            <div>
              <p className="text-[10px] uppercase font-bold text-blue-400">🛒 Nhập hàng từ (T7 - T6)</p>
              <p className="font-semibold">{weekRange.orderStartDate.toLocaleDateString('vi-VN')} ➔ {new Date(weekRange.orderEndLimit.getTime() - 1).toLocaleDateString('vi-VN')}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-blue-400">📝 Hạn báo cáo (T7 - CN)</p>
              <p className="font-semibold">{weekRange.reportingStart.toLocaleDateString('vi-VN')} & {weekRange.reportingEnd.toLocaleDateString('vi-VN')}</p>
            </div>
         </div>
       </div>

       <form onSubmit={submitReport} className="space-y-6">
         <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-sm">
           <table className="w-full text-sm text-left">
             <thead className="text-xs text-slate-500 uppercase bg-slate-50/50 border-b">
               <tr>
                 <th className="px-4 py-4 font-bold">Sản phẩm</th>
                 <th className="px-2 py-4 text-center">Tổng Nhập</th>
                 <th className="px-2 py-4 text-center text-orange-600 bg-orange-50/50">Đã báo cáo</th>
                 <th className="px-2 py-4 text-center bg-indigo-50 text-indigo-700 font-bold">Khả dụng</th>
                 <th className="px-4 py-4 w-28">Bán thêm</th>
                 <th className="px-4 py-4 w-28">Hỏng thêm</th>
                 <th className="px-2 py-4 text-center font-bold">Tồn cuối</th>
               </tr>
             </thead>
             <tbody className="divide-y divide-slate-100">
               {products.map(p => {
                 const stats = getProductStockStats(p.id);
                 const sold = reportDetails[p.id]?.sold || 0;
                 const damaged = reportDetails[p.id]?.damaged || 0;
                 const remaining = stats.totalAvailable - sold - damaged;

                 return (
                   <tr key={p.id} className="hover:bg-slate-50/30 transition-colors">
                     <td className="px-4 py-4">
                        <p className="font-bold text-slate-800">{p.name}</p>
                        <p className="text-[10px] text-slate-400">{p.price.toLocaleString()}đ</p>
                     </td>
                     <td className="px-2 py-4 text-center text-slate-500">
                        {stats.prevRemaining + stats.newReceived}
                     </td>
                     <td className="px-2 py-4 text-center text-orange-600 font-bold bg-orange-50/30">
                        {stats.alreadyReported > 0 ? `-${stats.alreadyReported}` : '-'}
                     </td>
                     <td className="px-2 py-4 text-center bg-indigo-50/30 font-black text-indigo-700 text-base">
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
                 <label className="text-sm font-bold text-slate-700 ml-1">Ghi chú báo cáo</label>
                 <textarea 
                    placeholder="Nhập ghi chú nếu có (ví dụ: lý do hàng hỏng...)"
                    className="w-full border border-slate-200 p-4 rounded-2xl h-32 text-sm focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm" 
                    value={reportNotes} 
                    onChange={e => setReportNotes(e.target.value)}
                 />
             </div>
             <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-xl space-y-6 relative overflow-hidden">
                 <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full -mr-16 -mt-16"></div>
                 <div className="relative z-10">
                     <p className="text-slate-400 text-xs mb-1 uppercase font-bold tracking-widest">Doanh thu dự kiến</p>
                     <p className="text-4xl font-black text-emerald-400 tracking-tight">{calculatedRevenue.toLocaleString('vi-VN')} <span className="text-lg">đ</span></p>
                 </div>
                 <button 
                    type="submit" 
                    disabled={isSubmitting} 
                    className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-indigo-500 text-white rounded-2xl hover:bg-indigo-400 disabled:bg-slate-700 font-bold shadow-lg transition-all active:scale-[0.98]"
                 >
                    {isSubmitting ? <Loader2 className="animate-spin w-5 h-5"/> : <Save className="w-5 h-5"/>} 
                    {editReportId ? 'CẬP NHẬT BÁO CÁO' : 'GỬI BÁO CÁO NGAY'}
                 </button>
             </div>
         </div>
       </form>
    </Card>
  );
};