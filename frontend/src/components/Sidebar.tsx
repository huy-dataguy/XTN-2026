import React from 'react';
import { User, UserRole, ReportStatus, WeeklyReport } from '../types';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  ClipboardList, 
  FileBarChart, 
  History, 
  LogOut, 
  Users, 
  UserCircle,
  CheckSquare // 1. Import icon mới
} from 'lucide-react';

interface SidebarProps {
  user: User;
  reports?: WeeklyReport[];
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ user, reports = [], onLogout }) => {
  const location = useLocation();
  const currentPath = location.pathname;

  const pendingReportsCount = reports.filter(r => r.status === ReportStatus.PENDING).length;

  const isActive = (path: string) => {
    if (path === '/' && currentPath === '/') return true;
    if (path !== '/' && currentPath.startsWith(path)) return true;
    return false;
  };

  const NavItem = ({ to, icon: Icon, label, badgeCount }: any) => {
    const active = isActive(to);
    
    return (
      <Link 
        to={to} 
        className={`group flex items-center w-full p-3 rounded-xl transition-all mb-1 ${
          active 
          ? 'bg-blue-600 text-white shadow-md shadow-blue-200' 
          : 'text-slate-600 hover:bg-blue-50 hover:text-blue-600'
        }`}
      >
        <Icon className={`w-5 h-5 mr-3 ${active ? 'text-white' : 'text-slate-400 group-hover:text-blue-600'}`} /> 
        <span className="flex-1 text-left font-medium">{label}</span>
        
        {badgeCount > 0 && (
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
            active ? 'bg-white text-blue-600' : 'bg-red-500 text-white'
          }`}>
            {badgeCount > 9 ? '9+' : badgeCount}
          </span>
        )}
      </Link>
    );
  };

  return (
    <aside className="w-64 bg-white border-r border-slate-200 hidden md:flex flex-col h-screen sticky top-0">
      {/* Logo Section */}
      <div className="p-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
             <Package className="text-white w-5 h-5" />
          </div>
          <h1 className="text-xl font-black text-slate-800 tracking-tight">XTN<span className="text-blue-600">2026</span></h1>
        </Link>
      </div>
      
      {/* Navigation */}
      <nav className="flex-1 px-4 overflow-y-auto">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 mb-2">Main Menu</p>
        
        {user.role === UserRole.ADMIN ? (
          <>
            <NavItem to="/" icon={LayoutDashboard} label="Dashboard" />
            <NavItem to="/users" icon={Users} label="Accounts" />
            <NavItem to="/products" icon={Package} label="Products" />
            <NavItem to="/orders" icon={ShoppingCart} label="Orders" />
            
            {/* 👇 2. Thêm mục Check Received vào đây */}
            <NavItem to="/received-check" icon={CheckSquare} label="Check Received" />
            
            <NavItem to="/reports" icon={ClipboardList} label="Approve Reports" badgeCount={pendingReportsCount} />
          </>
        ) : (
          <>
            <NavItem to="/" icon={LayoutDashboard} label="Dashboard" />
            <NavItem to="/order" icon={ShoppingCart} label="Place Order" />
            <NavItem to="/report" icon={FileBarChart} label="Weekly Report" />
            <NavItem to="/history" icon={History} label="History Log" />
          </>
        )}
      </nav>

      {/* User Info & Footer */}
      <div className="p-4 mt-auto border-t border-slate-100">
        <div className="flex items-center gap-3 p-2 mb-4 bg-slate-50 rounded-xl">
           <div className="bg-blue-100 p-2 rounded-lg">
              <UserCircle className="w-5 h-5 text-blue-600" />
           </div>
           <div className="flex-1 overflow-hidden">
              <p className="text-sm font-bold text-slate-800 truncate">{user.name}</p>
              <p className="text-[10px] text-slate-500 font-medium uppercase tracking-tighter">
                {user.role} {user.group ? `• ${user.group}` : ''}
              </p>
           </div>
        </div>

        <button 
          onClick={onLogout} 
          className="flex items-center w-full text-slate-500 hover:text-red-600 text-sm font-bold transition p-3 rounded-xl hover:bg-red-50"
        >
          <LogOut className="w-4 h-4 mr-3" /> Sign Out
        </button>
      </div>
    </aside>
  );
};