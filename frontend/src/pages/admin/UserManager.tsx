// src/pages/admin/UserManager.tsx

import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, Filter, Users, Shield, Award, 
  User as UserIcon, Plus, Trash2, X, Briefcase,
  LogIn, Loader2, Key, CheckCircle, Edit, RefreshCw
} from 'lucide-react';

import axiosClient from '../../api/axiosClient';
import { userService } from '../../services/userService'; 
// Giữ nguyên import type của bạn
import { User, UserRole, DistributorGroup } from '../../types';

// Component con để bọc khung (Card)
const Card: React.FC<{children: React.ReactNode}> = ({ children }) => (
  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
    {children}
  </div>
);

export const UserManager: React.FC = () => {
  // --- STATES DỮ LIỆU ---
  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // --- STATES UI & FILTER ---
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGroup, setFilterGroup] = useState<string>('ALL');
  
  // --- STATES ACTIONS ---
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // --- STATES MODALS ---
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  
  const [resetModal, setResetModal] = useState<{isOpen: boolean, userId: string | null, userName: string}>({
    isOpen: false, userId: null, userName: ''
  });

  const [editModal, setEditModal] = useState<{isOpen: boolean, data: User | null}>({
    isOpen: false, data: null
  });

  // Form thêm mới
  const [newUserForm, setNewUserForm] = useState({
    name: '', username: '', password: '', role: UserRole.DISTRIBUTOR, group: DistributorGroup.TaiChinh 
  });
  
  // Form reset password
  const [newPasswordRaw, setNewPasswordRaw] = useState('');

  // --- INITIALIZATION ---
  useEffect(() => {
    fetchUsers();
    
    // Lấy thông tin người đang đăng nhập từ LocalStorage
    const storedUser = localStorage.getItem('user_info');
    if (storedUser) {
        try {
            setCurrentUser(JSON.parse(storedUser));
        } catch (e) {
            console.error("Lỗi parse user info", e);
        }
    }
  }, []);

// Hàm lấy danh sách User từ API
  const fetchUsers = async () => {
    try {
        setIsLoadingData(true);
        const res = await userService.getDistributors();

        // Ép kiểu res.data về any để TS không báo lỗi 'never'
        const rawData = res.data as any; 

        // Kiểm tra an toàn
        const finalData = Array.isArray(rawData) ? rawData : (rawData.users || []);
        
        setUsers(finalData);
    } catch (error) {
        console.error("Failed to fetch users:", error);
    } finally {
        setIsLoadingData(false);
    }
  };

  // --- LOGIC TÍNH TOÁN ---
  const canDelete = currentUser?.role === UserRole.ADMIN || currentUser?.username === 'admin0';

  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const matchesSearch = 
        (user.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || 
        (user.username?.toLowerCase() || '').includes(searchTerm.toLowerCase());
      const matchesGroup = filterGroup === 'ALL' || user.group === filterGroup;
      return matchesSearch && matchesGroup;
    });
  }, [users, searchTerm, filterGroup]);

  // --- HANDLERS ---

  // 1. ADD USER
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserForm.name || !newUserForm.username || !newUserForm.password) return;

    try {
      setIsAdding(true);
      const payload = {
        ...newUserForm,
        group: newUserForm.role === UserRole.DISTRIBUTOR ? newUserForm.group : undefined
      };
      
      const res = await userService.create(payload);
      
      // Cập nhật state trực tiếp
      setUsers(prev => [...prev, res.data]);
      
      alert("Thêm thành công!");
      setIsAddModalOpen(false);
      // Reset form
      setNewUserForm({ name: '', username: '', password: '', role: UserRole.DISTRIBUTOR, group: DistributorGroup.TaiChinh });
    } catch (error: any) {
      alert(error.response?.data?.msg || 'Lỗi khi thêm user');
    } finally {
      setIsAdding(false);
    }
  };

  // 2. DELETE USER
  const handleDeleteClick = async (userId: string) => {
    if (!canDelete) {
      alert("Bạn không có quyền xóa người dùng.");
      return; 
    }
    if (window.confirm('Hành động này không thể hoàn tác. Bạn có chắc chắn xóa?')) {
      try {
        await userService.delete(userId);
        // Cập nhật UI
        setUsers(prev => prev.filter(u => u.id !== userId && (u as any)._id !== userId));
      } catch (error: any) {
        alert(error.response?.data?.msg || "Lỗi khi xóa user");
      }
    }
  };
  
  // 3. IMPERSONATE
  const handleImpersonate = async (targetUserId: string, targetUserName: string) => {
    if (currentUser && targetUserId === currentUser.id) return alert("Đây là tài khoản hiện tại của bạn.");
    if (!window.confirm(`⚠️ ADMIN ACTION:\nĐăng nhập vào tài khoản "${targetUserName}"?`)) return;

    setImpersonatingId(targetUserId);
    try {
      const res = await axiosClient.post(`/auth/impersonate/${targetUserId}`);
      const { token, user } = res.data;
      localStorage.setItem('token', token);
      localStorage.setItem('user_info', JSON.stringify(user));
      window.location.href = '/'; 
    } catch (error: any) {
      alert(error.response?.data?.msg || "Lỗi khi Impersonate.");
      setImpersonatingId(null);
    }
  };

  // 4. RESET PASSWORD
  const submitResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetModal.userId || !newPasswordRaw) return;
    try {
      setIsResetting(true);
      await axiosClient.put(`/users/${resetModal.userId}/reset-password`, { newPassword: newPasswordRaw });
      alert(`✅ Đã đổi mật khẩu cho ${resetModal.userName}`);
      setResetModal({ isOpen: false, userId: null, userName: '' });
    } catch (error: any) {
      alert(error.response?.data?.msg || 'Lỗi khi đổi mật khẩu');
    } finally {
      setIsResetting(false);
    }
  };

  // 5. UPDATE USER
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editModal.data) return;

    try {
        setIsEditing(true);
        const userData = editModal.data as any; 
        const realId = userData.id || userData._id; 

        if (!realId) {
          alert("Lỗi dữ liệu: Không tìm thấy ID người dùng.");
          return;
        }

        const { name, username, group, role } = editModal.data;
        
        // Gọi API
        const res = await userService.update(realId, {
            name, 
            username,
            group: role === UserRole.DISTRIBUTOR ? group : undefined
        });

        const updatedUser = res.data;

        // Cập nhật State Local
        setUsers(prev => prev.map(u => (u.id === realId || (u as any)._id === realId) ? updatedUser : u));

        alert("Cập nhật thành công!");
        setEditModal({ isOpen: false, data: null });
    } catch (error: any) {
        alert(error.response?.data?.msg || "Lỗi khi cập nhật thông tin");
    } finally {
        setIsEditing(false);
    }
  };

  // --- UI HELPERS ---
  const getRoleBadge = (role: UserRole) => {
    return role === UserRole.ADMIN 
      ? <span className="flex items-center gap-1 text-purple-700 font-bold bg-purple-50 px-2 py-1 rounded text-xs border border-purple-200"><Shield className="w-3 h-3"/> Admin</span>
      : <span className="flex items-center gap-1 text-blue-700 font-medium bg-blue-50 px-2 py-1 rounded text-xs border border-blue-200"><Briefcase className="w-3 h-3"/> Distributor</span>;
  };

  const getGroupBadge = (group?: DistributorGroup) => {
    if (!group) return <span className="text-slate-400 text-xs italic">N/A</span>;
    const styles: Record<string, string> = {
      [DistributorGroup.TaiChinh]: "bg-yellow-100 text-yellow-800 border-yellow-200",
      [DistributorGroup.VanPhong]: "bg-slate-100 text-slate-800 border-slate-200",
      [DistributorGroup.SuKien]: "bg-blue-100 text-blue-800 border-blue-200",
      [DistributorGroup.TruyenThong]: "bg-green-100 text-green-800 border-green-200",
      [DistributorGroup.HauCan]: "bg-red-100 text-red-800 border-red-200",
      [DistributorGroup.BanBep]: "bg-pink-100 text-pink-800 border-pink-200"
    };
    return (
      <span className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-bold border ${styles[group] || "bg-gray-100"} w-fit`}>
        <Award className="w-3 h-3"/> {group}
      </span>
    );
  };

  // --- RENDER ---
  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10 px-4 pt-4">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
           <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
             <Users className="w-6 h-6 text-blue-600"/> Quản Lý Tài Khoản
           </h2>
           <p className="text-slate-500 text-sm mt-1">Quản lý nhân viên, phân quyền và reset mật khẩu.</p>
        </div>
        <div className="flex gap-2">
            <button 
                onClick={fetchUsers}
                className="bg-white border border-slate-300 text-slate-600 px-3 py-2 rounded-lg hover:bg-slate-50 transition shadow-sm"
                title="Tải lại danh sách"
            >
                <RefreshCw className={`w-4 h-4 ${isLoadingData ? 'animate-spin' : ''}`} />
            </button>
            <button 
            onClick={() => setIsAddModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition shadow-md hover:shadow-lg transform active:scale-95"
            >
            <Plus className="w-4 h-4" /> Thêm Nhân Viên
            </button>
        </div>
      </div>

       {/* SEARCH & FILTER */}
       <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm sticky top-0 z-10">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Tìm kiếm theo tên hoặc username..." 
            className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 transition"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 min-w-[200px]">
          <Filter className="w-4 h-4 text-slate-500" />
          <select 
            className="w-full border border-slate-300 rounded-lg py-2.5 px-3 outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
            value={filterGroup}
            onChange={(e) => setFilterGroup(e.target.value)}
          >
            <option value="ALL">Tất cả nhóm</option>
            {Object.values(DistributorGroup).map(g => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>
      </div>

      {/* MAIN TABLE */}
      <Card>
        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 border-b uppercase text-xs font-semibold tracking-wider">
              <tr>
                <th className="px-6 py-4">Nhân viên</th>
                <th className="px-6 py-4">Vai trò</th>
                <th className="px-6 py-4">Nhóm</th>
                <th className="px-6 py-4 text-right">Công cụ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoadingData ? (
                 <tr>
                    <td colSpan={4} className="px-6 py-20 text-center">
                        <div className="flex flex-col items-center justify-center gap-3 text-slate-400">
                            <Loader2 className="w-8 h-8 animate-spin text-blue-500"/>
                            <span>Đang tải dữ liệu...</span>
                        </div>
                    </td>
                 </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                   <td colSpan={4} className="px-6 py-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                    <UserIcon className="w-10 h-10 opacity-20"/>
                    <span>Không tìm thấy user nào phù hợp.</span>
                  </td>
                </tr>
              ) : (
                filteredUsers.map(user => (
                  <tr key={user.id || (user as any)._id} className="hover:bg-slate-50 transition group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shadow-sm shrink-0
                          ${user.role === UserRole.ADMIN ? 'bg-gradient-to-br from-purple-500 to-indigo-600' : 'bg-gradient-to-br from-blue-400 to-blue-600'}`}>
                          {user.name ? user.name.charAt(0).toUpperCase() : '?'}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800">{user.name}</p>
                          <p className="text-xs text-slate-500 font-mono bg-slate-100 px-1 rounded w-fit">@{user.username}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">{getRoleBadge(user.role)}</td>
                    <td className="px-6 py-4">{getGroupBadge(user.group)}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                         <button
                            onClick={() => setEditModal({ isOpen: true, data: { ...user } })}
                            className="p-2 rounded-lg text-blue-600 hover:bg-blue-100 transition"
                            title="Sửa thông tin"
                         >
                            <Edit className="w-4 h-4" />
                         </button>

                         <button 
                            onClick={() => {
                                setResetModal({ isOpen: true, userId: user.id || (user as any)._id, userName: user.name });
                                setNewPasswordRaw('');
                            }}
                            className="p-2 rounded-lg text-orange-600 hover:bg-orange-100 transition"
                            title="Đổi mật khẩu"
                         >
                            <Key className="w-4 h-4" />
                         </button>
                         {currentUser && user.id !== currentUser.id && (
                             <button 
                                onClick={() => handleImpersonate(user.id || (user as any)._id, user.name)}
                                disabled={impersonatingId === (user.id || (user as any)._id)}
                                className="p-2 rounded-lg text-purple-600 hover:bg-purple-100 transition"
                                title="Đăng nhập (Impersonate)"
                             >
                                {impersonatingId === (user.id || (user as any)._id) ? <Loader2 className="w-4 h-4 animate-spin"/> : <LogIn className="w-4 h-4" />}
                             </button>
                         )}
                         <button 
                           onClick={() => handleDeleteClick(user.id || (user as any)._id)}
                           disabled={!canDelete}
                           className={`p-2 rounded-lg transition ${
                             canDelete 
                               ? "text-slate-400 hover:text-red-600 hover:bg-red-100" 
                               : "text-slate-200 cursor-not-allowed opacity-50"
                           }`}
                           title="Xóa tài khoản"
                         >
                           <Trash2 className="w-4 h-4" />
                         </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* --- MODALs --- */}
      {/* 1. RESET PASSWORD */}
      {resetModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
             <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-orange-50">
                <h3 className="font-bold text-orange-800 flex items-center gap-2">
                    <Key className="w-5 h-5"/> Đổi Mật Khẩu
                </h3>
                <button onClick={() => setResetModal({ ...resetModal, isOpen: false })} className="text-slate-400 hover:text-slate-600">
                    <X className="w-5 h-5" />
                </button>
                </div>
                
                <form onSubmit={submitResetPassword} className="p-6 space-y-4">
                <div className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200">
                    Đang đặt lại mật khẩu cho: <span className="font-bold text-slate-800">{resetModal.userName}</span>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Mật khẩu mới</label>
                    <input required type="text" placeholder="Nhập password mới..."
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none transition"
                    value={newPasswordRaw} onChange={e => setNewPasswordRaw(e.target.value)}
                    />
                </div>
                <div className="pt-2 flex gap-3">
                    <button type="button" onClick={() => setResetModal({ ...resetModal, isOpen: false })} 
                    className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium">Hủy</button>
                    <button type="submit" disabled={isResetting}
                    className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium shadow-sm flex justify-center items-center gap-2">
                    {isResetting ? <Loader2 className="w-4 h-4 animate-spin"/> : <CheckCircle className="w-4 h-4"/>} Lưu
                    </button>
                </div>
                </form>
            </div>
        </div>
      )}

      {/* 2. ADD USER */}
      {isAddModalOpen && (
           <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
               <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-blue-50">
              <h3 className="font-bold text-blue-800 flex items-center gap-2">
                <Plus className="w-5 h-5"/> Thêm Tài Khoản Mới
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Họ và Tên</label>
                <input required type="text" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  value={newUserForm.name} onChange={e => setNewUserForm({...newUserForm, name: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Username</label>
                    <input required type="text" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    value={newUserForm.username} onChange={e => setNewUserForm({...newUserForm, username: e.target.value})} />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Password</label>
                    <input required type="password" placeholder="Mặc định..." className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    value={newUserForm.password} onChange={e => setNewUserForm({...newUserForm, password: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Vai trò</label>
                  <select className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none bg-white"
                    value={newUserForm.role} onChange={e => setNewUserForm({...newUserForm, role: e.target.value as UserRole})}>
                    <option value={UserRole.DISTRIBUTOR}>Distributor</option>
                    <option value={UserRole.ADMIN}>Admin</option>
                  </select>
                </div>
                <div className={newUserForm.role === UserRole.ADMIN ? 'opacity-40 pointer-events-none' : ''}>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nhóm</label>
                  <select className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none bg-white"
                    value={newUserForm.group} onChange={e => setNewUserForm({...newUserForm, group: e.target.value as DistributorGroup})}>
                    {Object.values(DistributorGroup).map(g => (
                        <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium">Hủy bỏ</button>
                <button type="submit" disabled={isAdding} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-sm flex justify-center items-center gap-2">
                  {isAdding ? <Loader2 className="w-4 h-4 animate-spin"/> : "Tạo Tài Khoản"}
                </button>
              </div>
            </form>
          </div>
           </div>
      )}

      {/* 3. EDIT USER */}
      {editModal.isOpen && editModal.data && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-indigo-50">
              <h3 className="font-bold text-indigo-800 flex items-center gap-2">
                <Edit className="w-5 h-5"/> Sửa Thông Tin
              </h3>
              <button onClick={() => setEditModal({ isOpen: false, data: null })} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Họ và Tên</label>
                <input required type="text" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={editModal.data.name} 
                  onChange={e => setEditModal({ ...editModal, data: { ...editModal.data!, name: e.target.value } })} 
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Username (Cẩn thận khi đổi)</label>
                <input required type="text" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={editModal.data.username} 
                  onChange={e => setEditModal({ ...editModal, data: { ...editModal.data!, username: e.target.value } })} 
                />
              </div>

              <div className={editModal.data.role === UserRole.ADMIN ? 'opacity-40 pointer-events-none' : ''}>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nhóm</label>
                <select className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none bg-white focus:ring-2 focus:ring-indigo-500"
                  value={editModal.data.group || DistributorGroup.TaiChinh} 
                  onChange={e => setEditModal({ ...editModal, data: { ...editModal.data!, group: e.target.value as DistributorGroup } })}
                >
                  {Object.values(DistributorGroup).map(g => (
                      <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setEditModal({ isOpen: false, data: null })} 
                    className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium">
                    Hủy bỏ
                </button>
                <button type="submit" disabled={isEditing} 
                    className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium shadow-sm flex justify-center items-center gap-2">
                  {isEditing ? <Loader2 className="w-4 h-4 animate-spin"/> : "Lưu Thay Đổi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};