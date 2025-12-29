import React, { useState, useMemo } from 'react';
import { Order, OrderStatus, DistributorGroup, User, Product } from '../../types';
import { orderService } from '../../services/orderService';
import { 
  CheckSquare, Square, Search, Calendar, Package, 
  BarChart3, CheckCircle2, AlertCircle, Loader2, Filter,
  Users, Layers, Warehouse, ArrowRight
} from 'lucide-react';

// --- CONFIG COLORS ---
const GROUP_COLORS: Record<string, string> = {
  [DistributorGroup.TaiChinh]: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  [DistributorGroup.VanPhong]: 'bg-blue-100 text-blue-800 border-blue-200',
  [DistributorGroup.SuKien]: 'bg-purple-100 text-purple-800 border-purple-200',
  [DistributorGroup.TruyenThong]: 'bg-green-100 text-green-800 border-green-200',
  [DistributorGroup.HauCan]: 'bg-red-100 text-red-800 border-red-200',
  [DistributorGroup.BanBep]: 'bg-orange-100 text-orange-800 border-orange-200',
  'Other': 'bg-gray-100 text-gray-800 border-gray-200'
};

interface ReceivedOrderManagerProps {
  orders: Order[];
  products: Product[];
  distributors: User[];
  onRefresh: () => void;
}

export const ReceivedOrderManager: React.FC<ReceivedOrderManagerProps> = ({ orders, products, distributors, onRefresh }) => {
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGroup, setFilterGroup] = useState<string>('ALL'); 
  const [activeTab, setActiveTab] = useState<'pending' | 'completed'>('pending');

  // --- LOGIC NGÀY THÁNG (RANGE FILTER) ---
  
  // 1. Helper format ra chuỗi YYYY-MM-DD theo giờ địa phương (tránh lỗi lệch múi giờ)
  const formatDateLocal = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // 2. Hàm lấy ngày Thứ 2 của tuần hiện tại
  const getMondayOfCurrentWeek = () => {
    const d = new Date();
    const day = d.getDay(); // 0 (CN) -> 6 (T7)
    // Nếu là Chủ Nhật (0) thì lùi 6 ngày, các ngày khác lùi (day - 1)
    const diff = day === 0 ? 6 : day - 1; 
    d.setDate(d.getDate() - diff);
    return formatDateLocal(d);
  };

  // 3. State khởi tạo: Từ Thứ 2 -> Hôm nay
  const [startDate, setStartDate] = useState<string>(getMondayOfCurrentWeek());
  const [endDate, setEndDate] = useState<string>(formatDateLocal(new Date()));

  // --- HELPER ---
  const resolveDistributorId = (order: Order): string => {
    const dist = order.distributorId as any;
    if (!dist) return '';
    return typeof dist === 'object' ? (dist.id || dist._id || '') : String(dist);
  };

  const getUserInfo = (order: Order) => {
    const realId = resolveDistributorId(order);
    return distributors.find(u => u.id === realId);
  };

  const getNormalizedGroup = (userGroup: string | undefined): string => {
    if (!userGroup) return 'Other';
    const cleanGroup = String(userGroup).trim();
    const enumValues = Object.values(DistributorGroup) as string[];
    if (enumValues.includes(cleanGroup)) return cleanGroup;
    return 'Other';
  };

  // --- DATA FILTERING (LỌC THEO KHOẢNG NGÀY ĐÃ CHỌN) ---
  const approvedOrdersInRange = useMemo(() => {
    if (!startDate || !endDate) return [];

    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0); // Đầu ngày

    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999); // Cuối ngày

    return orders.filter(o => {
        const d = new Date(o.createdAt);
        // Lọc theo ngày & chỉ lấy đơn APPROVED
        return d >= start && d <= end && o.status === OrderStatus.APPROVED;
    });
  }, [orders, startDate, endDate]);

  // --- LOGIC TÍNH KHO ---
  const inventoryMatrix = useMemo(() => {
    const stats: Record<string, any> = {};
    
    // 1. Khởi tạo từ Product List
    products.forEach(p => {
        stats[p.id] = {
            id: p.id,
            name: p.name,
            currentStock: p.stock, 
            totalApproved: 0,      
            totalReceived: 0,      
        };
    });

    // 2. Cộng dồn từ Order Approved (Trong khoảng thời gian đã lọc)
    approvedOrdersInRange.forEach(order => {
        order.items.forEach((item: any) => {
            const pid = item.productId;
            
            if (!stats[pid]) {
                stats[pid] = {
                    id: pid,
                    name: item.productName,
                    currentStock: 0, 
                    totalApproved: 0,
                    totalReceived: 0,
                };
            }

            stats[pid].totalApproved += item.quantity;

            if (order.isReceived) {
                stats[pid].totalReceived += item.quantity;
            }
        });
    });

    return stats;
  }, [approvedOrdersInRange, products]);

  // --- KPI STATS ---
  const headerStats = useMemo(() => {
    const totalOrders = approvedOrdersInRange.length;
    const receivedCount = approvedOrdersInRange.filter(o => o.isReceived).length;
    const progress = totalOrders === 0 ? 0 : Math.round((receivedCount / totalOrders) * 100);
    
    let totalPhysicalInWarehouse = 0;

    Object.values(inventoryMatrix).forEach((stat: any) => {
        const inRoom = stat.currentStock + stat.totalApproved - stat.totalReceived;
        totalPhysicalInWarehouse += (inRoom > 0 ? inRoom : 0);
    });

    return { totalOrders, receivedCount, progress, totalPhysicalInWarehouse };
  }, [approvedOrdersInRange, inventoryMatrix]);

  // --- DISPLAY LIST ---
  const filteredList = useMemo(() => {
    let list = approvedOrdersInRange;

    if (searchTerm) {
        const lower = searchTerm.toLowerCase();
        list = list.filter(o => 
            o.distributorName.toLowerCase().includes(lower) || 
            o.id.toLowerCase().includes(lower)
        );
    }

    if (filterGroup !== 'ALL') {
        list = list.filter(o => {
            const u = getUserInfo(o);
            return getNormalizedGroup(u?.group) === filterGroup;
        });
    }

    if (activeTab === 'pending') {
        return list.filter(o => !o.isReceived);
    } else {
        return list.filter(o => o.isReceived);
    }
  }, [approvedOrdersInRange, searchTerm, filterGroup, activeTab]);

  const handleToggleReceived = async (order: Order) => {
    if (processingId) return; 
    setProcessingId(order.id);
    try {
        await orderService.updateReceivedStatus(order.id, !order.isReceived);
        onRefresh();
    } catch (error: any) {
        alert('Error updating status');
    } finally {
        setProcessingId(null);
    }
  };

  return (
    <div className="space-y-6 pb-10 h-[calc(100vh-100px)] flex flex-col">
      
      {/* 1. TOP BAR */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 shrink-0">
         <div className="flex items-center gap-4 w-full xl:w-auto">
            <div className="bg-blue-600 text-white p-3 rounded-lg hidden sm:block">
                <Warehouse className="w-6 h-6" />
            </div>
            <div className="flex-1">
                <h1 className="text-xl font-bold text-slate-800">Warehouse Check-out</h1>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-500 mt-1">
                    <span className="flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500"/> {headerStats.receivedCount} Received
                    </span>
                    <span className="hidden sm:inline w-px h-3 bg-slate-300"></span>
                    <span className="flex items-center gap-1">
                        <Users className="w-4 h-4 text-blue-500"/> {headerStats.totalOrders} Orders
                    </span>
                    <span className="hidden sm:inline w-px h-3 bg-slate-300"></span>
                    <span className="font-bold text-slate-700">{headerStats.progress}% Done</span>
                </div>
            </div>
         </div>

         {/* STATS CARD & DATE PICKER */}
         <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full xl:w-auto">
            {/* Box hiển thị Total In Room */}
            <div className="flex items-center gap-3 bg-indigo-50 px-4 py-2 rounded-lg border border-indigo-100 min-w-[180px]">
                <div className="bg-white p-2 rounded-full shadow-sm text-indigo-500">
                    <Layers className="w-5 h-5" />
                </div>
                <div>
                    <p className="text-[10px] uppercase font-bold text-indigo-400">Total In Room</p>
                    <p className="text-xl font-black text-indigo-700 leading-none">
                        {headerStats.totalPhysicalInWarehouse.toLocaleString()}
                    </p>
                </div>
            </div>

            {/* DATE PICKER */}
            <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-lg border border-slate-200 grow xl:grow-0">
                <div className="flex items-center gap-2 px-2 border-r border-slate-200">
                    <Calendar className="w-4 h-4 text-slate-500" />
                    <span className="text-xs font-bold text-slate-500 uppercase">From</span>
                </div>
                <input 
                    type="date" 
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="bg-transparent text-sm font-medium text-slate-700 outline-none"
                />
                <ArrowRight className="w-3 h-3 text-slate-400" />
                <input 
                    type="date" 
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="bg-transparent text-sm font-medium text-slate-700 outline-none"
                />
            </div>
         </div>
      </div>

      {/* 2. MAIN CONTENT */}
      <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">
          
          {/* LEFT COL: CHECKLIST */}
          <div className="lg:w-5/12 flex flex-col gap-4 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 space-y-3 bg-slate-50/50">
                   <div className="flex gap-2">
                        <div className="relative flex-1">
                            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input 
                                type="text" 
                                placeholder="Search..." 
                                className="pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg w-full focus:outline-blue-500 bg-white"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="relative w-1/3 min-w-[120px]">
                            <Filter className="w-3 h-3 text-slate-500 absolute left-2 top-1/2 -translate-y-1/2 z-10" />
                            <select 
                                value={filterGroup}
                                onChange={(e) => setFilterGroup(e.target.value)}
                                className="pl-7 pr-2 py-2 text-xs font-bold border border-slate-200 rounded-lg w-full focus:outline-blue-500 bg-white appearance-none truncate"
                            >
                                <option value="ALL">All Groups</option>
                                {Object.values(DistributorGroup).map(g => (
                                    <option key={g} value={g}>{g}</option>
                                ))}
                            </select>
                        </div>
                   </div>

                   <div className="flex p-1 bg-slate-100 rounded-lg">
                        <button 
                            onClick={() => setActiveTab('pending')}
                            className={`flex-1 py-1.5 text-sm font-bold rounded-md transition-all flex items-center justify-center gap-2 ${
                                activeTab === 'pending' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                            }`}
                        >
                            <AlertCircle className={`w-4 h-4 ${activeTab === 'pending' ? 'text-yellow-500' : ''}`} />
                            Waiting
                            <span className="bg-slate-200 text-slate-600 px-1.5 rounded-full text-[10px]">
                                {approvedOrdersInRange.filter(o => !o.isReceived).length}
                            </span>
                        </button>
                        <button 
                            onClick={() => setActiveTab('completed')}
                            className={`flex-1 py-1.5 text-sm font-bold rounded-md transition-all flex items-center justify-center gap-2 ${
                                activeTab === 'completed' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                            }`}
                        >
                            <CheckSquare className={`w-4 h-4 ${activeTab === 'completed' ? 'text-emerald-500' : ''}`} />
                            Received
                        </button>
                   </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
                  {filteredList.length === 0 ? (
                      <div className="text-center py-10 opacity-50">
                          <Package className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                          <p className="text-sm">No orders found.</p>
                      </div>
                  ) : (
                      filteredList.map(order => {
                          const user = getUserInfo(order);
                          const gName = getNormalizedGroup(user?.group);
                          const gStyle = GROUP_COLORS[gName];

                          return (
                              <div 
                                key={order.id} 
                                onClick={() => handleToggleReceived(order)}
                                className={`
                                    relative bg-white p-3 rounded-lg border-l-4 shadow-sm cursor-pointer transition-all hover:shadow-md group select-none
                                    ${order.isReceived ? 'border-l-emerald-500 opacity-60 hover:opacity-100' : 'border-l-yellow-400'}
                                `}
                              >
                                  <div className="flex justify-between items-start">
                                      <div>
                                          <div className="flex items-center gap-2 mb-1">
                                              <span className="font-bold text-slate-800 text-sm">{order.distributorName}</span>
                                              <span className={`text-[10px] px-1.5 py-0.5 rounded border uppercase font-bold ${gStyle}`}>
                                                  {gName}
                                              </span>
                                          </div>
                                          <div className="text-xs text-slate-500 flex flex-col gap-0.5">
                                              <span className="font-medium text-slate-700">{order.items.length} Products</span> 
                                              <span className="truncate max-w-[200px]">
                                                  {order.items.slice(0,2).map(i => i.productName).join(', ')} 
                                                  {order.items.length > 2 && '...'}
                                              </span>
                                          </div>
                                      </div>
                                      
                                      <div className={`
                                          w-8 h-8 rounded-full flex items-center justify-center transition-colors
                                          ${order.isReceived 
                                            ? 'bg-emerald-100 text-emerald-600' 
                                            : 'bg-slate-100 text-slate-300 group-hover:bg-blue-100 group-hover:text-blue-600'}
                                      `}>
                                          {processingId === order.id ? <Loader2 className="w-5 h-5 animate-spin"/> : (
                                              order.isReceived ? <CheckCircle2 className="w-5 h-5" /> : <Square className="w-5 h-5" />
                                          )}
                                      </div>
                                  </div>
                              </div>
                          )
                      })
                  )}
              </div>
          </div>

          {/* RIGHT COL: MATRIX (SIMPLIFIED) */}
          <div className="lg:w-7/12 flex flex-col bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                  <h3 className="font-bold text-slate-700 flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-blue-600" />
                      Physical Inventory Matrix 
                  </h3>
              </div>
              
              <div className="flex-1 overflow-auto">
                  <table className="w-full text-sm text-left">
                      <thead className="bg-slate-100 text-slate-600 text-xs uppercase font-bold sticky top-0 z-20 shadow-sm">
                          <tr>
                              <th className="px-4 py-3 bg-slate-100 sticky left-0 z-20">Product</th>
                              
                              {/* Cột 1: IN ROOM */}
                              <th className="px-4 py-3 text-center bg-indigo-100 text-indigo-900 border-x border-slate-300 w-[120px]" 
                                  title="In Room = Stock + Approved - Received">
                                  In Room
                              </th>

                              <th className="px-4 py-3 text-center bg-slate-50 w-[100px]" title="Stock from DB">Stock</th>
                              <th className="px-4 py-3 text-center bg-yellow-50 text-yellow-700 border-l border-slate-200 w-[100px]" title="Approved Orders">Appr.</th>
                              <th className="px-4 py-3 text-center bg-emerald-50 text-emerald-700 border-l border-slate-200 w-[100px]" title="Received Orders">Recv.</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                          {Object.values(inventoryMatrix).map((stat: any, idx) => {
                              // CÔNG THỨC: IN ROOM = STOCK + APPROVED - RECEIVED
                              const inRoom = stat.currentStock + stat.totalApproved - stat.totalReceived;
                              
                              return (
                                  <tr key={idx} className="hover:bg-blue-50/30 transition group">
                                      {/* Name */}
                                      <td className="px-4 py-3 font-medium text-slate-700 sticky left-0 bg-white group-hover:bg-blue-50/30 border-r border-slate-100">
                                          <div className="truncate" title={stat.name}>{stat.name}</div>
                                      </td>

                                      {/* IN ROOM */}
                                      <td className={`px-4 py-3 text-center font-black text-lg border-x border-slate-200 ${
                                          inRoom > 0 ? 'text-indigo-700 bg-indigo-50' : 'text-slate-300 bg-slate-50'
                                      }`}>
                                          {inRoom}
                                      </td>

                                      {/* STOCK */}
                                      <td className="px-4 py-3 text-center text-slate-500 font-medium">
                                          {stat.currentStock}
                                      </td>

                                      {/* APPROVED */}
                                      <td className="px-4 py-3 text-center text-yellow-600 border-l border-slate-100 font-bold">
                                          {stat.totalApproved}
                                      </td>

                                      {/* RECEIVED */}
                                      <td className="px-4 py-3 text-center text-emerald-600 border-l border-slate-100 font-bold">
                                          {stat.totalReceived}
                                      </td>
                                  </tr>
                              );
                          })}
                      </tbody>
                  </table>
              </div>
          </div>

      </div>
    </div>
  );
};