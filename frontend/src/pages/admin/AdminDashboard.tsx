import React, { useState } from 'react';
import { WeeklyReport, Order, Product, DistributorGroup, ReportStatus } from '../../types';
import { AuthService } from '../../services/mockBackend';
// import { analyzeBusinessPerformance } from '../../services/geminiService';
import { Card, StatCard } from '../../components/Card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { TrendingUp, DollarSign, ClipboardList, Bot, Loader2 } from 'lucide-react';

interface AdminDashboardProps {
  reports: WeeklyReport[];
  orders: Order[];
  products: Product[];
}

const LINE_COLORS = ['#2563eb', '#db2777', '#ea580c', '#16a34a', '#7c3aed'];

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ reports, orders, products }) => {
  const [distributorFilter, setDistributorFilter] = useState<string>('ALL');
  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  const [isLoadingAi, setIsLoadingAi] = useState(false);

  // const handleGenerateAI = async () => {
  //   setIsLoadingAi(true);
  //   const analysis = await analyzeBusinessPerformance(reports, orders, products);
  //   setAiAnalysis(analysis);
  //   setIsLoadingAi(false);
  // };

  const getFilteredReports = () => {
    if (distributorFilter === 'ALL') return reports;
    const users = AuthService.getAllDistributors();
    return reports.filter(r => {
      const dist = users.find(u => u.id === r.distributorId);
      return dist?.group === distributorFilter;
    });
  };

  const filteredReports = getFilteredReports();
  const totalRevenue = filteredReports.reduce((sum, r) => sum + r.totalRevenue, 0);
  const totalSold = filteredReports.reduce((sum, r) => sum + r.totalSold, 0);
  const pendingReports = reports.filter(r => r.status === ReportStatus.PENDING).length;

  const getChartData = () => {
    const sorted = [...filteredReports].sort((a, b) => new Date(a.weekStartDate).getTime() - new Date(b.weekStartDate).getTime());
    const groupedByWeek: Record<string, any> = {};
    sorted.forEach(r => {
      const week = r.weekStartDate;
      if (!groupedByWeek[week]) groupedByWeek[week] = { name: week };
      
      if (distributorFilter === 'ALL') {
        const group = r.distributorGroup || 'OTHER';
        groupedByWeek[week][group] = (groupedByWeek[week][group] || 0) + r.totalRevenue;
      } else {
        groupedByWeek[week][r.distributorName] = (groupedByWeek[week][r.distributorName] || 0) + r.totalRevenue;
      }
    });
    return Object.values(groupedByWeek);
  };

  const chartData = getChartData();
  const chartKeys = distributorFilter === 'ALL' 
    ? Object.values(DistributorGroup) 
    : Array.from(new Set(getFilteredReports().map(r => r.distributorName)));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-white p-4 rounded-lg shadow-sm border border-slate-200">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Financial Analytics</h2>
          <p className="text-sm text-slate-500">Overview of network performance</p>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-slate-500 font-medium">Filter By:</span>
          <select 
            className="p-2 border rounded-md text-sm bg-slate-50 min-w-[150px]"
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
        <StatCard label="Total Revenue" value={`$${totalRevenue.toLocaleString()}`} icon={<DollarSign className="w-6 h-6 text-emerald-600" />} color="text-emerald-600" />
        <StatCard label="Items Sold" value={totalSold} icon={<TrendingUp className="w-6 h-6 text-blue-600" />} color="text-blue-600" />
        <StatCard label="Pending Reports" value={pendingReports} icon={<ClipboardList className="w-6 h-6 text-amber-600" />} color="text-amber-600" />
      </div>

      <Card title={distributorFilter === 'ALL' ? "Revenue Trends by Group" : "Distributor Performance Breakdown"}>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{fontSize: 12}} />
                <YAxis />
                <Tooltip formatter={(value) => `$${value}`} />
                <Legend />
                {chartKeys.map((key, index) => (
                  <Line 
                    key={key} 
                    type="monotone" 
                    dataKey={key} 
                    stroke={LINE_COLORS[index % LINE_COLORS.length]} 
                    activeDot={{ r: 8 }} 
                    strokeWidth={2}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
      </Card>

      {/* <Card title="AI Business Intelligence" className="border-purple-200 bg-purple-50">
         <div className="space-y-4">
           {!aiAnalysis && (
             <div className="text-center py-8">
                <p className="text-slate-600 mb-4">Get insights on detailed product performance, inventory alerts, and strategic recommendations.</p>
                <button 
                  onClick={handleGenerateAI} 
                  disabled={isLoadingAi}
                  className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                >
                  {isLoadingAi ? <Loader2 className="w-5 h-5 mr-2 animate-spin"/> : <Bot className="w-5 h-5 mr-2" />}
                  {isLoadingAi ? 'Analyzing...' : 'Analyze Business Performance'}
                </button>
             </div>
           )}
           {aiAnalysis && (
             <div className="prose prose-sm max-w-none bg-white p-4 rounded-lg border border-purple-100">
               <div className="flex justify-between items-start mb-2">
                  <h4 className="font-semibold text-purple-800 flex items-center"><Bot className="w-4 h-4 mr-2"/> Gemini Analysis</h4>
                  <button onClick={() => setAiAnalysis('')} className="text-xs text-slate-400 hover:text-slate-600">Clear</button>
               </div>
               <div className="whitespace-pre-wrap text-slate-700 leading-relaxed">
                 {aiAnalysis}
               </div>
             </div>
           )}
         </div>
      </Card> */}
    </div>
  );
};