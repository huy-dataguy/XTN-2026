import React, { useState, useMemo } from 'react';
import { WeeklyReport, Order, Product, DistributorGroup, ReportStatus } from '../../types';
import { Card, StatCard } from '../../components/Card';
import { XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { TrendingUp, DollarSign, ClipboardList } from 'lucide-react';

interface AdminDashboardProps {
  reports: WeeklyReport[]; 
  orders: Order[];
  products: Product[];
}

const LINE_COLORS = ['#2563eb', '#db2777', '#ea580c', '#16a34a', '#7c3aed'];

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ reports, orders }) => {
  const [distributorFilter, setDistributorFilter] = useState<string>('ALL');

  // 1. Tính số lượng Report đang chờ xử lý (Tính trên TẤT CẢ, không quan tâm Filter Group)
  const pendingReports = reports.filter(r => r.status === ReportStatus.PENDING).length;

  // 2. Lọc danh sách "HỢP LỆ" để vẽ biểu đồ và tính doanh thu
  // Điều kiện: Phải là APPROVED + Thỏa mãn bộ lọc Group
  const validReports = useMemo(() => {
    return reports.filter(r => {
      const isApproved = r.status === ReportStatus.APPROVED; // <--- QUAN TRỌNG: Chỉ lấy đã duyệt
      const matchesGroup = distributorFilter === 'ALL' || r.distributorGroup === distributorFilter;
      return isApproved && matchesGroup;
    });
  }, [reports, distributorFilter]);

  // 3. Tính toán tổng quan dựa trên danh sách hợp lệ
  const totalRevenue = validReports.reduce((sum, r) => sum + (r.totalRevenue || 0), 0);
  const totalSold = validReports.reduce((sum, r) => sum + (r.totalSold || 0), 0);

  // --- CHUẨN BỊ DỮ LIỆU BIỂU ĐỒ ---
  const getChartData = () => {
    // Sắp xếp theo ngày tăng dần
    const sorted = [...validReports].sort((a, b) => new Date(a.weekStartDate).getTime() - new Date(b.weekStartDate).getTime());
    
    const groupedByWeek: Record<string, any> = {};

    sorted.forEach(r => {
      const dateObj = new Date(r.weekStartDate);
      const weekLabel = dateObj.toLocaleDateString('vi-VN', { month: 'short', day: 'numeric' });

      if (!groupedByWeek[weekLabel]) groupedByWeek[weekLabel] = { name: weekLabel };
      
      if (distributorFilter === 'ALL') {
        const group = r.distributorGroup || 'KHÁC';
        groupedByWeek[weekLabel][group] = (groupedByWeek[weekLabel][group] || 0) + r.totalRevenue;
      } else {
        const distName = r.distributorName || 'Không xác định';
        groupedByWeek[weekLabel][distName] = (groupedByWeek[weekLabel][distName] || 0) + r.totalRevenue;
      }
    });
    return Object.values(groupedByWeek);
  };

  const chartData = getChartData();
  
  // Xác định các đường (Lines) sẽ vẽ dựa trên dữ liệu hợp lệ
  const chartKeys = distributorFilter === 'ALL' 
    ? Object.values(DistributorGroup) // Nếu xem tất cả thì hiện các Group
    : Array.from(new Set(validReports.map(r => r.distributorName || 'Không xác định'))); // Nếu xem chi tiết 1 group thì hiện tên người

  return (
    <div className="space-y-6">
      {/* HEADER & FILTER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between bg-white p-4 rounded-lg shadow-sm border border-slate-200 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Phân Tích Tài Chính</h2>
          <p className="text-sm text-slate-500">Tổng quan hiệu suất kinh doanh (Đã duyệt)</p>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-slate-500 font-medium">Lọc theo Ban:</span>
          <select 
            className="p-2 border rounded-md text-sm bg-slate-50 min-w-[200px] outline-none focus:ring-2 focus:ring-blue-500"
            value={distributorFilter}
            onChange={(e) => setDistributorFilter(e.target.value)}
          >
            <option value="ALL">Tất cả (So sánh các Ban)</option>
            {Object.values(DistributorGroup).map(group => (
                <option key={group} value={group}>{group}</option>
            ))}
          </select>
        </div>
      </div>

      {/* STAT CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
            label="Tổng Doanh Thu (Thực tế)" 
            value={`$${totalRevenue.toLocaleString()}`} 
            icon={<DollarSign className="w-6 h-6 text-emerald-600" />} 
            color="text-emerald-600" 
        />
        <StatCard 
            label="Sản Phẩm Đã Bán" 
            value={totalSold} 
            icon={<TrendingUp className="w-6 h-6 text-blue-600" />} 
            color="text-blue-600" 
        />
        <StatCard 
            label="Báo Cáo Chờ Duyệt" 
            value={pendingReports} 
            icon={<ClipboardList className="w-6 h-6 text-amber-600" />} 
            color="text-amber-600" 
        />
      </div>

      {/* CHART */}
      {chartData.length > 0 ? (
        <Card title={distributorFilter === 'ALL' ? "Xu Hướng Doanh Thu Theo Ban" : "Chi Tiết Hiệu Suất Thành Viên"}>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} />
                  <YAxis tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} tickFormatter={(value) => `$${value/1000}k`} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: number) => [`$${value.toLocaleString()}`, 'Doanh thu']}
                  />
                  <Legend iconType="circle" />
                  {chartKeys.map((key, index) => (
                    <Line 
                      key={key} 
                      type="monotone" 
                      dataKey={key} 
                      stroke={LINE_COLORS[index % LINE_COLORS.length]} 
                      strokeWidth={3}
                      dot={{ r: 4, strokeWidth: 2, fill: '#fff' }}
                      activeDot={{ r: 8 }} 
                      connectNulls // Giúp nối các điểm lại nếu có tuần nào đó 1 nhóm không có doanh thu
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
        </Card>
      ) : (
        <div className="p-10 text-center bg-white rounded-lg border border-slate-200">
            <p className="text-slate-500">Chưa có dữ liệu đã duyệt cho bộ lọc này.</p>
        </div>
      )}
    </div>
  );
};