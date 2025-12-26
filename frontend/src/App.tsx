import React, { useState, useEffect } from 'react';
import { User, UserRole, Order, Product, WeeklyReport, WeeklyReport as WeeklyReportType } from './types';
import { AuthService, ProductService, OrderService, ReportService } from './services/mockBackend';
import { Sidebar } from './components/Sidebar';
import { Login } from './pages/Login';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { ProductManager } from './pages/admin/ProductManager';
import { OrderManager } from './pages/admin/OrderManager';
import { ReportManager } from './pages/admin/ReportManager';
import { DistributorDashboard } from './pages/distributor/DistributorDashboard';
import { OrderPage } from './pages/distributor/OrderPage';
import { ReportPage } from './pages/distributor/ReportPage';
import { HistoryPage } from './pages/distributor/HistoryPage';
import { LogOut } from 'lucide-react';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<string>('dashboard');

  // --- SHARED DATA STATE ---
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [reports, setReports] = useState<WeeklyReport[]>([]);
  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [myReports, setMyReports] = useState<WeeklyReport[]>([]);

  // --- DISTRIBUTOR SPECIFIC STATE ---
  const [editingReportId, setEditingReportId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      refreshData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const refreshData = () => {
    setProducts(ProductService.getAll());
    setOrders(OrderService.getAll());
    setReports(ReportService.getAll());
    if (user?.role === UserRole.DISTRIBUTOR) {
      setMyOrders(OrderService.getByDistributor(user.id));
      setMyReports(ReportService.getByDistributor(user.id));
    }
  };

  const handleLogin = (username: string) => {
    const foundUser = AuthService.login(username);
    if (foundUser) {
      setUser(foundUser);
      setActiveTab('dashboard');
    } else {
      alert('User not found!');
    }
  };

  const handleLogout = () => {
    setUser(null);
    setEditingReportId(null);
  };

  const handleDistributorEditReport = (report: WeeklyReportType) => {
    setEditingReportId(report.id);
    setActiveTab('report');
  };

  const handleDistributorReportSubmit = () => {
    setEditingReportId(null);
    alert('Report submitted successfully');
    refreshData();
    setActiveTab('history');
  };

  const handleOrderSuccess = () => {
    refreshData();
    setActiveTab('history');
  }

  if (!user) return <Login onLogin={handleLogin} />;

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <Sidebar 
        user={user} 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        reports={reports}
        onLogout={handleLogout}
      />

      <main className="flex-1 overflow-y-auto h-screen flex flex-col">
        {/* Mobile Header */}
        <header className="bg-white border-b border-slate-200 p-4 md:hidden flex justify-between items-center sticky top-0 z-10">
           <h1 className="font-bold text-blue-700">DistriFlow</h1>
           <button onClick={handleLogout}><LogOut className="w-5 h-5" /></button>
        </header>

        <div className="p-6 max-w-7xl mx-auto w-full">
          {user.role === UserRole.ADMIN ? (
             <>
               {activeTab === 'dashboard' && <AdminDashboard reports={reports} orders={orders} products={products} />}
               {activeTab === 'products' && <ProductManager products={products} onRefresh={refreshData} />}
               {activeTab === 'orders' && <OrderManager orders={orders} onRefresh={refreshData} />}
               {activeTab === 'reports' && <ReportManager reports={reports} onRefresh={refreshData} />}
             </>
          ) : (
             <>
               {activeTab === 'dashboard' && (
                 <DistributorDashboard 
                    myOrders={myOrders} 
                    myReports={myReports} 
                    onNavigate={(tab) => setActiveTab(tab)} 
                 />
               )}
               {activeTab === 'order' && (
                 <OrderPage 
                    user={user} 
                    products={products} 
                    onOrderSuccess={handleOrderSuccess} 
                 />
               )}
               {activeTab === 'report' && (
                 <ReportPage 
                    user={user} 
                    products={products} 
                    myReports={myReports} 
                    myOrders={myOrders} 
                    editReportId={editingReportId}
                    onReportSubmit={handleDistributorReportSubmit}
                 />
               )}
               {activeTab === 'history' && (
                 <HistoryPage 
                    myReports={myReports} 
                    myOrders={myOrders} 
                    onEditReport={handleDistributorEditReport} 
                 />
               )}
             </>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;