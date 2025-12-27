import React, { useState, useEffect } from 'react';
import { User, UserRole, Order, Product, WeeklyReport, WeeklyReport as WeeklyReportType } from './types';

// --- IMPORT SERVICES (API THẬT) ---
import { productService } from './services/productService';
import { orderService } from './services/orderService';
import { reportService } from './services/reportService';
import { userService } from './services/userService'; // Service lấy danh sách nhân viên

// --- IMPORT COMPONENTS ---
import { Sidebar } from './components/Sidebar';
import { Login } from './pages/Login';
// Admin Pages
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { ProductManager } from './pages/admin/ProductManager';
import { OrderManager } from './pages/admin/OrderManager';
import { ReportManager } from './pages/admin/ReportManager';
// Distributor Pages
import { DistributorDashboard } from './pages/distributor/DistributorDashboard';
import { OrderPage } from './pages/distributor/OrderPage';
import { ReportPage } from './pages/distributor/ReportPage';
import { HistoryPage } from './pages/distributor/HistoryPage';
import { UserManager } from './pages/admin/UserManager'; // <--- Import mới
// Icons
import { LogOut, Loader2 } from 'lucide-react';

function App() {
  // --- AUTH STATE ---
  const [user, setUser] = useState<User | null>(null);
  
  // --- UI STATE ---
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  
  // --- DATA STATE (SHARED) ---
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [reports, setReports] = useState<WeeklyReport[]>([]);
  
  // --- DATA STATE (ADMIN ONLY) ---
  // Danh sách nhân viên để Admin kiểm tra ai chưa nộp báo cáo
  const [distributors, setDistributors] = useState<User[]>([]);

  // --- DATA STATE (DISTRIBUTOR ONLY) ---
  const [editingReportId, setEditingReportId] = useState<string | null>(null);

  // 1. KHỞI TẠO: Kiểm tra LocalStorage để giữ đăng nhập khi F5
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

  // 2. FETCH DATA: Chạy mỗi khi user thay đổi (Login thành công)
  useEffect(() => {
    if (user) {
      fetchData();
    } else {
      // Reset sạch dữ liệu khi logout để bảo mật
      setProducts([]);
      setOrders([]);
      setReports([]);
      setDistributors([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

const fetchData = async () => {
    setIsLoading(true);
    try {
      // Gọi song song tất cả API cần thiết
      const requests = [
        productService.getAll(),
        orderService.getAll(),
        reportService.getAll(),
        // FIX: Thêm 'as any' để TypeScript không bắt bẻ thiếu các trường status, headers...
        user?.role === UserRole.ADMIN ? userService.getDistributors() : Promise.resolve({ data: [] } as any)
      ];

      // TypeScript sẽ hiểu result là mảng các AxiosResponse
      const [productsRes, ordersRes, reportsRes, usersRes] = await Promise.all(requests);

      setProducts(productsRes.data);
      setOrders(ordersRes.data);
      setReports(reportsRes.data);
      setDistributors(usersRes.data); // Nếu không phải Admin, usersRes.data sẽ là []

    } catch (error: any) {
      console.error("Failed to fetch data", error);
      if (error.response?.status === 401) {
        handleLogout();
      }
    } finally {
      setIsLoading(false);
    }
  };

  // --- HANDLERS ---

  const handleAuthSuccess = (data: { token: string, user: any }) => {
    const { token, user } = data;
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

  // Distributor muốn sửa báo cáo cũ (chỉ khi Status = PENDING)
  const handleDistributorEditReport = (report: WeeklyReportType) => {
    setEditingReportId(report.id);
    setActiveTab('report');
  };

  // Sau khi nộp báo cáo thành công
  const handleDistributorReportSubmit = () => {
    setEditingReportId(null);
    alert('Report submitted successfully');
    fetchData(); // Load lại dữ liệu để cập nhật bảng lịch sử
    setActiveTab('history');
  };

  // Sau khi đặt hàng thành công
  const handleOrderSuccess = () => {
    fetchData(); // Load lại để trừ tồn kho và cập nhật lịch sử đơn
    setActiveTab('history');
  }

  // --- RENDER ---

  // 1. Chưa đăng nhập -> Hiện trang Login
  if (!user) {
    return <Login onAuthSuccess={handleAuthSuccess} />;
  }

  // 2. Đã đăng nhập -> Hiện Giao diện chính
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
        {/* Mobile Header (Hiện khi màn hình nhỏ) */}
        <header className="bg-white border-b border-slate-200 p-4 md:hidden flex justify-between items-center sticky top-0 z-10">
           <h1 className="font-bold text-blue-700">DistriFlow</h1>
           <button onClick={handleLogout}><LogOut className="w-5 h-5" /></button>
        </header>

        <div className="p-6 max-w-7xl mx-auto w-full">
          {isLoading && products.length === 0 ? (
            // Màn hình Loading khi mới đăng nhập
            <div className="flex h-full items-center justify-center pt-20">
              <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
              <span className="ml-3 text-lg font-medium text-slate-600">Loading system data...</span>
            </div>
          ) : user.role === UserRole.ADMIN ? (
             // --- ADMIN VIEWS ---
             <>
               {activeTab === 'dashboard' && <AdminDashboard reports={reports} orders={orders} products={products} />}
               {activeTab === 'users' && <UserManager users={distributors} />}
               {activeTab === 'products' && <ProductManager products={products} onRefresh={fetchData} />}
               {activeTab === 'orders' && <OrderManager orders={orders} onRefresh={fetchData} />}
               {activeTab === 'reports' && (
                  <ReportManager 
                    reports={reports} 
                    distributors={distributors} 
                    orders={orders}
                    onRefresh={fetchData} 
                  />
               )}
             </>
          ) : (
             // --- DISTRIBUTOR VIEWS ---
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