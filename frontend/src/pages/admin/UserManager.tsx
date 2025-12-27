import React, { useState, useMemo } from 'react';
import { User, DistributorGroup } from '../../types';
import { Card } from '../../components/Card';
import { Search, Filter, Users, Shield, Award, User as UserIcon } from 'lucide-react';

interface UserManagerProps {
  users: User[]; // Nhận danh sách user từ App.tsx
}

export const UserManager: React.FC<UserManagerProps> = ({ users }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGroup, setFilterGroup] = useState<string>('ALL');

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
      
      const matchesGroup = filterGroup === 'ALL' || user.group === filterGroup;

      return matchesSearch && matchesGroup;
    });
  }, [users, searchTerm, filterGroup]);

  // Helper màu sắc cho Badge nhóm
  const getGroupBadge = (group?: string) => {
    switch(group) {
      case DistributorGroup.GOLD: 
        return <span className="flex items-center gap-1 bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded text-xs font-bold border border-yellow-200"><Award className="w-3 h-3"/> Gold Partner</span>;
      case DistributorGroup.SILVER: 
        return <span className="flex items-center gap-1 bg-slate-100 text-slate-800 px-2 py-0.5 rounded text-xs font-bold border border-slate-200"><Award className="w-3 h-3"/> Silver Partner</span>;
      case DistributorGroup.NEW: 
        return <span className="flex items-center gap-1 bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs font-bold border border-blue-200"><UserIcon className="w-3 h-3"/> New Partner</span>;
      default: 
        return <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs">Unknown</span>;
    }
  };

  return (
    <div className="space-y-6">
      
      {/* HEADER & STATS */}
      <div>
        <h2 className="text-2xl font-bold text-slate-800 mb-4">Account Management</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
             <div><p className="text-xs text-slate-500 font-bold uppercase">Total Accounts</p><p className="text-2xl font-bold text-slate-800">{stats.total}</p></div>
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
      </div>

      {/* FILTER BAR */}
      <div className="flex flex-col md:flex-row gap-4 justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search by name or username..." 
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
            <option value="ALL">All Groups</option>
            <option value={DistributorGroup.GOLD}>Gold Partners</option>
            <option value={DistributorGroup.SILVER}>Silver Partners</option>
            <option value={DistributorGroup.NEW}>New Partners</option>
          </select>
        </div>
      </div>

      {/* USER LIST TABLE */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 border-b">
              <tr>
                <th className="px-4 py-3">User Info</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Group Level</th>
                <th className="px-4 py-3 text-right">User ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                    No users found matching your search.
                  </td>
                </tr>
              ) : (
                filteredUsers.map(user => (
                  <tr key={user.id} className="hover:bg-slate-50 transition">
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
                      <span className="flex items-center gap-1 text-slate-700 font-medium">
                        <Shield className="w-3 h-3 text-blue-600" />
                        {user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {getGroupBadge(user.group)}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-slate-400 font-mono">
                      {user.id}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};