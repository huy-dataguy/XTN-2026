import React, { useState } from 'react';
import { User, Lock, Loader2, UserPlus, Briefcase, Users, ShieldCheck } from 'lucide-react';
import { authService } from '../services/authService';
import { UserRole, DistributorGroup } from '../types';
import { Link, useNavigate } from 'react-router-dom';

export const Register: React.FC = () => {
  // --- STATE BẢO MẬT ---
  const [isVerified, setIsVerified] = useState(false);
  const [isAdminAccess, setIsAdminAccess] = useState(false); // State mới để check quyền Admin
  const [securityCode, setSecurityCode] = useState('');
  
  // --- STATE FORM ---
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  
  // Mặc định role là Distributor
  const [role, setRole] = useState<UserRole>(UserRole.DISTRIBUTOR);
  const [group, setGroup] = useState<DistributorGroup>(DistributorGroup.VanPhong);
  
  const navigate = useNavigate();

  // Xử lý kiểm tra mã bảo mật
  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (securityCode === '1101') {
      // Mã thường: Chỉ cho tạo Distributor
      setIsVerified(true);
      setIsAdminAccess(false);
      setRole(UserRole.DISTRIBUTOR); // Reset về Distributor cho chắc chắn
      setError('');
    } 
    else if (securityCode === '111108') {
      // Mã VIP: Cho phép tạo Admin
      setIsVerified(true);
      setIsAdminAccess(true);
      setRole(UserRole.ADMIN); // Tự động chọn sẵn Admin cho tiện
      setError('');
    } 
    else {
      setError('Incorrect Security Code');
    }
  };

  // Xử lý đăng ký
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await authService.register(username, password, name, role, role === UserRole.DISTRIBUTOR ? group : undefined);
      alert("Account created successfully!");
      navigate('/login');
    } catch (err: any) {
      setError(err.response?.data?.msg || 'Registration failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- GIAO DIỆN NHẬP MÃ BẢO MẬT (GATEKEEPER) ---
  if (!isVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-96 border border-slate-200">
          <div className="text-center mb-6">
            <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <ShieldCheck className="w-6 h-6 text-red-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800">Security Check</h1>
            <p className="text-slate-500 mt-2">Enter code to access registration</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-200 text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleVerify} className="space-y-4">
            <input
              type="password"
              className="w-full text-center tracking-[0.5em] text-2xl font-bold py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
              placeholder="••••••" 
              maxLength={6} // Tăng lên 6 ký tự để nhập được 111108
              value={securityCode}
              onChange={(e) => setSecurityCode(e.target.value)}
              autoFocus
            />
            <button
              type="submit"
              className="w-full bg-slate-800 text-white py-3 rounded-lg hover:bg-slate-900 transition font-bold"
            >
              Verify Access
            </button>
          </form>
          
          <div className="mt-6 text-center">
             <Link to="/login" className="text-sm text-blue-600 hover:underline">Back to Login</Link>
          </div>
        </div>
      </div>
    );
  }

  // --- GIAO DIỆN ĐĂNG KÝ ---
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 py-10">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-96 border border-slate-200">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-blue-700">Create Account</h1>
          <p className="text-slate-500 mt-2">
            {isAdminAccess ? 'Admin Privileges Unlocked' : 'Standard Registration'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name */}
            <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <UserPlus className="h-5 w-5 text-slate-400" />
                </div>
                <input
                type="text"
                required
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Company/User Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                />
            </div>
            </div>
            
            {/* Role - Chỉ cho phép thay đổi nếu có Admin Access */}
            <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
                Role {isAdminAccess ? '(Admin Unlocked)' : '(Locked)'}
            </label>
            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Briefcase className="h-5 w-5 text-slate-400" />
                </div>
                <select 
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                disabled={!isAdminAccess} // Khóa nếu chỉ nhập code 1101
                className={`w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg outline-none bg-white 
                    ${!isAdminAccess ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'focus:ring-2 focus:ring-blue-500'}`}
                >
                <option value={UserRole.DISTRIBUTOR}>Distributor</option>
                <option value={UserRole.ADMIN}>Admin</option>
                </select>
            </div>
            </div>

            {/* Group - Chỉ hiện khi role là Distributor */}
            {role === UserRole.DISTRIBUTOR && (
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Distributor Group</label>
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

            {/* Username */}
            <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User className="h-5 w-5 text-slate-400" />
                </div>
                <input
                type="text"
                required
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Enter username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                />
            </div>
            </div>

            {/* Password */}
            <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input
                type="password"
                required
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                />
            </div>
            </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition font-bold shadow-sm flex justify-center items-center disabled:opacity-70"
          >
            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Register Account'}
          </button>
        </form>

        <div className="mt-6 text-center">
            <Link to="/login" className="text-blue-600 font-bold hover:underline">
              Back to Sign In
            </Link>
        </div>
      </div>
    </div>
  );
};