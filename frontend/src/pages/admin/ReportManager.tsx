import React, { useState, useMemo } from 'react';
import { WeeklyReport, ReportStatus, DistributorGroup, User, Order } from '../../types';
import { reportService } from '../../services/reportService';
import { Card } from '../../components/Card';
import { 
  Check, X, Loader2, Calendar, Filter, AlertCircle, 
  User as UserIcon, ArrowRight, BarChart3, Package, DollarSign,
  TrendingDown, History
} from 'lucide-react';

const GROUP_COLORS: Record<string, string> = {
  [DistributorGroup.TaiChinh]: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  [DistributorGroup.VanPhong]: 'bg-blue-50 border-blue-200 text-blue-800',
  [DistributorGroup.SuKien]: 'bg-purple-50 border-purple-200 text-purple-800',
  [DistributorGroup.TruyenThong]: 'bg-green-50 border-green-200 text-green-800',
  [DistributorGroup.HauCan]: 'bg-red-50 border-red-200 text-red-800',
  [DistributorGroup.BanBep]: 'bg-orange-50 border-orange-200 text-orange-800',
  'DEFAULT': 'bg-gray-50 border-gray-200 text-gray-800'
};

interface ReportManagerProps {
  reports: WeeklyReport[];
  distributors: User[];
  orders: Order[];
  onRefresh: () => void;
}

export const ReportManager: React.FC<ReportManagerProps> = ({ reports, distributors, onRefresh }) => {
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [filterGroup, setFilterGroup] = useState<string>('ALL');
  const [showMissing, setShowMissing] = useState<boolean>(false);

  // --- 1. DATE RANGE LOGIC ---
  const formatDateLocal = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getMondayOfCurrentWeek = () => {
    const d = new Date();
    const day = d.getDay();
    const diff = day === 0 ? 6 : day - 1;
    d.setDate(d.getDate() - diff);
    return formatDateLocal(d);
  };

  const [startDate, setStartDate] = useState<string>(getMondayOfCurrentWeek());
  const [endDate, setEndDate] = useState<string>(formatDateLocal(new Date()));

  // --- 2. FILTERING ---
  const filteredReportsByDate = useMemo(() => {
    const start = new Date(startDate); start.setHours(0, 0, 0, 0);
    const end = new Date(endDate); end.setHours(23, 59, 59, 999);

    return reports.filter(r => {
      const reportDate = new Date(r.weekStartDate);
      return reportDate >= start && reportDate <= end;
    });
  }, [reports, startDate, endDate]);

  const displayedReports = useMemo(() => {
    let list = filteredReportsByDate;
    if (filterGroup !== 'ALL') {
      list = list.filter(r => {
        const user = distributors.find(u => u.id === r.distributorId);
        return (r.distributorGroup || user?.group) === filterGroup;
      });
    }
    return list.sort((a, b) => {
      if (a.status === ReportStatus.PENDING && b.status !== ReportStatus.PENDING) return -1;
      return new Date(b.weekStartDate).getTime() - new Date(a.weekStartDate).getTime();
    });
  }, [filteredReportsByDate, filterGroup, distributors]);

  const groupStats = useMemo(() => {
    const stats: Record<string, { revenue: number, sold: number, count: number }> = {};
    Object.values(DistributorGroup).forEach(g => stats[g] = { revenue: 0, sold: 0, count: 0 });

    filteredReportsByDate.forEach(r => {
      const user = distributors.find(u => u.id === r.distributorId);
      const group = r.distributorGroup || user?.group;
      if (group && stats[group as string]) {
        if (r.status === ReportStatus.APPROVED) {
          stats[group as string].revenue += r.totalRevenue;
          stats[group as string].sold += r.totalSold;
        }
        stats[group as string].count += 1;
      }
    });
    return stats;
  }, [filteredReportsByDate, distributors]);

  const missingReporters = useMemo(() => {
    const submittedIds = new Set(filteredReportsByDate.map(r => r.distributorId));
    return distributors.filter(u => !submittedIds.has(u.id) && (filterGroup === 'ALL' || u.group === filterGroup));
  }, [distributors, filteredReportsByDate, filterGroup]);

  const handleUpdateStatus = async (id: string, status: ReportStatus) => {
    if (status === ReportStatus.REJECTED && !confirm('Reject this report?')) return;
    setProcessingId(id);
    try {
      await reportService.updateStatus(id, status);
      onRefresh();
    } catch (error: any) {
      alert(error.response?.data?.msg || 'Update failed');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* HEADER SECTION (Same as OrderManager) */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Distributor Reports</h2>
          <p className="text-sm text-slate-500">Audit stock flow and sales performance.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
            <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 grow xl:grow-0">
                <Filter className="w-4 h-4 text-slate-500" />
                <select 
                    value={filterGroup} onChange={(e) => setFilterGroup(e.target.value)}
                    className="bg-transparent text-slate-700 text-sm outline-none font-medium w-full"
                >
                    <option value="ALL">All Groups</option>
                    {Object.values(DistributorGroup).map(g => <option key={g} value={g}>{g}</option>)}
                </select>
            </div>

            <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-lg border border-slate-200 grow xl:grow-0">
                <div className="flex items-center gap-2 px-2 border-r border-slate-200">
                    <Calendar className="w-4 h-4 text-slate-500" />
                    <span className="text-xs font-bold text-slate-500 uppercase">Range</span>
                </div>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-transparent text-sm font-medium text-slate-700 outline-none" />
                <ArrowRight className="w-3 h-3 text-slate-400" />
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-transparent text-sm font-medium text-slate-700 outline-none" />
            </div>
        </div>
      </div>

      {/* STATS ROW */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
         {Object.values(DistributorGroup).map(group => {
            const isActive = filterGroup === group;
            const stat = groupStats[group] || { revenue: 0, sold: 0, count: 0 };
            return (
              <div key={group} onClick={() => setFilterGroup(isActive ? 'ALL' : group)} className={`p-3 rounded-xl border cursor-pointer transition-all ${isActive ? 'ring-2 ring-blue-500 shadow-md' : 'opacity-80'} ${GROUP_COLORS[group]}`}>
                 <div className="font-bold text-[10px] uppercase mb-1">{group}</div>
                 <div className="text-lg font-bold">${stat.revenue.toLocaleString()}</div>
                 <div className="text-[10px] mt-1 opacity-70">{stat.count} Reports</div>
              </div>
            );
         })}
      </div>

      {/* LIST OF REPORTS */}
      <div className="space-y-4">
        {displayedReports.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-dashed text-slate-400">No reports found.</div>
        ) : (
          displayedReports.map(report => (
            <Card key={report.id} className={`border-l-4 transition-all hover:shadow-md ${report.status === ReportStatus.PENDING ? 'border-l-yellow-400' : report.status === ReportStatus.APPROVED ? 'border-l-green-500' : 'border-l-red-500'}`}>
              
              {/* Report Header Info */}
              <div className="flex flex-col lg:flex-row justify-between gap-4 mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-bold text-slate-800 text-lg">{report.distributorName}</h3>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase border ${GROUP_COLORS[report.distributorGroup || 'DEFAULT']}`}>
                      {report.distributorGroup || 'N/A'}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${report.status === ReportStatus.APPROVED ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {report.status}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 flex items-center gap-3">
                    <span className="flex items-center gap-1 font-medium"><Calendar className="w-3 h-3"/> Tuần báo cáo: {new Date(report.weekStartDate).toLocaleDateString('en-GB')}</span>
                    <span className="text-slate-300">|</span>
                    <span className="text-blue-600 font-semibold">ID: #{report.id.slice(-6).toUpperCase()}</span>
                  </div>
                </div>

                {/* Quick Summary Badges */}
                <div className="flex gap-2">
                  <div className="bg-blue-50 px-4 py-2 rounded-lg border border-blue-100 text-center">
                    <div className="text-[10px] text-blue-400 uppercase font-bold">Bán ra</div>
                    <div className="text-lg font-bold text-blue-600">{report.totalSold}</div>
                  </div>
                  <div className="bg-emerald-50 px-4 py-2 rounded-lg border border-emerald-100 text-center">
                    <div className="text-[10px] text-emerald-400 uppercase font-bold">Doanh thu</div>
                    <div className="text-lg font-bold text-emerald-600">${report.totalRevenue.toLocaleString()}</div>
                  </div>
                </div>
              </div>

              {/* BẢNG ĐỐI SOÁT CHI TIẾT (Đồng bộ với logic User) */}
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-600 text-[10px] uppercase tracking-wider font-bold">
                    <tr>
                      <th className="px-4 py-3">Sản phẩm</th>
                      <th className="px-3 py-3 text-center bg-slate-100/50" title="Tồn kho từ báo cáo trước">Tồn cũ</th>
                      <th className="px-3 py-3 text-center bg-blue-50/50" title="Hàng nhập trong tuần này">Nhập mới</th>
                      <th className="px-3 py-3 text-center font-bold text-blue-800 bg-blue-100/50">Tổng có</th>
                      <th className="px-3 py-3 text-center text-slate-800">Đã bán</th>
                      <th className="px-3 py-3 text-center text-red-500">Lỗi/Hỏng</th>
                      <th className="px-3 py-3 text-center font-bold text-emerald-700 bg-emerald-50">Tồn cuối</th>
                      <th className="px-4 py-3 text-right">Doanh thu</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {report.details.map((d, i) => {
                      // Logic: Trong User Page, quantityReceived = Total Available (Prev + InWeek)
                      // Do database hiện tại đang lưu quantityReceived là tổng, nên ta hiển thị 
                      // cột này như là "Tổng Có" để khớp với logic User.
                      return (
                        <tr key={i} className="hover:bg-slate-50/50 transition">
                          <td className="px-4 py-3 font-bold text-slate-700">{d.productName}</td>
                          
                          {/* Các cột bổ trợ (nếu Backend có hỗ trợ tách field, nếu không ta hiển thị dấu - hoặc tính toán) */}
                          <td className="px-3 py-3 text-center text-slate-400 font-medium italic">-</td>
                          <td className="px-3 py-3 text-center text-blue-400 font-medium italic">-</td>
                          
                          {/* quantityReceived của User Page thực chất là Tổng Có */}
                          <td className="px-3 py-3 text-center font-bold text-blue-700 bg-blue-50/30">
                            {d.quantityReceived}
                          </td>
                          
                          <td className="px-3 py-3 text-center font-bold">{d.quantitySold}</td>
                          <td className="px-3 py-3 text-center text-red-500 font-medium">{d.quantityDamaged || 0}</td>
                          
                          <td className="px-3 py-3 text-center font-bold bg-emerald-50/50 text-emerald-700">
                            {d.remainingStock}
                          </td>
                          
                          <td className="px-4 py-3 text-right font-bold text-emerald-600">
                            ${d.revenue.toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Notes & Actions */}
              <div className="mt-4 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-2 text-sm text-slate-500 italic bg-slate-50 px-3 py-2 rounded-lg w-full md:w-auto">
                   <AlertCircle className="w-4 h-4 text-slate-400" />
                   <span>{report.notes ? `Ghi chú: ${report.notes}` : 'Không có ghi chú'}</span>
                </div>

                {report.status === ReportStatus.PENDING && (
                  <div className="flex gap-2 w-full md:w-auto">
                    <button 
                      onClick={() => handleUpdateStatus(report.id, ReportStatus.REJECTED)}
                      disabled={processingId === report.id}
                      className="flex-1 px-6 py-2 border border-red-200 text-red-600 font-bold rounded-lg hover:bg-red-50 transition disabled:opacity-50"
                    >Từ chối</button>
                    <button 
                      onClick={() => handleUpdateStatus(report.id, ReportStatus.APPROVED)}
                      disabled={processingId === report.id}
                      className="flex-[2] px-6 py-2 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 shadow-lg shadow-green-100 transition flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {processingId === report.id ? <Loader2 className="w-4 h-4 animate-spin"/> : <Check className="w-4 h-4"/>}
                      Duyệt & Chốt kho
                    </button>
                  </div>
                )}
              </div>
            </Card>
          ))
        )}
      </div>

      {/* MISSING REPORTS SECTION (Bottom) */}
      {missingReporters.length > 0 && (
        <div className="mt-8 border-t pt-6">
           <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-red-600 flex items-center gap-2 uppercase text-sm tracking-wider">
                 <AlertCircle className="w-5 h-5" /> Danh sách chưa nộp báo cáo ({missingReporters.length})
              </h3>
              <button onClick={() => setShowMissing(!showMissing)} className="text-xs text-blue-600 font-bold hover:underline">
                {showMissing ? 'Thu gọn' : 'Xem danh sách'}
              </button>
           </div>
           {showMissing && (
             <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {missingReporters.map(u => (
                  <div key={u.id} className="p-3 bg-red-50 border border-red-100 rounded-lg flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-red-400 shadow-sm">
                      <UserIcon className="w-4 h-4" />
                    </div>
                    <div className="overflow-hidden">
                      <p className="font-bold text-slate-800 text-xs truncate">{u.name}</p>
                      <p className="text-[10px] text-red-500 font-bold uppercase">{u.group}</p>
                    </div>
                  </div>
                ))}
             </div>
           )}
        </div>
      )}
    </div>
  );
};