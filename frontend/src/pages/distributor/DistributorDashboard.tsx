import React, { useState } from 'react';
import { Order, WeeklyReport, ReportStatus } from '../../types';
import { StatCard } from '../../components/Card';
import { Package, ShoppingCart, FileBarChart, Calendar } from 'lucide-react';

interface DistributorDashboardProps {
  myOrders: Order[];
  myReports: WeeklyReport[];
  onNavigate: (tab: 'order' | 'report') => void;
}

export const DistributorDashboard: React.FC<DistributorDashboardProps> = ({ myOrders, myReports, onNavigate }) => {
  const [selectedWeek, setSelectedWeek] = useState<string>('CURRENT');

  const weeks = Array.from(new Set([
    ...myOrders.map(o => {
        const d = new Date(o.createdAt);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); 
        return new Date(d.setDate(diff)).toISOString().split('T')[0];
    }),
    ...myReports.map(r => r.weekStartDate)
  ])).sort().reverse();

  const filteredOrders = selectedWeek === 'CURRENT' 
    ? myOrders 
    : myOrders.filter(o => {
        const d = new Date(o.createdAt);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); 
        return new Date(d.setDate(diff)).toISOString().split('T')[0] === selectedWeek;
    });

  const filteredReports = selectedWeek === 'CURRENT'
    ? myReports
    : myReports.filter(r => r.weekStartDate === selectedWeek);

  const totalOrdered = filteredOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const totalRevenue = filteredReports.filter(r => r.status === ReportStatus.APPROVED).reduce((sum, r) => sum + r.totalRevenue, 0);
  const itemsSold = filteredReports.reduce((sum, r) => sum + r.totalSold, 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
         <h2 className="text-2xl font-bold text-slate-800">Dashboard</h2>
         <div className="flex items-center gap-2">
           <Calendar className="w-4 h-4 text-slate-500" />
           <select 
             className="bg-white border border-slate-300 text-slate-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5"
             value={selectedWeek}
             onChange={(e) => setSelectedWeek(e.target.value)}
           >
             <option value="CURRENT">All Time</option>
             {weeks.map(w => (
               <option key={w} value={w}>Week of {w}</option>
             ))}
           </select>
         </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <StatCard label="Purchased Stock (Cost)" value={`$${totalOrdered.toLocaleString()}`} color="text-blue-600" />
         <StatCard label="Revenue (Approved)" value={`$${totalRevenue.toLocaleString()}`} color="text-emerald-600" />
         <StatCard label="Units Sold" value={itemsSold} icon={<Package className="w-6 h-6" />} color="text-purple-600" />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
         <button onClick={() => onNavigate('order')} className="group p-6 bg-white rounded-xl shadow-sm border hover:border-blue-400 hover:shadow-md transition text-left relative overflow-hidden">
           <div className="absolute top-0 right-0 bg-blue-50 p-4 rounded-bl-full transition group-hover:scale-110">
              <ShoppingCart className="w-8 h-8 text-blue-600"/>
           </div>
           <h3 className="text-lg font-bold mt-2">Place New Order</h3>
           <p className="text-sm text-slate-500 mt-1">Restock your inventory for the coming week.</p>
         </button>
         <button onClick={() => onNavigate('report')} className="group p-6 bg-white rounded-xl shadow-sm border hover:border-emerald-400 hover:shadow-md transition text-left relative overflow-hidden">
           <div className="absolute top-0 right-0 bg-emerald-50 p-4 rounded-bl-full transition group-hover:scale-110">
              <FileBarChart className="w-8 h-8 text-emerald-600"/>
           </div>
           <h3 className="text-lg font-bold mt-2">Weekly Report</h3>
           <p className="text-sm text-slate-500 mt-1">Submit sales data & check remaining stock.</p>
         </button>
      </div>
    </div>
  );
};