import React, { useState, useMemo } from 'react';
import { WeeklyReport, ReportStatus, DistributorGroup, User } from '../../types';
import { reportService } from '../../services/reportService';
import { Card } from '../../components/Card';

import { 
  Check, X, Loader2, Calendar, Filter, AlertCircle, 
  User as UserIcon, ArrowRight, Trash2, RotateCcw, Package
} from 'lucide-react';

// --- MÀU SẮC NHÓM ---
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
    if (!startDate || !endDate) return reports;
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
        const group = (r as any).distributorGroup || (r.distributorId as any).group || user?.group;
        return String(group) === filterGroup;
      });
    }
    // Sort: Pending lên đầu -> Ngày giảm dần
    return list.sort((a, b) => {
      if (a.status === ReportStatus.PENDING && b.status !== ReportStatus.PENDING) return -1;
      if (a.status !== ReportStatus.PENDING && b.status === ReportStatus.PENDING) return 1;
      return new Date(b.weekStartDate).getTime() - new Date(a.weekStartDate).getTime();
    });
  }, [filteredReportsByDate, filterGroup, distributors]);

  // --- 3. STATS ---
  const groupStats = useMemo(() => {
    const stats: Record<string, { revenue: number, sold: number, count: number }> = {};
    Object.values(DistributorGroup).forEach(g => stats[g] = { revenue: 0, sold: 0, count: 0 });

    filteredReportsByDate.forEach(r => {
      const user = distributors.find(u => u.id === r.distributorId);
      const rawGroup = (r as any).distributorGroup || (r.distributorId as any).group || user?.group;
      
      if (rawGroup && stats[rawGroup as string]) {
        if (r.status === ReportStatus.APPROVED) {
          stats[rawGroup as string].revenue += r.totalRevenue;
          stats[rawGroup as string].sold += r.totalSold;
        }
        stats[rawGroup as string].count += 1;
      }
    });
    return stats;
  }, [filteredReportsByDate, distributors]);

  // --- 4. MISSING REPORTERS LOGIC ---
  const missingReporters = useMemo(() => {
    const submittedIds = new Set(
      filteredReportsByDate
        .filter(r => r.status !== ReportStatus.REJECTED)
        .map(r => {
            const dId = r.distributorId as any;
            return typeof dId === 'object' ? String(dId._id || dId.id) : String(dId);
        })
    );

    return distributors.filter(u => {
      const userId = String(u.id || (u as any)._id);
      const hasSubmitted = submittedIds.has(userId);
      const matchesGroup = filterGroup === 'ALL' || u.group === filterGroup;
      return !hasSubmitted && matchesGroup;
    });
  }, [distributors, filteredReportsByDate, filterGroup]);

  // --- 5. HANDLERS ---
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

  const handleDeleteReport = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const confirmed = window.confirm(
        'Are you sure you want to DELETE this report?\n\nWARNING: This action cannot be undone.'
    );
    if (!confirmed) return;

    setProcessingId(id);
    try {
        await reportService.delete(id); 
        onRefresh();
    } catch (error: any) {
        alert(error.response?.data?.msg || 'Failed to delete report.');
    } finally {
        setProcessingId(null);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* 1. HEADER & FILTERS */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Report Management</h2>
          <p className="text-sm text-slate-500">Audit stock flow and sales performance.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
            {/* Group Filter */}
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

            {/* Date Range */}
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

      {/* 2. STATS CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
         {Object.values(DistributorGroup).map(group => {
            const isActive = filterGroup === group;
            const stat = groupStats[group] || { revenue: 0, sold: 0, count: 0 };
            const styleClass = GROUP_COLORS[group] || GROUP_COLORS['DEFAULT'];
            return (
              <div key={group} onClick={() => setFilterGroup(isActive ? 'ALL' : group)} className={`p-3 rounded-xl border cursor-pointer transition-all duration-200 hover:shadow-md ${isActive ? 'ring-2 ring-blue-500 ring-offset-1 shadow-md opacity-100' : 'opacity-80 hover:opacity-100'} ${styleClass}`}>
                 <div className="flex justify-between items-center mb-2">
                   <span className="font-bold text-[10px] uppercase truncate" title={group}>{group}</span>
                 </div>
                 <div className="text-lg font-bold leading-none">${stat.revenue.toLocaleString()}</div>
                 <div className="text-[10px] mt-1 opacity-70">{stat.count} Reports</div>
              </div>
            );
         })}
      </div>

      {/* --- MOVED: 3. MISSING REPORTS SECTION (GIỮA TRANG) --- */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
         {/* Header Bar - Click để đóng mở */}
         <div 
            className="p-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center cursor-pointer hover:bg-slate-100 transition" 
            onClick={() => setShowMissing(!showMissing)}
         >
            <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-500" />
                <span className="font-bold text-slate-700 text-sm">Chưa nộp báo cáo ({missingReporters.length})</span>
                <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold ml-2">Tuần: {startDate} → {endDate}</span>
            </div>
            <div className="text-xs text-blue-600 font-medium">{showMissing ? 'Thu gọn' : 'Xem danh sách'}</div>
        </div>

        {/* Content - Danh sách user */}
        {showMissing && (
            <div className="p-4 bg-white grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
               {missingReporters.length === 0 ? (
                  <p className="col-span-full text-center text-sm text-emerald-600 italic font-medium py-2">
                     Tuyệt vời! Tất cả mọi người đã nộp báo cáo.
                  </p>
               ) : (
                  missingReporters.map(u => (
                    <div key={u.id} className="p-3 bg-white border border-red-100 rounded-lg shadow-sm flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center text-red-400 border border-red-100 shrink-0">
                        <UserIcon className="w-4 h-4" />
                      </div>
                      <div className="overflow-hidden">
                        <p className="font-bold text-slate-800 text-xs truncate">{u.name}</p>
                        <p className="text-[10px] text-red-500 font-bold uppercase">{u.group}</p>
                      </div>
                    </div>
                  ))
               )}
            </div>
        )}
      </div>

      {/* 4. REPORT LIST */}
      <div className="space-y-4">
        <h3 className="font-bold text-slate-700 flex items-center gap-2">
            <Package className="w-5 h-5" /> 
            Danh sách báo cáo ({displayedReports.length})
        </h3>
        
        {displayedReports.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-300">
             <p className="text-slate-500 font-medium">Không có báo cáo nào trong khoảng thời gian này.</p>
          </div>
        ) : (
          displayedReports.map(report => {
            const reportGroup = (report as any).distributorGroup || 'DEFAULT';
            
            return (
            <Card key={report.id} className={`transition duration-200 border-l-4 ${
                report.status === ReportStatus.PENDING ? 'border-l-yellow-400' : 
                report.status === ReportStatus.APPROVED ? 'border-l-green-500' : 'border-l-red-500'
            }`}>
              
              {/* Header Info */}
              <div className="flex flex-col lg:flex-row justify-between items-start gap-4 mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-bold text-slate-800 text-lg">{report.distributorName}</h3>
                    <span className={`px-2 py-0.5 text-[10px] rounded-full font-bold uppercase border ${GROUP_COLORS[reportGroup]}`}>
                      {reportGroup}
                    </span>
                    <span className={`px-2 py-0.5 text-[10px] rounded-full font-bold uppercase border ${
                        report.status === ReportStatus.APPROVED ? 'bg-green-100 text-green-700 border-green-200' : 
                        report.status === ReportStatus.REJECTED ? 'bg-red-100 text-red-700 border-red-200' : 
                        'bg-yellow-100 text-yellow-700 border-yellow-200'
                    }`}>
                      {report.status}
                    </span>
                  </div>
                  
                  <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-600">
                    <p className="flex items-center gap-1">
                        <span className="text-slate-400">Ngày bắt đầu:</span> 
                        <span className="font-medium">{new Date(report.weekStartDate).toLocaleDateString('vi-VN')}</span>
                    </p>
                    <p className="flex items-center gap-1">
                        <span className="text-slate-400">ID:</span> 
                        <span className="font-mono text-xs bg-slate-100 px-1 rounded">#{report.id.slice(-6).toUpperCase()}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex gap-2 text-center">
                        <div className="bg-blue-50 px-3 py-1.5 rounded border border-blue-100">
                            <div className="text-[9px] text-blue-400 uppercase font-bold tracking-wider">Đã bán</div>
                            <div className="font-bold text-blue-700">{report.totalSold}</div>
                        </div>
                        <div className="bg-emerald-50 px-3 py-1.5 rounded border border-emerald-100">
                            <div className="text-[9px] text-emerald-400 uppercase font-bold tracking-wider">Doanh thu</div>
                            <div className="font-bold text-emerald-700">${report.totalRevenue.toLocaleString()}</div>
                        </div>
                    </div>
                    
                    <button 
                        onClick={(e) => handleDeleteReport(e, report.id)}
                        disabled={processingId === report.id}
                        className="p-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 rounded-lg transition ml-2"
                        title="Delete Report"
                    >
                        {processingId === report.id ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
                    </button>
                </div>
              </div>

              {/* DETAILS TABLE */}
              <div className="bg-slate-50 rounded-lg border border-slate-100 overflow-hidden mb-4">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-100 text-slate-500 font-semibold text-[10px] uppercase">
                    <tr>
                      <th className="px-3 py-2">Sản phẩm</th>
                      <th className="px-2 py-2 text-center text-slate-400">Cũ</th>
                      <th className="px-2 py-2 text-center text-blue-400">Mới</th>
                      <th className="px-2 py-2 text-center text-blue-700 font-bold bg-blue-50/50">Tổng</th>
                      <th className="px-2 py-2 text-center">Bán</th>
                      <th className="px-2 py-2 text-center text-red-500">Hỏng</th>
                      <th className="px-2 py-2 text-center font-bold text-emerald-700 bg-emerald-50/50">Tồn</th>
                      <th className="px-3 py-2 text-right">Tiền</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {report.details.map((d, i) => (
                      <tr key={i} className="hover:bg-white transition text-slate-700">
                        <td className="px-3 py-2 font-medium">{d.productName}</td>
                        <td className="px-2 py-2 text-center text-slate-400 text-xs">-</td>
                        <td className="px-2 py-2 text-center text-blue-400 text-xs">-</td>
                        <td className="px-2 py-2 text-center font-bold text-blue-700 bg-blue-50/30">{d.quantityReceived}</td>
                        <td className="px-2 py-2 text-center font-bold">{d.quantitySold}</td>
                        <td className="px-2 py-2 text-center text-red-500 text-xs">{d.quantityDamaged || '-'}</td>
                        <td className="px-2 py-2 text-center font-bold text-emerald-700 bg-emerald-50/30">{d.remainingStock}</td>
                        <td className="px-3 py-2 text-right font-medium text-emerald-600">${d.revenue.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* FOOTER */}
              <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-2 text-xs text-slate-500 italic w-full md:w-auto">
                   <AlertCircle className="w-3 h-3 text-slate-400 shrink-0" />
                   <span className="truncate max-w-xs">{report.notes ? report.notes : 'Không có ghi chú.'}</span>
                </div>

                {report.status === ReportStatus.PENDING && (
                  <div className="flex gap-2 w-full md:w-auto">
                    <button 
                      onClick={() => handleUpdateStatus(report.id, ReportStatus.REJECTED)}
                      disabled={processingId === report.id}
                      className="flex-1 px-4 py-1.5 border border-red-200 text-red-600 text-sm font-bold rounded hover:bg-red-50 transition disabled:opacity-50"
                    >Từ chối</button>
                    <button 
                      onClick={() => handleUpdateStatus(report.id, ReportStatus.APPROVED)}
                      disabled={processingId === report.id}
                      className="flex-[2] px-4 py-1.5 bg-green-600 text-white text-sm font-bold rounded hover:bg-green-700 shadow-sm transition flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {processingId === report.id ? <Loader2 className="w-3 h-3 animate-spin"/> : <Check className="w-3 h-3"/>}
                      Duyệt
                    </button>
                  </div>
                )}
                {report.status === ReportStatus.REJECTED && (
                  <div className="flex w-full md:w-auto justify-end">
                    <button 
                      onClick={() => handleUpdateStatus(report.id, ReportStatus.APPROVED)} 
                      disabled={processingId === report.id} 
                      className="flex items-center justify-center px-4 py-2 bg-blue-50 border border-blue-200 text-blue-700 text-sm font-bold rounded-lg hover:bg-blue-100 transition disabled:opacity-50"
                    >
                      {processingId === report.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4 mr-2" />}
                      Duyệt lại
                    </button>
                  </div>
                )}
              </div>
            </Card>
          )})
        )}
      </div>
    </div>
  );
};