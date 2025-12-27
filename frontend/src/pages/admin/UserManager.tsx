// src/pages/admin/UserManager.tsx

import React, { useState, useMemo } from 'react';
import { User, DistributorGroup, UserRole } from '../../types'; 
import { 
  Search, Filter, Users, Shield, Award, 
  User as UserIcon, Plus, Trash2, X, Briefcase
} from 'lucide-react';

// --- INTERFACES ---
interface UserManagerProps {
  users: User[];
  currentUser: User; 
  onAddUser: (newUser: Omit<User, 'id'>) => void;
  onDeleteUser: (userId: string) => void; 
}

// Component Card đơn giản
const Card: React.FC<{children: React.ReactNode}> = ({ children }) => (
  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
    {children}
  </div>
);

export const UserManager: React.FC<UserManagerProps> = ({ 
  users, 
  currentUser, 
  onAddUser, 
  onDeleteUser 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGroup, setFilterGroup] = useState<string>('ALL');
  
  // State cho Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  
  // State Form
  const [newUserForm, setNewUserForm] = useState({
    name: '',
    username: '',
    // Mặc định tạo là DISTRIBUTOR (Nhà phân phối)
    role: UserRole.DISTRIBUTOR, 
    group: DistributorGroup.NEW 
  });

  // --- CHECK QUYỀN ---
  // Chỉ admin0 mới có quyền xóa (Logic cũ của bạn)
  const canDelete = currentUser?.username === 'admin0';

  // --- THỐNG KÊ ---
  const stats = useMemo(() => {
    return {
      total: users.length,
      gold: users.filter(u => u.group === DistributorGroup.GOLD).length,
      silver: users.filter(u => u.group === DistributorGroup.SILVER).length,
      new: users.filter(u => u.group === DistributorGroup.NEW).length,
    };
  }, [users]);

  // --- LỌC DANH SÁCH ---
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const matchesSearch = 
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        user.username.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Nếu filter là ALL thì lấy hết, ngược lại so sánh group.
      // Lưu ý: Admin không có group nên sẽ không hiện khi filter group cụ thể
      const matchesGroup = filterGroup === 'ALL' || user.group === filterGroup;

      return matchesSearch && matchesGroup;
    });
  }, [users, searchTerm, filterGroup]);

  // --- HANDLERS ---
  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserForm.name || !newUserForm.username) return;

    // Chuẩn bị dữ liệu
    const payload: Omit<User, 'id'> = {
      name: newUserForm.name,
      username: newUserForm.username,
      role: newUserForm.role,
      // Nếu là ADMIN thì không cần group, nếu là DISTRIBUTOR thì lấy group từ form
      group: newUserForm.role === UserRole.DISTRIBUTOR ? newUserForm.group : undefined
    };

    onAddUser(payload);

    // Reset form & close modal
    setNewUserForm({ 
      name: '', 
      username: '', 
      role: UserRole.DISTRIBUTOR, 
      group: DistributorGroup.NEW 
    });
    setIsAddModalOpen(false);
  };

  const handleDeleteClick = (userId: string) => {
    if (!canDelete) {
      alert("Chỉ tài khoản 'admin0' mới có quyền xóa người dùng.");
      return; 
    }
    
    if (window.confirm('Bạn có chắc chắn muốn xóa người dùng này?')) {
      onDeleteUser(userId);
    }
  };

  // Helper hiển thị Role
  const getRoleBadge = (role: UserRole) => {
    if (role === UserRole.ADMIN) {
      return <span className="flex items-center gap-1 text-purple-700 font-bold"><Shield className="w-3 h-3"/> Admin</span>;
    }
    return <span className="flex items-center gap-1 text-blue-700 font-medium"><Briefcase className="w-3 h-3"/> Distributor</span>;
  };

  // Helper hiển thị Group
  const getGroupBadge = (group?: DistributorGroup) => {
    if (!group) return <span className="text-slate-400 text-xs italic">N/A</span>; // Trường hợp Admin

    switch(group) {
      case DistributorGroup.GOLD: 
        return <span className="flex items-center gap-1 bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded text-xs font-bold border border-yellow-200"><Award className="w-3 h-3"/> Gold</span>;
      case DistributorGroup.SILVER: 
        return <span className="flex items-center gap-1 bg-slate-100 text-slate-800 px-2 py-0.5 rounded text-xs font-bold border border-slate-200"><Award className="w-3 h-3"/> Silver</span>;
      case DistributorGroup.NEW: 
        return <span className="flex items-center gap-1 bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs font-bold border border-blue-200"><UserIcon className="w-3 h-3"/> New</span>;
      default: 
        return <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs">Unknown</span>;
    }
  };

  return (
    <div className="space-y-6">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
           <h2 className="text-2xl font-bold text-slate-800">Quản Lý Tài Khoản</h2>
           <p className="text-slate-500 text-sm">Quản lý nhân viên phân phối và phân cấp đại lý.</p>
        </div>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition shadow-sm"
        >
          <Plus className="w-4 h-4" /> Thêm Nhân Viên
        </button>
      </div>

      {/* STATS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
             <div><p className="text-xs text-slate-500 font-bold uppercase">Tổng Tài Khoản</p><p className="text-2xl font-bold text-slate-800">{stats.total}</p></div>
             <div className="p-3 bg-slate-100 rounded-full text-slate-600"><Users className="w-5 h-5"/></div>
          </div>
          <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200 shadow-sm flex items-center justify-between">
             <div><p className="text-xs text-yellow-700 font-bold uppercase">Gold Partners</p><p className="text-2xl font-bold text-yellow-800">{stats.gold}</p></div>
             <div className="p-3 bg-white rounded-full text-yellow-600"><Award className="w-5 h-5"/></div>
          </div>
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
             <div><p className="text-xs text-slate-600 font-bold uppercase">Silver Partners</p><p className="text-2xl font-bold text-slate-800">{stats.silver}</p></div>
             <div className="p-3 bg-white rounded-full text-slate-500"><Award className="w-5 h-5"/></div>
          </div>
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 shadow-sm flex items-center justify-between">
             <div><p className="text-xs text-blue-700 font-bold uppercase">New Partners</p><p className="text-2xl font-bold text-blue-800">{stats.new}</p></div>
             <div className="p-3 bg-white rounded-full text-blue-600"><UserIcon className="w-5 h-5"/></div>
          </div>
      </div>

      {/* FILTER BAR */}
      <div className="flex flex-col md:flex-row gap-4 justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Tìm theo tên hoặc username..." 
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-500" />
          <select 
            className="border border-slate-300 rounded-lg py-2 px-3 outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            value={filterGroup}
            onChange={(e) => setFilterGroup(e.target.value)}
          >
            <option value="ALL">Tất cả nhóm</option>
            <option value={DistributorGroup.GOLD}>Gold Partners</option>
            <option value={DistributorGroup.SILVER}>Silver Partners</option>
            <option value={DistributorGroup.NEW}>New Partners</option>
          </select>
        </div>
      </div>

      {/* TABLE */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 border-b">
              <tr>
                <th className="px-4 py-3">Thông tin User</th>
                <th className="px-4 py-3">Vai trò (Role)</th>
                <th className="px-4 py-3">Cấp bậc (Group)</th>
                <th className="px-4 py-3 text-right">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                    Không tìm thấy user nào.
                  </td>
                </tr>
              ) : (
                filteredUsers.map(user => (
                  <tr key={user.id} className="hover:bg-slate-50 transition group">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-600">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800">{user.name}</p>
                          <p className="text-xs text-slate-500">@{user.username}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {getRoleBadge(user.role)}
                    </td>
                    <td className="px-4 py-3">
                      {getGroupBadge(user.group)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                         <button 
                           onClick={() => handleDeleteClick(user.id)}
                           disabled={!canDelete}
                           title={canDelete ? "Xóa user này" : "Chỉ admin0 được xóa"}
                           className={`p-2 rounded transition ${
                             canDelete 
                               ? "text-slate-400 hover:text-red-600 hover:bg-red-50" 
                               : "text-slate-200 cursor-not-allowed"
                           }`}
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

      {/* --- ADD USER MODAL --- */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800">Thêm Người Dùng Mới</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Họ và Tên</label>
                <input 
                  required
                  type="text" 
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Ví dụ: Nguyen Van A"
                  value={newUserForm.name}
                  onChange={e => setNewUserForm({...newUserForm, name: e.target.value})}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Username (Đăng nhập)</label>
                <input 
                  required
                  type="text" 
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Ví dụ: nguyena"
                  value={newUserForm.username}
                  onChange={e => setNewUserForm({...newUserForm, username: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Vai trò</label>
                  <select 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    value={newUserForm.role}
                    onChange={e => setNewUserForm({...newUserForm, role: e.target.value as UserRole})}
                  >
                    <option value={UserRole.DISTRIBUTOR}>Distributor</option>
                    <option value={UserRole.ADMIN}>Admin</option>
                  </select>
                </div>
                
                {/* Chỉ hiện chọn Group nếu role là Distributor */}
                <div className={newUserForm.role === UserRole.ADMIN ? 'opacity-50 pointer-events-none' : ''}>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nhóm</label>
                  <select 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    value={newUserForm.group}
                    onChange={e => setNewUserForm({...newUserForm, group: e.target.value as DistributorGroup})}                  >
                    <option value={DistributorGroup.NEW}>New</option>
                    <option value={DistributorGroup.SILVER}>Silver</option>
                    <option value={DistributorGroup.GOLD}>Gold</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium"
                >
                  Hủy bỏ
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-sm"
                >
                  Tạo Tài Khoản
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};