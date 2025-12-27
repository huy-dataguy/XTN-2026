import React, { useState, useEffect } from 'react';
import { User, UserRole, Order, Product, WeeklyReport, WeeklyReport as WeeklyReportType } from './types';

// Các Service API
import { productService } from './services/productService';
import { orderService } from './services/orderService';
import { reportService } from './services/reportService';

// Các Component
import { Sidebar } from './components/Sidebar';
import { Login } from './pages/Login'; // Login mới
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { ProductManager } from './pages/admin/ProductManager';
import { OrderManager } from './pages/admin/OrderManager';
import { ReportManager } from './pages/admin/ReportManager';
import { DistributorDashboard } from './pages/distributor/DistributorDashboard';
import { OrderPage } from './pages/distributor/OrderPage';
import { ReportPage } from './pages/distributor/ReportPage';
import { HistoryPage } from './pages/distributor/HistoryPage';
import { LogOut, Loader2 } from 'lucide-react';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // --- DATA STATE ---
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [reports, setReports] = useState<WeeklyReport[]>([]);

  // --- DISTRIBUTOR SPECIFIC STATE ---
  const [editingReportId, setEditingReportId] = useState<string | null>(null);

  // 1. Kiểm tra đăng nhập khi Load trang (Giữ đăng nhập khi F5)
  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user_info');
    if (token && storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        console.error("Invalid user data in localstorage");
        localStorage.clear();
      }
    }
  }, []);

  // 2. Fetch dữ liệu khi có User
  useEffect(() => {
    if (user) {
      fetchData();
    } else {
      // Clear data khi logout
      setProducts([]);
      setOrders([]);
      setReports([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [productsRes, ordersRes, reportsRes] = await Promise.all([
        productService.getAll(),
        orderService.getAll(),
        reportService.getAll()
      ]);

      setProducts(productsRes.data);
      setOrders(ordersRes.data);
      setReports(reportsRes.data);

    } catch (error: any) {
      console.error("Failed to fetch data", error);
      // Nếu lỗi 401 (Unauthorized) thì tự logout
      if (error.response?.status === 401) {
        handleLogout();
      }
    } finally {
      setIsLoading(false);
    }
  };

  // --- XỬ LÝ AUTH (MỚI) ---
  const handleAuthSuccess = (data: { token: string, user: any }) => {
    const { token, user } = data;
    // Lưu vào LocalStorage
    localStorage.setItem('token', token);
    localStorage.setItem('user_info', JSON.stringify(user));
    
    setUser(user);
    setActiveTab('dashboard');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user_info');
    setUser(null);
    setEditingReportId(null);
    setActiveTab('dashboard');
  };

  // --- CÁC HÀM XỬ LÝ KHÁC ---

  const handleDistributorEditReport = (report: WeeklyReportType) => {
    setEditingReportId(report.id);
    setActiveTab('report');
  };

  const handleDistributorReportSubmit = () => {
    setEditingReportId(null);
    alert('Report submitted successfully');
    fetchData(); // Refresh data
    setActiveTab('history');
  };

  const handleOrderSuccess = () => {
    fetchData(); // Refresh data (tồn kho, đơn hàng mới)
    setActiveTab('history');
  }

  // --- RENDER ---

  // Nếu chưa đăng nhập, hiển thị Login page
  // Truyền prop onAuthSuccess thay vì onLogin cũ
  if (!user) {
    return <Login onAuthSuccess={handleAuthSuccess} />;
  }

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
          {isLoading && products.length === 0 ? (
            <div className="flex h-full items-center justify-center pt-20">
              <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
              <span className="ml-3 text-lg font-medium text-slate-600">Loading system data...</span>
            </div>
          ) : user.role === UserRole.ADMIN ? (
             <>
               {activeTab === 'dashboard' && <AdminDashboard reports={reports} orders={orders} products={products} />}
               {activeTab === 'products' && <ProductManager products={products} onRefresh={fetchData} />}
               {activeTab === 'orders' && <OrderManager orders={orders} onRefresh={fetchData} />}
               {activeTab === 'reports' && <ReportManager reports={reports} onRefresh={fetchData} />}
             </>
          ) : (
             <>
               {activeTab === 'dashboard' && (
                 <DistributorDashboard 
                    myOrders={orders} 
                    myReports={reports} 
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
                    myReports={reports} 
                    myOrders={orders} 
                    editReportId={editingReportId}
                    onReportSubmit={handleDistributorReportSubmit}
                 />
               )}
               {activeTab === 'history' && (
                 <HistoryPage 
                    myReports={reports} 
                    myOrders={orders} 
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