import React, { useState } from 'react';
import { WeeklyReport, Order, Product, DistributorGroup, ReportStatus } from '../../types';
// XÓA: import { AuthService } from '../../services/mockBackend'; -> Không cần nữa
import { Card, StatCard } from '../../components/Card';
import { XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { TrendingUp, DollarSign, ClipboardList } from 'lucide-react';

interface AdminDashboardProps {
  reports: WeeklyReport[]; // Dữ liệu này được truyền từ App.tsx (đã fetch từ API)
  orders: Order[];
  products: Product[];
}

const LINE_COLORS = ['#2563eb', '#db2777', '#ea580c', '#16a34a', '#7c3aed'];

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ reports, orders }) => {
  const [distributorFilter, setDistributorFilter] = useState<string>('ALL');
  
  // Phần AI Analysis tạm thời comment lại chờ tích hợp sau
  // const [aiAnalysis, setAiAnalysis] = useState<string>('');
  // const [isLoadingAi, setIsLoadingAi] = useState(false);

  // --- LOGIC LỌC DỮ LIỆU ---
  const getFilteredReports = () => {
    if (distributorFilter === 'ALL') return reports;
    
    // Backend đã trả về distributorGroup trong từng report, ta lọc trực tiếp
    return reports.filter(r => r.distributorGroup === distributorFilter);
  };

  const filteredReports = getFilteredReports();
  
  // Tính toán tổng quan
  const totalRevenue = filteredReports.reduce((sum, r) => sum + (r.totalRevenue || 0), 0);
  const totalSold = filteredReports.reduce((sum, r) => sum + (r.totalSold || 0), 0);
  const pendingReports = reports.filter(r => r.status === ReportStatus.PENDING).length;

  // --- CHUẨN BỊ DỮ LIỆU BIỂU ĐỒ ---
  const getChartData = () => {
    // Sắp xếp theo ngày tăng dần
    const sorted = [...filteredReports].sort((a, b) => new Date(a.weekStartDate).getTime() - new Date(b.weekStartDate).getTime());
    
    const groupedByWeek: Record<string, any> = {};

    sorted.forEach(r => {
      // Format ngày cho đẹp (VD: "Dec 25")
      const dateObj = new Date(r.weekStartDate);
      const weekLabel = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      if (!groupedByWeek[weekLabel]) groupedByWeek[weekLabel] = { name: weekLabel };
      
      if (distributorFilter === 'ALL') {
        // Nếu xem tất cả: Gom nhóm theo Group (GOLD, SILVER...)
        const group = r.distributorGroup || 'OTHER';
        groupedByWeek[weekLabel][group] = (groupedByWeek[weekLabel][group] || 0) + r.totalRevenue;
      } else {
        // Nếu đang lọc 1 Group cụ thể: Gom nhóm theo Tên người phân phối
        const distName = r.distributorName || 'Unknown';
        groupedByWeek[weekLabel][distName] = (groupedByWeek[weekLabel][distName] || 0) + r.totalRevenue;
      }
    });
    return Object.values(groupedByWeek);
  };

  const chartData = getChartData();
  
  // Xác định các đường (Lines) sẽ vẽ trên biểu đồ
  const chartKeys = distributorFilter === 'ALL' 
    ? Object.values(DistributorGroup) // Vẽ đường cho từng Group
    : Array.from(new Set(getFilteredReports().map(r => r.distributorName || 'Unknown'))); // Vẽ đường cho từng User

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between bg-white p-4 rounded-lg shadow-sm border border-slate-200 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Financial Analytics</h2>
          <p className="text-sm text-slate-500">Overview of network performance</p>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-slate-500 font-medium">Filter By:</span>
          <select 
            className="p-2 border rounded-md text-sm bg-slate-50 min-w-[200px] outline-none focus:ring-2 focus:ring-blue-500"
            value={distributorFilter}
            onChange={(e) => setDistributorFilter(e.target.value)}
          >
            <option value="ALL">All Groups (Compare Groups)</option>
            <option value={DistributorGroup.GOLD}>Gold Partners (Compare Users)</option>
            <option value={DistributorGroup.SILVER}>Silver Partners (Compare Users)</option>
            <option value={DistributorGroup.NEW}>New Partners (Compare Users)</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
            label="Total Revenue" 
            value={`$${totalRevenue.toLocaleString()}`} 
            icon={<DollarSign className="w-6 h-6 text-emerald-600" />} 
            color="text-emerald-600" 
        />
        <StatCard 
            label="Items Sold" 
            value={totalSold} 
            icon={<TrendingUp className="w-6 h-6 text-blue-600" />} 
            color="text-blue-600" 
        />
        <StatCard 
            label="Pending Reports" 
            value={pendingReports} 
            icon={<ClipboardList className="w-6 h-6 text-amber-600" />} 
            color="text-amber-600" 
        />
      </div>

      {chartData.length > 0 ? (
        <Card title={distributorFilter === 'ALL' ? "Revenue Trends by Group" : "Distributor Performance Breakdown"}>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} />
                  <YAxis tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} tickFormatter={(value) => `$${value/1000}k`} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: number) => [`$${value.toLocaleString()}`, 'Revenue']}
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
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
        </Card>
      ) : (
        <div className="p-10 text-center bg-white rounded-lg border border-slate-200">
            <p className="text-slate-500">No data available for the selected filter.</p>
        </div>
      )}

      {/* Placeholder cho phần AI Analysis */}
      {/* <Card title="AI Business Intelligence" className="border-purple-200 bg-purple-50"> ... </Card> */}
    </div>
  );
};