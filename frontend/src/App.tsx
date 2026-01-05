import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { User, UserRole, Order, Product, WeeklyReport, WeeklyReport as WeeklyReportType } from './types';

// --- SERVICES ---
import { productService } from './services/productService';
import { orderService } from './services/orderService';
import { reportService } from './services/reportService';
import { userService } from './services/userService'; 

// --- COMPONENTS & PAGES ---
import { Sidebar } from './components/Sidebar';
import { Login } from './pages/Login';
import { Register } from './pages/Register';

// Admin Pages
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { ProductManager } from './pages/admin/ProductManager';
import { OrderManager } from './pages/admin/OrderManager';
import { ReportManager } from './pages/admin/ReportManager';
import { UserManager } from './pages/admin/UserManager';
import { ReceivedOrderManager } from './pages/admin/ReceivedOrderManager';
import KanbanPage from './pages/admin/KanbanPage';

// 👇 [MỚI] Import trang Sao kê (Lưu ý đường dẫn file bạn tạo)
import StatementPage from './pages/admin/StatementPage'; 

// Distributor Pages
import { DistributorDashboard } from './pages/distributor/DistributorDashboard';
import { OrderPage } from './pages/distributor/OrderPage';
import { ReportPage } from './pages/distributor/ReportPage';
import { HistoryPage } from './pages/distributor/HistoryPage';

import { LogOut, Loader2 } from 'lucide-react';

// --- MAIN LAYOUT (PROTECTED) ---
const MainLayout = ({ user, logout }: { user: User, logout: () => void }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [reports, setReports] = useState<WeeklyReport[]>([]);
  const [distributors, setDistributors] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // State chỉnh sửa cho distributor
  const [editingReportId, setEditingReportId] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const requests = [
        productService.getAll(),
        orderService.getAll(),
        reportService.getAll(),
        user.role === UserRole.ADMIN ? userService.getDistributors() : Promise.resolve({ data: [] } as any)
      ];

      const [productsRes, ordersRes, reportsRes, usersRes] = await Promise.all(requests);
      setProducts(productsRes.data);
      setOrders(ordersRes.data);
      setReports(reportsRes.data);
      setDistributors(usersRes.data);
    } catch (error: any) {
      console.error("Failed to fetch data", error);
      if (error.response?.status === 401) {
        logout();
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // --- Handlers ---
  const handleAddUser = async (newUser: Omit<User, 'id'>) => {
    setIsLoading(true);
    try {
      await userService.create(newUser);
      await fetchData();
      alert("Thêm nhân viên thành công!");
    } catch (error: any) {
      alert(error.response?.data?.message || "Lỗi khi thêm nhân viên.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa nhân viên này?")) return;
    setIsLoading(true);
    try {
      await userService.delete(userId);
      await fetchData();
    } catch (error) {
      alert("Lỗi khi xóa nhân viên.");
    } finally {
      setIsLoading(false);
    }
  };

  const navigate = useNavigate();
  const handleDistributorEditReport = (report: WeeklyReportType) => {
    setEditingReportId(report.id);
    navigate('/report');
  };

  const handleDistributorReportSubmit = () => {
    setEditingReportId(null);
    alert('Report submitted successfully');
    fetchData(); 
    navigate('/history');
  };

  const handleOrderSuccess = () => {
    fetchData(); 
    navigate('/history');
  };

  if (isLoading && products.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
        <span className="ml-3 text-lg font-medium text-slate-600">Loading system data...</span>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <Sidebar user={user} onLogout={logout} reports={reports} />

      <main className="flex-1 overflow-y-auto h-screen flex flex-col">
        {/* Mobile Header */}
        <header className="bg-white border-b border-slate-200 p-4 md:hidden flex justify-between items-center sticky top-0 z-10">
           <h1 className="font-bold text-blue-700">XTN2026</h1>
           <button onClick={logout}><LogOut className="w-5 h-5" /></button>
        </header>

        <div className="p-6 max-w-7xl mx-auto w-full">
            <Routes>
              {/* --- ADMIN ROUTES --- */}
              {user.role === UserRole.ADMIN && (
                <>
                  <Route path="/" element={<AdminDashboard reports={reports} orders={orders} products={products} />} />
                  <Route path="/users" element={
                    <UserManager 
                      users={distributors} 
                      currentUser={user}
                      onAddUser={handleAddUser}
                      onDeleteUser={handleDeleteUser}
                    />
                  } />
                  <Route path="/products" element={<ProductManager products={products} onRefresh={fetchData} />} />
                  <Route path="/orders" element={
                    <OrderManager 
                      orders={orders} 
                      distributors={distributors} 
                      onRefresh={fetchData} 
                      currentUser={user}
                    />
                  } />                  
                  <Route path="/reports" element={<ReportManager reports={reports} distributors={distributors} orders={orders} onRefresh={fetchData} />} />
                  
                  <Route 
                    path="/received-check" 
                    element={
                      <ReceivedOrderManager 
                        orders={orders} 
                        products={products}
                        distributors={distributors} 
                        onRefresh={fetchData} 
                      />
                    } 
                  />

                  {/* 👇 [MỚI] Route cho trang Sao kê tài khoản */}
                  <Route path="/finance" element={<StatementPage />} />
                  <Route path="/tasks" element={<KanbanPage />} />

                </>
              )}

              {/* --- DISTRIBUTOR ROUTES --- */}
              {user.role === UserRole.DISTRIBUTOR && (
                <>
                  <Route path="/" element={
                    <DistributorDashboard 
                      myOrders={orders} 
                      myReports={reports} 
                      onNavigate={(path: string) => navigate(path === 'dashboard' ? '/' : `/${path}`)} 
                    />
                  } />
                  <Route path="/order" element={
                    <OrderPage 
                      user={user} 
                      products={products} 
                      onOrderSuccess={handleOrderSuccess} 
                    />
                  } />
                  <Route path="/report" element={
                    <ReportPage 
                      user={user} 
                      products={products} 
                      myReports={reports} 
                      myOrders={orders} 
                      editReportId={editingReportId}
                      onReportSubmit={handleDistributorReportSubmit}
                    />
                  } />
                  <Route path="/history" element={
                    <HistoryPage 
                      myReports={reports} 
                      myOrders={orders} 
                      onEditReport={handleDistributorEditReport} 
                    />
                  } />
                </>
              )}

              {/* Catch all */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </div>
      </main>
    </div>
  );
};

// --- MAIN APP COMPONENT ---
function App() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user_info');
    if (token && storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        console.error("Invalid user data");
        localStorage.clear();
      }
    }
  }, []);

  const handleAuthSuccess = (data: { token: string, user: any }) => {
    localStorage.setItem('token', data.token);
    localStorage.setItem('user_info', JSON.stringify(data.user));
    setUser(data.user);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user_info');
    setUser(null);
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={!user ? <Login onAuthSuccess={handleAuthSuccess} /> : <Navigate to="/" />} />
        <Route path="/register" element={!user ? <Register /> : <Navigate to="/" />} />
        <Route path="/*" element={user ? <MainLayout user={user} logout={handleLogout} /> : <Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;