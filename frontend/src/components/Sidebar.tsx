import React from 'react';
import { User, UserRole, ReportStatus, WeeklyReport } from '../types';
import { LayoutDashboard, ShoppingCart, Package, ClipboardList, FileBarChart, History, LogOut } from 'lucide-react';

interface SidebarProps {
  user: User;
  activeTab: string;
  setActiveTab: (tab: any) => void;
  reports: WeeklyReport[]; // To show badges
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ user, activeTab, setActiveTab, reports, onLogout }) => {
  const pendingReportsCount = reports.filter(r => r.status === ReportStatus.PENDING).length;

  const NavItem = ({ id, icon: Icon, label, badge }: any) => (
    <button 
      onClick={() => setActiveTab(id)} 
      className={`flex items-center w-full p-3 rounded-lg transition mb-1 ${activeTab === id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-600 hover:bg-slate-50'}`}
    >
      <Icon className="w-5 h-5 mr-3" /> 
      <span className="flex-1 text-left">{label}</span>
      {badge && <span className="w-2 h-2 bg-red-500 rounded-full"></span>}
    </button>
  );

  return (
    <aside className="w-64 bg-white border-r border-slate-200 hidden md:flex flex-col h-screen sticky top-0">
      <div className="p-6 border-b border-slate-100">
        <h1 className="text-xl font-extrabold text-blue-700 tracking-tight">DistriFlow.</h1>
        <p className="text-xs text-slate-400 mt-1">{user.role === UserRole.ADMIN ? 'Admin Console' : 'Distributor Portal'}</p>
      </div>
      
      <nav className="flex-1 p-4 overflow-y-auto">
        {user.role === UserRole.ADMIN ? (
          <>
            <NavItem id="dashboard" icon={LayoutDashboard} label="Dashboard" />
            <NavItem id="products" icon={Package} label="Products" />
            <NavItem id="orders" icon={ShoppingCart} label="Orders" />
            <NavItem id="reports" icon={ClipboardList} label="Approve Reports" badge={pendingReportsCount > 0} />
          </>
        ) : (
          <>
            <NavItem id="dashboard" icon={LayoutDashboard} label="Dashboard" />
            <NavItem id="order" icon={ShoppingCart} label="Place Order" />
            <NavItem id="report" icon={FileBarChart} label="Weekly Report" />
            <NavItem id="history" icon={History} label="History" />
          </>
        )}
      </nav>

      <div className="p-4 border-t border-slate-100">
        <button onClick={onLogout} className="flex items-center w-full text-slate-500 hover:text-red-600 text-sm font-medium transition p-2 rounded hover:bg-red-50">
          <LogOut className="w-4 h-4 mr-2" /> Sign Out
        </button>
      </div>
    </aside>
  );
};