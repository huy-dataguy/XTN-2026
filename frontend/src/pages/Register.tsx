import React, { useState } from 'react';
import { User, Lock, Loader2, UserPlus, Briefcase, Users, KeyRound } from 'lucide-react'; // Import KeyRound icon
import { authService } from '../services/authService';
import { UserRole, DistributorGroup } from '../types';
import { Link, useNavigate } from 'react-router-dom';

export const Register: React.FC = () => {
  // State Form
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  // Các trường dữ liệu
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [securityCode, setSecurityCode] = useState(''); // State lưu mã bảo mật
  
  const [role, setRole] = useState<UserRole>(UserRole.DISTRIBUTOR);
  const [group, setGroup] = useState<DistributorGroup>(DistributorGroup.VanPhong);
  
  const navigate = useNavigate();

  // Xử lý đăng ký
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      // Gọi service, backend sẽ lo việc check mã đúng hay sai
      await authService.register(
        username, 
        password, 
        name, 
        role, 
        role === UserRole.DISTRIBUTOR ? group : undefined, 
        securityCode
      );
      
      alert("Tạo tài khoản thành công! Vui lòng đăng nhập.");
      navigate('/login');
    } catch (err: any) {
      // Backend trả lỗi (ví dụ: Sai mã bảo mật) thì hiện ở đây
      setError(err.response?.data?.msg || 'Đăng ký thất bại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 py-10">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-96 border border-slate-200">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-blue-700">Đăng Ký</h1>
          <p className="text-slate-500 mt-2">Hệ thống phân phối nội bộ</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-200 text-center animate-pulse">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
            {/* 1. Họ và tên */}
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Họ và Tên (Tên hiển thị)</label>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <UserPlus className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                        type="text"
                        required
                        className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="VD: Nguyễn Văn A"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                    />
                </div>
            </div>
            
            {/* 2. Chọn Vai Trò (Role) */}
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Vai trò</label>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Briefcase className="h-5 w-5 text-slate-400" />
                    </div>
                    <select 
                        value={role}
                        onChange={(e) => setRole(e.target.value as UserRole)}
                        className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg outline-none bg-white focus:ring-2 focus:ring-blue-500"
                    >
                        <option value={UserRole.DISTRIBUTOR}>Distributor (Nhà phân phối)</option>
                        <option value={UserRole.ADMIN}>Admin (Quản trị viên)</option>
                    </select>
                </div>
            </div>

            {/* 3. Nhập Mã Bảo Mật (Quan Trọng) */}
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                    {role === UserRole.ADMIN ? 'Mã bí mật Admin' : 'Mã giới thiệu (Invite Code)'}
                </label>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <KeyRound className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                        type="password"
                        required
                        className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder={role === UserRole.ADMIN ? "Nhập mã Admin..." : "Nhập mã phân phối..."}
                        value={securityCode}
                        onChange={(e) => setSecurityCode(e.target.value)}
                    />
                </div>
            </div>

            {/* 4. Chọn Nhóm (Chỉ hiện nếu là Distributor) */}
            {role === UserRole.DISTRIBUTOR && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                <label className="block text-sm font-medium text-slate-700 mb-1">Thuộc Ban/Nhóm</label>
                <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Users className="h-5 w-5 text-slate-400" />
                </div>
                <select 
                    value={group}
                    onChange={(e) => setGroup(e.target.value as DistributorGroup)}
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                >
                    <option value={DistributorGroup.TaiChinh}>Tài Chính</option>
                    <option value={DistributorGroup.VanPhong}>Văn Phòng</option>
                    <option value={DistributorGroup.SuKien}>Sự Kiện</option>
                    <option value={DistributorGroup.TruyenThong}>Truyền Thông</option>
                    <option value={DistributorGroup.HauCan}>Hậu Cần</option>
                    <option value={DistributorGroup.BanBep}>Ban Bếp</option>
                </select>
                </div>
            </div>
            )}

            {/* 5. Username */}
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tên đăng nhập</label>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <User className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                        type="text"
                        required
                        className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="Username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                    />
                </div>
            </div>

            {/* 6. Password */}
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Mật khẩu</label>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Lock className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                        type="password"
                        required
                        className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                </div>
            </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-slate-800 text-white py-3 rounded-lg hover:bg-slate-900 transition font-bold shadow-sm flex justify-center items-center disabled:opacity-70 mt-6"
          >
            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Đăng Ký Tài Khoản'}
          </button>
        </form>

        <div className="mt-6 text-center">
            <Link to="/login" className="text-blue-600 font-bold hover:underline">
              Quay lại Đăng Nhập
            </Link>
        </div>
      </div>
    </div>
  );
};