import React, { useState, useMemo } from 'react';
import { Order, OrderStatus, DistributorGroup, User } from '../../types';
import { orderService } from '../../services/orderService';
import { Card } from '../../components/Card';
import { Check, X, Loader2, Calendar, Filter, DollarSign, ShoppingBag, UserX, UserCheck } from 'lucide-react';

interface OrderManagerProps {
  orders: Order[];
  distributors: User[]; // <--- Cần thêm prop này để biết user thuộc group nào và ai chưa order
  onRefresh: () => void;
}

export const OrderManager: React.FC<OrderManagerProps> = ({ orders, distributors, onRefresh }) => {
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [filterGroup, setFilterGroup] = useState<string>('ALL');
  const [showInactiveUsers, setShowInactiveUsers] = useState<boolean>(false);

  // --- 1. LOGIC NGÀY THÁNG (Tương tự ReportManager) ---
  const getCurrentWeekStart = () => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    return monday.toISOString().split('T')[0];
  };

  const [selectedWeek, setSelectedWeek] = useState<string>(getCurrentWeekStart());

  // Tạo danh sách các tuần có đơn hàng
  const availableWeeks = useMemo(() => {
    const weeks = new Set(orders.map(o => {
        // Giả sử createdAt là ISO string, lấy phần ngày để tính tuần
        // Hoặc đơn giản là lấy ngày tạo đơn nếu bạn muốn filter theo ngày
        // Ở đây mình giữ logic theo tuần giống Report cho đồng bộ
        const date = new Date(o.createdAt);
        const day = date.getDay();
        const diff = date.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(date.setDate(diff));
        return monday.toISOString().split('T')[0];
    }));
    weeks.add(getCurrentWeekStart());
    return Array.from(weeks).sort().reverse();
  }, [orders]);

  // --- 2. XỬ LÝ DỮ LIỆU ---

  // Lọc đơn hàng trong tuần được chọn
  const ordersInWeek = useMemo(() => {
    // Logic so sánh ngày đơn hàng với tuần đã chọn
    // Lưu ý: Cần điều chỉnh logic so sánh ngày tùy thuộc vào format createdAt của bạn
    return orders.filter(o => {
        const date = new Date(o.createdAt);
        const day = date.getDay();
        const diff = date.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(date.setDate(diff)).toISOString().split('T')[0];
        return monday === selectedWeek;
    });
  }, [orders, selectedWeek]);

  // Helper: Lấy User từ ID (để biết Group nếu trong Order không có)
  const getUserInfo = (distributorId: string) => {
      return distributors.find(u => u.id === distributorId);
  };

  // Tính toán Thống kê theo Group
  const groupStats = useMemo(() => {
    const stats = {
      [DistributorGroup.TaiChinh]: { revenue: 0, count: 0 },
      [DistributorGroup.VanPhong]: { revenue: 0, count: 0 },
      [DistributorGroup.SuKien]: { revenue: 0, count: 0 },
      [DistributorGroup.TruyenThong]: { revenue: 0, count: 0 },
      [DistributorGroup.HauCan]: { revenue: 0, count: 0 },
      [DistributorGroup.BanBep]: { revenue: 0, count: 0 },
    };

    ordersInWeek.forEach(order => {
      const user = getUserInfo(order.distributorId);
      const group = user?.group || DistributorGroup.TaiChinh;
      
      if (stats[group]) {
        stats[group].revenue += order.totalAmount;
        stats[group].count += 1;
      }
    });

    return stats;
  }, [ordersInWeek, distributors]);

  // Tính toán ai ĐÃ Order và ai CHƯA Order
  const activityStats = useMemo(() => {
    const activeDistributorIds = new Set(ordersInWeek.map(o => o.distributorId));
    
    const activeUsers = distributors.filter(u => activeDistributorIds.has(u.id));
    const inactiveUsers = distributors.filter(u => !activeDistributorIds.has(u.id));

    return { activeUsers, inactiveUsers };
  }, [ordersInWeek, distributors]);

  // Lọc danh sách hiển thị cuối cùng
  const displayedOrders = useMemo(() => {
    let list = ordersInWeek;
    
    // Filter theo Group
    if (filterGroup !== 'ALL') {
      list = list.filter(o => {
          const user = getUserInfo(o.distributorId);
          return user?.group === filterGroup;
      });
    }

    // Sort: Pending lên đầu
    return list.sort((a, b) => {
      if (a.status === OrderStatus.PENDING && b.status !== OrderStatus.PENDING) return -1;
      if (a.status !== OrderStatus.PENDING && b.status === OrderStatus.PENDING) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [ordersInWeek, filterGroup, distributors]);

  // --- 3. ACTIONS ---
  const handleUpdateStatus = async (id: string, newStatus: OrderStatus) => {
    if (!confirm(`Are you sure you want to ${newStatus} this order?`)) return;
    setProcessingId(id);
    try {
      await orderService.updateStatus(id, newStatus);
      onRefresh();
    } catch (error: any) {
      alert(error.response?.data?.msg || 'Failed to update order status');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* HEADER & DATE FILTER */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Order Management</h2>
          <p className="text-sm text-slate-500">Track orders and distributor activity.</p>
        </div>
        
        <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-lg border border-slate-200">
          <Calendar className="w-5 h-5 text-slate-500" />
          <span className="text-sm font-medium text-slate-700">Week:</span>
          <select 
            value={selectedWeek}
            onChange={(e) => setSelectedWeek(e.target.value)}
            className="bg-white border border-slate-300 text-slate-700 text-sm rounded focus:ring-blue-500 focus:border-blue-500 block p-2 outline-none font-medium"
          >
            {availableWeeks.map(week => (
              <option key={week} value={week}>
                {new Date(week).toLocaleDateString('en-GB')} {week === getCurrentWeekStart() ? '(Current)' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* GROUP STATS CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[DistributorGroup.TaiChinh, DistributorGroup.VanPhong, DistributorGroup.SuKien, DistributorGroup.TruyenThong, DistributorGroup.HauCan, DistributorGroup.BanBep].map(group => {
          const isActive = filterGroup === group;
          const stat = groupStats[group];
          const colorStyles = 
            group === DistributorGroup.TaiChinh ? 'bg-yellow-50 border-yellow-200 text-yellow-800' :
            group === DistributorGroup.VanPhong ? 'bg-slate-50 border-slate-200 text-slate-800' :
            group === DistributorGroup.SuKien ? 'bg-purple-50 border-purple-200 text-purple-800' :
            group === DistributorGroup.TruyenThong ? 'bg-green-50 border-green-200 text-green-800' :
            group === DistributorGroup.HauCan ? 'bg-red-50 border-red-200 text-red-800' :
            group === DistributorGroup.BanBep ? 'bg-purple-50 border-purple-200 text-purple-800' :
            
            'bg-blue-50 border-blue-200 text-blue-800';

          return (
            <div 
              key={group} 
              onClick={() => setFilterGroup(isActive ? 'ALL' : group)}
              className={`p-4 rounded-xl border cursor-pointer transition-all duration-200 hover:shadow-md ${
                isActive ? 'ring-2 ring-blue-500 ring-offset-1 shadow-md' : 'opacity-90 hover:opacity-100'
              } ${colorStyles}`}
            >
               <div className="flex justify-between items-center mb-2">
                 <span className="font-bold text-xs uppercase tracking-wider">{group} Partners</span>
                 <ShoppingBag className="w-4 h-4 opacity-50"/>
               </div>
               <div className="flex items-end justify-between">
                 <div>
                    <div className="text-2xl font-bold">${stat.revenue.toLocaleString()}</div>
                    <div className="text-[10px] uppercase opacity-70 font-semibold">Total Revenue</div>
                 </div>
                 <div className="text-right">
                    <div className="text-xl font-bold">{stat.count}</div>
                    <div className="text-[10px] uppercase opacity-70 font-semibold">Orders</div>
                 </div>
               </div>
            </div>
          );
        })}
      </div>

      {/* ACTIVITY SUMMARY (Ai đã order / Ai chưa) */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div 
            className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center cursor-pointer hover:bg-slate-100 transition"
            onClick={() => setShowInactiveUsers(!showInactiveUsers)}
        >
            <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-emerald-600" />
                <span className="font-bold text-slate-700">Participation Rate</span>
                <span className="text-sm bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">
                    {activityStats.activeUsers.length} / {distributors.length}
                </span>
            </div>
            <div className="text-sm text-blue-600 font-medium">
                {showInactiveUsers ? 'Hide Details' : 'View Who Is Missing'}
            </div>
        </div>

        {/* Khu vực hiển thị danh sách người chưa order */}
        {showInactiveUsers && (
            <div className="p-4 bg-white animate-in fade-in slide-in-from-top-2 duration-300">
                <h4 className="text-sm font-bold text-red-600 mb-3 flex items-center">
                    <UserX className="w-4 h-4 mr-1" /> Not ordered this week:
                </h4>
                {activityStats.inactiveUsers.length === 0 ? (
                    <p className="text-sm text-emerald-600 italic">Excellent! Everyone has placed an order.</p>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {activityStats.inactiveUsers.map(u => (
                            <div key={u.id} className="text-xs p-2 bg-red-50 text-red-700 rounded border border-red-100 flex items-center justify-between">
                                <span className="font-medium truncate">{u.name}</span>
                                <span className="opacity-60 text-[10px]">{u.group}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        )}
      </div>

      {/* ORDER LIST */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-slate-700 flex items-center gap-2">
            <Filter className="w-4 h-4" /> 
            Order List ({displayedOrders.length})
            {filterGroup !== 'ALL' && <span className="bg-slate-200 text-slate-700 text-xs px-2 py-1 rounded-full font-normal">Filter: {filterGroup}</span>}
          </h3>
          {filterGroup !== 'ALL' && (
            <button onClick={() => setFilterGroup('ALL')} className="text-xs text-blue-600 hover:underline">Clear Filter</button>
          )}
        </div>

        {displayedOrders.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-300">
            <ShoppingBag className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No orders found for this selection.</p>
          </div>
        ) : (
          <div className="space-y-4">
             {displayedOrders.map(order => {
                const user = getUserInfo(order.distributorId);
                return (
                    <Card key={order.id} className={`flex flex-col md:flex-row justify-between md:items-center gap-4 transition duration-200 border-l-4 ${
                        order.status === OrderStatus.PENDING ? 'border-l-yellow-400' : 
                        order.status === OrderStatus.APPROVED ? 'border-l-green-500' : 'border-l-red-500'
                    }`}>
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                            <span className="font-bold text-slate-800 text-lg">#{order.id.slice(-6).toUpperCase()}</span>
                            <span className={`px-2.5 py-0.5 text-[10px] rounded-full font-bold uppercase tracking-wide border ${
                                order.status === OrderStatus.APPROVED ? 'bg-green-100 text-green-700 border-green-200' : 
                                order.status === OrderStatus.REJECTED ? 'bg-red-100 text-red-700 border-red-200' : 
                                'bg-yellow-100 text-yellow-700 border-yellow-200'
                            }`}>
                                {order.status}
                            </span>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1 text-sm text-slate-600">
                            <p className="flex items-center">
                                <span className="text-slate-400 w-16">Distributor:</span> 
                                <span className="font-medium text-slate-800">{order.distributorName}</span>
                                {user && <span className="ml-2 text-[10px] bg-slate-100 px-1.5 rounded text-slate-500 border border-slate-200">{user.group}</span>}
                            </p>
                            <p className="flex items-center">
                                <span className="text-slate-400 w-16">Date:</span> 
                                {new Date(order.createdAt).toLocaleDateString('en-GB')} <span className="text-xs text-slate-400 ml-1">{new Date(order.createdAt).toLocaleTimeString()}</span>
                            </p>
                            <p className="flex items-center mt-1 sm:col-span-2">
                                <span className="text-slate-400 w-16">Amount:</span> 
                                <span className="font-bold text-blue-700 text-base flex items-center">
                                    <DollarSign className="w-3 h-3 mr-0.5" />{order.totalAmount.toLocaleString()}
                                </span>
                            </p>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    {order.status === OrderStatus.PENDING && (
                        <div className="flex flex-row md:flex-col gap-2 min-w-[120px]">
                            <button 
                                onClick={() => handleUpdateStatus(order.id, OrderStatus.APPROVED)} 
                                disabled={processingId !== null} 
                                className="flex-1 flex items-center justify-center px-3 py-2 bg-green-600 text-white text-xs font-bold rounded hover:bg-green-700 transition disabled:opacity-50"
                            >
                                {processingId === order.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3 mr-1" />}
                                Approve
                            </button>
                            
                            <button 
                                onClick={() => handleUpdateStatus(order.id, OrderStatus.REJECTED)} 
                                disabled={processingId !== null}
                                className="flex-1 flex items-center justify-center px-3 py-2 bg-white border border-red-200 text-red-600 text-xs font-bold rounded hover:bg-red-50 transition disabled:opacity-50"
                            >
                                {processingId === order.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3 mr-1" />}
                                Reject
                            </button>
                        </div>
                    )}
                    </Card>
                );
             })}
          </div>
        )}
      </div>
    </div>
  );
};