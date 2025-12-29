import React, { useState, useMemo } from 'react';
import { WeeklyReport, ReportStatus, DistributorGroup, User, Order } from '../../types';
import { reportService } from '../../services/reportService';
import { Card } from '../../components/Card';
import { Check, X, Loader2, Calendar, Filter, AlertCircle, User as UserIcon } from 'lucide-react';

interface ReportManagerProps {
  reports: WeeklyReport[];
  distributors: User[];
  orders: Order[];
  onRefresh: () => void;
}

export const ReportManager: React.FC<ReportManagerProps> = ({ reports, distributors, orders, onRefresh }) => {
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [filterGroup, setFilterGroup] = useState<string>('ALL');

  // --- 1. LOGIC NGÀY THÁNG (ĐÃ SỬA: Dùng Local Time để tránh lệch múi giờ) ---
  const getMondayDateString = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Tính về thứ 2
    d.setDate(diff);
    
    // Format thủ công YYYY-MM-DD theo giờ địa phương (không dùng toISOString vì sẽ bị lệch sang UTC)
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const dayOfMonth = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${dayOfMonth}`;
  };

  // Hàm hiển thị range: Thứ 2 - Chủ Nhật
  const getWeekRangeDisplay = (mondayStr: string) => {
    const monday = new Date(mondayStr);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6); // Cộng thêm 6 ngày để ra Chủ Nhật

    const format = (d: Date) => `${d.getDate()}/${d.getMonth() + 1}`;
    return `${format(monday)} - ${format(sunday)}`;
  };

  const currentWeekStart = getMondayDateString(new Date());
  const [selectedWeek, setSelectedWeek] = useState<string>(currentWeekStart);

  // Tạo danh sách các tuần có trong báo cáo + tuần hiện tại
  const availableWeeks = useMemo(() => {
    const weeks = new Set<string>();
    // Luôn thêm tuần hiện tại
    weeks.add(currentWeekStart);
    // Thêm các tuần từ dữ liệu cũ
    reports.forEach(r => {
        // Cắt chuỗi để lấy phần YYYY-MM-DD nếu dữ liệu có giờ
        const dateStr = r.weekStartDate.split('T')[0]; 
        weeks.add(dateStr);
    });
    // Sắp xếp giảm dần (mới nhất lên đầu)
    return Array.from(weeks).sort().reverse();
  }, [reports, currentWeekStart]);

  // --- 2. LỌC DỮ LIỆU ---
  
  // Lọc báo cáo theo Tuần đã chọn
  const reportsInWeek = useMemo(() => {
    return reports.filter(r => r.weekStartDate.startsWith(selectedWeek));
  }, [reports, selectedWeek]);

  // Tính toán Thống kê Group
  const groupStats = useMemo(() => {
    const stats = {
      [DistributorGroup.TaiChinh]: { revenue: 0, sold: 0, count: 0 },
      [DistributorGroup.VanPhong]: { revenue: 0, sold: 0, count: 0 },
      [DistributorGroup.SuKien]: { revenue: 0, sold: 0, count: 0 },
      [DistributorGroup.TruyenThong]: { revenue: 0, sold: 0, count: 0 },
      [DistributorGroup.HauCan]: { revenue: 0, sold: 0, count: 0 },
      [DistributorGroup.BanBep]: { revenue: 0, sold: 0, count: 0 },
    };

    reportsInWeek.forEach(r => {
      const group = r.distributorGroup || DistributorGroup.TaiChinh;
      if (stats[group]) {
        stats[group].revenue += r.totalRevenue;
        stats[group].sold += r.totalSold;
        stats[group].count += 1;
      }
    });

    return stats;
  }, [reportsInWeek]);

  // Lọc danh sách hiển thị theo Group
  const displayedReports = useMemo(() => {
    let list = reportsInWeek;
    if (filterGroup !== 'ALL') {
      list = list.filter(r => r.distributorGroup === filterGroup);
    }
    // Ưu tiên hiện Pending lên đầu
    return list.sort((a, b) => {
      if (a.status === ReportStatus.PENDING && b.status !== ReportStatus.PENDING) return -1;
      if (a.status !== ReportStatus.PENDING && b.status === ReportStatus.PENDING) return 1;
      return 0;
    });
  }, [reportsInWeek, filterGroup]);

  // Tính người chưa nộp báo cáo
  const missingReporters = useMemo(() => {
    const submittedIds = new Set(reportsInWeek.map(r => r.distributorId));
    
    return distributors.filter(u => {
      if (submittedIds.has(u.id)) return false;
      if (filterGroup !== 'ALL' && u.group !== filterGroup) return false;
      return true;
    });
  }, [distributors, reportsInWeek, filterGroup]);

  // --- XỬ LÝ API ---
  const handleUpdateStatus = async (id: string, status: ReportStatus) => {
    if (status === ReportStatus.REJECTED && !confirm('Are you sure you want to reject this report?')) {
      return;
    }
    setProcessingId(id);
    try {
      await reportService.updateStatus(id, status);
      onRefresh();
    } catch (error: any) {
      alert(error.response?.data?.msg || 'Failed to update report status');
    } finally {
      setProcessingId(null);
    }
  };

  const getGroupColor = (group?: string) => {
    switch(group) {
      case DistributorGroup.TaiChinh: return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case DistributorGroup.VanPhong: return 'bg-slate-100 text-slate-800 border-slate-200';
      case DistributorGroup.SuKien: return 'bg-purple-100 text-purple-800 border-purple-200';
      case DistributorGroup.TruyenThong: return 'bg-green-100 text-green-800 border-green-200';
      case DistributorGroup.HauCan: return 'bg-red-100 text-red-800 border-red-200';
      case DistributorGroup.BanBep: return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      
      {/* HEADER & DATE FILTER */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Weekly Performance Review</h2>
          <p className="text-sm text-slate-500">
             Reviewing reports for: <span className="font-bold text-blue-600">{getWeekRangeDisplay(selectedWeek)}</span>
          </p>
        </div>
        
        <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-lg border border-slate-200">
          <Calendar className="w-5 h-5 text-slate-500" />
          <span className="text-sm font-medium text-slate-700">Select Week:</span>
          <select 
            value={selectedWeek}
            onChange={(e) => setSelectedWeek(e.target.value)}
            className="bg-white border border-slate-300 text-slate-700 text-sm rounded focus:ring-blue-500 focus:border-blue-500 block p-2 outline-none font-medium min-w-[200px]"
          >
            {availableWeeks.map(week => (
              <option key={week} value={week}>
                {getWeekRangeDisplay(week)} {week === currentWeekStart ? '(Current)' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* GROUP STATS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[DistributorGroup.TaiChinh, DistributorGroup.VanPhong, DistributorGroup.SuKien, DistributorGroup.TruyenThong, DistributorGroup.HauCan, DistributorGroup.BanBep].map(group => {
          const isActive = filterGroup === group;
          const stat = groupStats[group];
          
          return (
            <div 
              key={group} 
              onClick={() => setFilterGroup(isActive ? 'ALL' : group)}
              className={`relative p-4 rounded-xl border cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-1 ${
                isActive ? 'ring-2 ring-offset-1 ring-blue-500 shadow-md' : 'opacity-80 hover:opacity-100'
              } ${
                group === DistributorGroup.TaiChinh ? 'bg-yellow-50 border-yellow-200' :
                group === DistributorGroup.VanPhong ? 'bg-slate-50 border-slate-200' :
                group === DistributorGroup.SuKien ? 'bg-purple-50 border-purple-200' :
                group === DistributorGroup.TruyenThong ? 'bg-green-50 border-green-200' :
                group === DistributorGroup.HauCan ? 'bg-red-50 border-red-200' :
                'bg-blue-50 border-blue-200'
              }`}
            >
              {isActive && <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>}
              
              <div className="flex justify-between items-center mb-3">
                <span className={`text-xs font-bold px-2 py-1 rounded uppercase ${
                   group === DistributorGroup.TaiChinh ? 'bg-yellow-200 text-yellow-800' :
                   group === DistributorGroup.VanPhong ? 'bg-slate-200 text-slate-800' :
                   group === DistributorGroup.SuKien ? 'bg-purple-200 text-purple-800' :
                   group === DistributorGroup.TruyenThong ? 'bg-green-200 text-green-800' :
                   group === DistributorGroup.HauCan ? 'bg-red-200 text-red-800' :
                   'bg-blue-200 text-blue-800'
                }`}>
                  {group}
                </span>
                <span className="text-xs text-slate-500 font-bold">{stat.count} Reports</span>
              </div>
              
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Revenue</p>
                  <p className="text-lg font-bold text-slate-800">${stat.revenue.toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Sold</p>
                  <p className="text-lg font-bold text-slate-800">{stat.sold}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* DANH SÁCH BÁO CÁO */}
      <div className="space-y-4 pt-2">
        <div className="flex justify-between items-center px-1">
          <h3 className="font-bold text-slate-700 flex items-center gap-2">
            <Filter className="w-4 h-4" /> 
            Submitted Reports ({displayedReports.length})
            {filterGroup !== 'ALL' && <span className="text-sm font-normal text-slate-500 ml-2 bg-slate-100 px-2 rounded-full">Filter: {filterGroup}</span>}
          </h3>
          {filterGroup !== 'ALL' && (
            <button onClick={() => setFilterGroup('ALL')} className="text-xs text-blue-600 hover:underline">Clear Filter</button>
          )}
        </div>

        {displayedReports.length === 0 && (
          <div className="text-center py-10 text-slate-400 bg-white rounded-xl border border-dashed flex flex-col items-center">
            <Calendar className="w-10 h-10 mb-2 opacity-20" />
            <p>No reports found for week <span className="font-bold">{getWeekRangeDisplay(selectedWeek)}</span>.</p>
          </div>
        )}
        
        {displayedReports.map(report => (
          <Card 
            key={report.id} 
            className={`flex flex-col gap-4 border-l-4 transition-all hover:shadow-md ${
              report.status === ReportStatus.PENDING ? 'border-l-yellow-400' : 
              report.status === ReportStatus.APPROVED ? 'border-l-green-500' : 'border-l-red-500'
            }`}
          >
            {/* Header Card */}
            <div className="flex flex-col md:flex-row justify-between md:items-start gap-4">
               <div>
                 <div className="flex items-center gap-2 mb-1">
                   <h3 className="font-bold text-lg text-slate-800">{report.distributorName || 'Unknown User'}</h3>
                   <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase border ${getGroupColor(report.distributorGroup)}`}>
                     {report.distributorGroup || 'N/A'}
                   </span>
                 </div>
                 <div className="flex items-center gap-2 text-sm text-slate-500">
                    <span className={`font-bold uppercase text-xs px-2 py-0.5 rounded ${
                      report.status === ReportStatus.PENDING ? 'bg-yellow-100 text-yellow-700' :
                      report.status === ReportStatus.APPROVED ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {report.status}
                    </span>
                    <span>• {getWeekRangeDisplay(report.weekStartDate)}</span>
                 </div>
               </div>
               
               {/* Summary Stats in Card */}
               <div className="flex gap-6 text-right bg-slate-50 p-2 rounded-lg border border-slate-100">
                 <div>
                   <p className="text-xl font-bold text-emerald-600">${report.totalRevenue.toLocaleString()}</p>
                   <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Revenue</p>
                 </div>
                 <div className="border-l border-slate-200 pl-4">
                   <p className="text-xl font-bold text-blue-600">{report.totalSold}</p>
                   <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Items Sold</p>
                 </div>
               </div>
            </div>
            
            {/* Details Table */}
            <div className="bg-white rounded-lg text-sm border border-slate-200 overflow-hidden">
               <div className="overflow-x-auto">
                 <table className="w-full text-left">
                    <thead className="bg-slate-50">
                       <tr className="text-slate-500">
                         <th className="px-4 py-2 font-medium">Product</th>
                         <th className="px-4 py-2 text-right font-medium">Recv</th>
                         <th className="px-4 py-2 text-right font-medium">Sold</th>
                         <th className="px-4 py-2 text-right font-medium">Dmg</th>
                         <th className="px-4 py-2 text-right font-medium">Rem</th>
                         <th className="px-4 py-2 text-right font-medium">Rev</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {report.details.map((d, idx) => (
                        <tr key={idx}>
                          <td className="px-4 py-2 font-medium text-slate-700">{d.productName}</td>
                          <td className="px-4 py-2 text-right text-slate-400">{d.quantityReceived}</td>
                          <td className="px-4 py-2 text-right font-bold text-slate-700">{d.quantitySold}</td>
                          <td className="px-4 py-2 text-right text-red-500">{d.quantityDamaged > 0 ? d.quantityDamaged : '-'}</td>
                          <td className="px-4 py-2 text-right text-blue-600 font-medium">{d.remainingStock}</td>
                          <td className="px-4 py-2 text-right font-medium text-emerald-600">${d.revenue.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                 </table>
               </div>
               {report.notes && (
                <div className="p-3 bg-slate-50 border-t border-slate-200 flex gap-2">
                  <span className="font-bold text-xs uppercase text-slate-500 mt-0.5">Note:</span>
                  <p className="italic text-slate-600 text-sm">"{report.notes}"</p>
                </div>
              )}
            </div>

            {report.status === ReportStatus.PENDING && (
              <div className="flex justify-end space-x-3 pt-2">
                 <button 
                    onClick={() => handleUpdateStatus(report.id, ReportStatus.REJECTED)} 
                    disabled={processingId !== null}
                    className="flex items-center px-4 py-2 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-50 text-sm font-medium"
                 >
                   {processingId === report.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <X className="w-4 h-4 mr-2"/>} 
                   Reject
                 </button>
                 <button 
                    onClick={() => handleUpdateStatus(report.id, ReportStatus.APPROVED)} 
                    disabled={processingId !== null}
                    className="flex items-center px-4 py-2 bg-green-600 text-white hover:bg-green-700 rounded-lg transition shadow-sm disabled:opacity-50 text-sm font-medium"
                 >
                   {processingId === report.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <Check className="w-4 h-4 mr-2"/>}
                   Approve & Sync
                 </button>
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* --- PHẦN NGƯỜI CHƯA BÁO CÁO --- */}
      {missingReporters.length > 0 && (
        <div className="mt-8 pt-8 border-t-2 border-slate-200">
           <h3 className="text-lg font-bold text-red-600 flex items-center mb-4">
              <AlertCircle className="w-5 h-5 mr-2" />
              Missing Reports ({missingReporters.length})
           </h3>
           <p className="text-sm text-slate-500 mb-4">
             The following distributors have not submitted a report for the week: <span className="font-bold">{getWeekRangeDisplay(selectedWeek)}</span>.
           </p>
           
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {missingReporters.map(user => (
                <div key={user.id} className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center justify-between">
                   <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-white border border-red-100 flex items-center justify-center text-red-500">
                         <UserIcon className="w-5 h-5" />
                      </div>
                      <div>
                         <p className="font-bold text-slate-800">{user.name}</p>
                         <p className="text-xs text-red-600 font-medium uppercase">{user.group} Partner</p>
                      </div>
                   </div>
                   <div className="text-right">
                      <span className="text-xs font-bold text-red-500 bg-white px-2 py-1 rounded border border-red-100">Not Submitted</span>
                   </div>
                </div>
              ))}
           </div>
        </div>
      )}
    </div>
  );
};