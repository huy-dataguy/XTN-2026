import React, { useState, useMemo } from 'react';
import { Order, OrderStatus, DistributorGroup, User } from '../../types';
import { orderService } from '../../services/orderService';
import { Card } from '../../components/Card';
import { 
  Check, X, Loader2, Calendar, Filter, 
  ShoppingBag, UserCheck, ChevronDown, ChevronUp, Package 
} from 'lucide-react';

// --- CẤU HÌNH MÀU SẮC CHO TỪNG GROUP ---
const GROUP_COLORS: Record<string, string> = {
  [DistributorGroup.TaiChinh]: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  [DistributorGroup.VanPhong]: 'bg-blue-50 border-blue-200 text-blue-800',
  [DistributorGroup.SuKien]: 'bg-purple-50 border-purple-200 text-purple-800',
  [DistributorGroup.TruyenThong]: 'bg-green-50 border-green-200 text-green-800',
  [DistributorGroup.HauCan]: 'bg-red-50 border-red-200 text-red-800',
  [DistributorGroup.BanBep]: 'bg-orange-50 border-orange-200 text-orange-800',
  'DEFAULT': 'bg-gray-50 border-gray-200 text-gray-800'
};

interface OrderManagerProps {
  orders: Order[];
  distributors: User[];
  onRefresh: () => void;
}

export const OrderManager: React.FC<OrderManagerProps> = ({ orders, distributors, onRefresh }) => {
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [filterGroup, setFilterGroup] = useState<string>('ALL');
  const [showInactiveUsers, setShowInactiveUsers] = useState<boolean>(false);
  const [expandedOrderIds, setExpandedOrderIds] = useState<Set<string>>(new Set());

  // --- HELPER QUAN TRỌNG: LẤY ID TỪ ORDER ---
  // Fix lỗi [object Object]: Kiểm tra xem distributorId là string hay object
  const resolveDistributorId = (order: Order): string => {
    const dist = order.distributorId as any;
    if (!dist) return '';
    // Nếu là object (đã populate), lấy .id hoặc ._id
    if (typeof dist === 'object') {
        return dist.id || dist._id || '';
    }
    // Nếu là string
    return String(dist);
  };

  const getUserInfo = (order: Order) => {
    const realId = resolveDistributorId(order);
    return distributors.find(u => u.id === realId);
  };

  // --- HELPER: CHUẨN HÓA GROUP NAME ---
  const getNormalizedGroup = (userGroup: string | undefined): string | null => {
    if (!userGroup) return null;
    const cleanGroup = String(userGroup).trim();

    // Map Value -> Value
    const enumValues = Object.values(DistributorGroup) as string[];
    if (enumValues.includes(cleanGroup)) return cleanGroup;

    // Map Key -> Value
    const enumKey = cleanGroup as keyof typeof DistributorGroup;
    if (DistributorGroup[enumKey]) return DistributorGroup[enumKey];

    return null;
  };

  // --- 1. LOGIC NGÀY THÁNG ---
  const getCurrentWeekStart = () => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    return monday.toISOString().split('T')[0];
  };

  const [selectedWeek, setSelectedWeek] = useState<string>(getCurrentWeekStart());

  const availableWeeks = useMemo(() => {
    const weeks = new Set(orders.map(o => {
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

  const ordersInWeek = useMemo(() => {
    return orders.filter(o => {
        const date = new Date(o.createdAt);
        const day = date.getDay();
        const diff = date.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(date.setDate(diff)).toISOString().split('T')[0];
        return monday === selectedWeek;
    });
  }, [orders, selectedWeek]);

  // --- TÍNH TOÁN THỐNG KÊ (Đã fix logic lấy ID) ---
  const groupStats = useMemo(() => {
    const stats: Record<string, { revenue: number, count: number }> = {};
    Object.values(DistributorGroup).forEach(group => {
        stats[group] = { revenue: 0, count: 0 };
    });

    ordersInWeek.forEach(order => {
      const user = getUserInfo(order); // Dùng hàm mới
      const normalizedGroup = getNormalizedGroup(user?.group);
      
      if (normalizedGroup && stats[normalizedGroup]) {
        stats[normalizedGroup].revenue += order.totalAmount;
        stats[normalizedGroup].count += 1;
      }
    });

    return stats;
  }, [ordersInWeek, distributors]);

  // --- TÍNH TOÁN USER TÍCH CỰC (Đã fix logic lấy ID) ---
  const activityStats = useMemo(() => {
    const activeDistributorIds = new Set(ordersInWeek.map(o => resolveDistributorId(o)));
    const activeUsers = distributors.filter(u => activeDistributorIds.has(u.id));
    const inactiveUsers = distributors.filter(u => !activeDistributorIds.has(u.id));
    return { activeUsers, inactiveUsers };
  }, [ordersInWeek, distributors]);

  // --- DISPLAYED ORDERS (Logic Filter mới) ---
  const displayedOrders = useMemo(() => {
    let list = ordersInWeek;

    if (filterGroup !== 'ALL') {
      // Map chuẩn hóa Key -> Value
      const groupMap: Record<string, string> = {};
      Object.keys(DistributorGroup).forEach((key) => {
        const value = DistributorGroup[key as keyof typeof DistributorGroup];
        groupMap[key] = value;
        groupMap[value] = value;
      });

      list = list.filter(o => {
          const user = getUserInfo(o); // Dùng hàm lấy User an toàn

          if (!user || !user.group) {
             // Fallback: Nếu không tìm thấy user trong list, thử lấy group trực tiếp từ order (nếu có populate)
             const rawDist = o.distributorId as any;
             if (rawDist && rawDist.group) {
                 const normalized = groupMap[rawDist.group] || rawDist.group;
                 return String(normalized).trim() === String(filterGroup).trim();
             }
             return false;
          }

          const normalizedUserGroup = groupMap[user.group] || user.group;
          return String(normalizedUserGroup).trim() === String(filterGroup).trim();
      });
    }

    return list.sort((a, b) => {
      if (a.status === OrderStatus.PENDING && b.status !== OrderStatus.PENDING) return -1;
      if (a.status !== OrderStatus.PENDING && b.status === OrderStatus.PENDING) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [ordersInWeek, filterGroup, distributors]);

  // --- 3. ACTIONS ---
  
  const toggleOrderDetails = (orderId: string) => {
    const newSet = new Set(expandedOrderIds);
    if (newSet.has(orderId)) {
      newSet.delete(orderId);
    } else {
      newSet.add(orderId);
    }
    setExpandedOrderIds(newSet);
  };

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
      
      {/* HEADER & FILTERS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Order Management</h2>
          <p className="text-sm text-slate-500">Track orders and distributor activity.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
            {/* Filter Group Dropdown */}
            <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200">
                <Filter className="w-4 h-4 text-slate-500" />
                <select 
                    value={filterGroup}
                    onChange={(e) => setFilterGroup(e.target.value)}
                    className="bg-transparent text-slate-700 text-sm outline-none font-medium min-w-[100px]"
                >
                    <option value="ALL">All Groups</option>
                    {Object.values(DistributorGroup).map(group => (
                        <option key={group} value={group}>{group}</option>
                    ))}
                </select>
            </div>

            {/* Week Dropdown */}
            <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200">
                <Calendar className="w-4 h-4 text-slate-500" />
                <select 
                    value={selectedWeek}
                    onChange={(e) => setSelectedWeek(e.target.value)}
                    className="bg-transparent text-slate-700 text-sm outline-none font-medium"
                >
                    {availableWeeks.map(week => (
                    <option key={week} value={week}>
                        {new Date(week).toLocaleDateString('en-GB')} {week === getCurrentWeekStart() ? '(Current)' : ''}
                    </option>
                    ))}
                </select>
            </div>
        </div>
      </div>

      {/* STATS CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {Object.values(DistributorGroup).map(group => {
          const isActive = filterGroup === group;
          const stat = groupStats[group] || { revenue: 0, count: 0 };
          const styleClass = GROUP_COLORS[group] || GROUP_COLORS['DEFAULT'];

          return (
            <div 
              key={group} 
              onClick={() => setFilterGroup(isActive ? 'ALL' : group)}
              className={`p-3 rounded-xl border cursor-pointer transition-all duration-200 hover:shadow-md ${
                isActive ? 'ring-2 ring-blue-500 ring-offset-1 shadow-md opacity-100' : 'opacity-80 hover:opacity-100'
              } ${styleClass}`}
            >
               <div className="flex justify-between items-center mb-2">
                 <span className="font-bold text-[10px] uppercase truncate" title={group}>{group}</span>
               </div>
               <div className="text-lg font-bold leading-none">${stat.revenue.toLocaleString()}</div>
               <div className="text-[10px] mt-1 opacity-70">{stat.count} orders</div>
            </div>
          );
        })}
      </div>

      {/* ACTIVITY SUMMARY */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div 
            className="p-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center cursor-pointer hover:bg-slate-100 transition"
            onClick={() => setShowInactiveUsers(!showInactiveUsers)}
        >
            <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-emerald-600" />
                <span className="font-bold text-slate-700 text-sm">Participation:</span>
                <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">
                    {activityStats.activeUsers.length} / {distributors.length}
                </span>
            </div>
            <div className="text-xs text-blue-600 font-medium">
                {showInactiveUsers ? 'Hide List' : 'Show Missing Users'}
            </div>
        </div>
        {showInactiveUsers && (
            <div className="p-4 bg-white grid grid-cols-2 md:grid-cols-4 gap-2">
                {activityStats.inactiveUsers.length === 0 ? (
                    <p className="col-span-4 text-center text-sm text-emerald-600 italic">Everyone ordered!</p>
                ) : (
                    activityStats.inactiveUsers.map(u => {
                        const normalizedGroup = getNormalizedGroup(u.group);
                        return (
                            <div key={u.id} className="text-xs p-2 bg-red-50 text-red-700 rounded border border-red-100 flex items-center justify-between">
                                <span className="font-medium truncate">{u.name}</span>
                                <span className="opacity-60 text-[10px]">{normalizedGroup || 'No Group'}</span>
                            </div>
                        )
                    })
                )}
            </div>
        )}
      </div>

      {/* ORDER LIST */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-slate-700 flex items-center gap-2">
            <ShoppingBag className="w-5 h-5" /> 
            Orders List ({displayedOrders.length})
          </h3>
          {filterGroup !== 'ALL' && (
             <button onClick={() => setFilterGroup('ALL')} className="text-xs text-blue-600 hover:underline">Clear Filter ({filterGroup})</button>
          )}
        </div>

        {displayedOrders.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-300">
            <p className="text-slate-500 font-medium">No orders found.</p>
          </div>
        ) : (
          <div className="space-y-4">
             {displayedOrders.map(order => {
                const user = getUserInfo(order); // Lấy user an toàn
                const normalizedGroup = getNormalizedGroup(user?.group);
                const isExpanded = expandedOrderIds.has(order.id);

                return (
                    <Card key={order.id} className={`transition duration-200 border-l-4 ${
                        order.status === OrderStatus.PENDING ? 'border-l-yellow-400' : 
                        order.status === OrderStatus.APPROVED ? 'border-l-green-500' : 'border-l-red-500'
                    }`}>
                        
                    {/* TOP ROW: Order Info */}
                    <div className="flex flex-col md:flex-row justify-between md:items-start gap-4">
                        <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                                <span className="font-bold text-slate-800 text-lg">#{order.id.slice(-6).toUpperCase()}</span>
                                <span className={`px-2 py-0.5 text-[10px] rounded-full font-bold uppercase border ${
                                    order.status === OrderStatus.APPROVED ? 'bg-green-100 text-green-700 border-green-200' : 
                                    order.status === OrderStatus.REJECTED ? 'bg-red-100 text-red-700 border-red-200' : 
                                    'bg-yellow-100 text-yellow-700 border-yellow-200'
                                }`}>
                                    {order.status}
                                </span>
                            </div>
                            
                            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-600">
                                <p className="flex items-center gap-1">
                                    <span className="text-slate-400">By:</span> 
                                    <span className="font-medium text-slate-800">{order.distributorName}</span>
                                    {normalizedGroup && <span className="text-[10px] bg-slate-100 px-1.5 rounded text-slate-500 border border-slate-200">{normalizedGroup}</span>}
                                </p>
                                <p className="flex items-center gap-1">
                                    <span className="text-slate-400">Date:</span> 
                                    {new Date(order.createdAt).toLocaleDateString('en-GB')}
                                </p>
                            </div>
                        </div>

                        {/* TOTAL AMOUNT & ACTIONS */}
                        <div className="flex items-center gap-4">
                             <div className="text-right">
                                <div className="text-xs text-slate-400 uppercase font-semibold">Total</div>
                                <div className="font-bold text-blue-700 text-xl">${order.totalAmount.toLocaleString()}</div>
                             </div>

                             <button 
                                onClick={() => toggleOrderDetails(order.id)}
                                className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-600 transition"
                                title={isExpanded ? "Hide Details" : "Show Details"}
                             >
                                {isExpanded ? <ChevronUp className="w-5 h-5"/> : <ChevronDown className="w-5 h-5"/>}
                             </button>
                        </div>
                    </div>

                    {/* EXPANDED SECTION */}
                    {isExpanded && (
                        <div className="mt-4 pt-4 border-t border-dashed border-slate-200 animate-in fade-in slide-in-from-top-1 duration-200">
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                                <Package className="w-3 h-3"/> Order Items
                            </h4>
                            <div className="bg-slate-50 rounded-lg border border-slate-100 overflow-hidden">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-100 text-slate-500 font-semibold text-xs uppercase">
                                        <tr>
                                            <th className="px-3 py-2">Product</th>
                                            <th className="px-3 py-2 text-center">Qty</th>
                                            <th className="px-3 py-2 text-right">Price</th>
                                            <th className="px-3 py-2 text-right">Subtotal</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {order.items?.map((item: any, idx: number) => (
                                            <tr key={idx} className="text-slate-700">
                                                <td className="px-3 py-2 font-medium">{item.productName}</td>
                                                <td className="px-3 py-2 text-center">{item.quantity}</td>
                                                <td className="px-3 py-2 text-right text-slate-500">${item.price.toLocaleString()}</td>
                                                <td className="px-3 py-2 text-right font-medium">${(item.price * item.quantity).toLocaleString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* ACTION BUTTONS */}
                    {order.status === OrderStatus.PENDING && (
                        <div className="flex gap-3 mt-4 pt-3 border-t border-slate-100">
                            <button 
                                onClick={() => handleUpdateStatus(order.id, OrderStatus.APPROVED)} 
                                disabled={processingId !== null} 
                                className="flex-1 flex items-center justify-center px-4 py-2 bg-green-600 text-white text-sm font-bold rounded hover:bg-green-700 transition disabled:opacity-50"
                            >
                                {processingId === order.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
                                Approve
                            </button>
                            
                            <button 
                                onClick={() => handleUpdateStatus(order.id, OrderStatus.REJECTED)} 
                                disabled={processingId !== null}
                                className="flex-1 flex items-center justify-center px-4 py-2 bg-white border border-red-200 text-red-600 text-sm font-bold rounded hover:bg-red-50 transition disabled:opacity-50"
                            >
                                {processingId === order.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4 mr-1" />}
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