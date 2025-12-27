import React, { useState } from 'react';
import { User, Lock, Loader2, UserPlus, Briefcase, Users } from 'lucide-react'; // Thêm icon Users
import { authService } from '../services/authService';
import { UserRole, DistributorGroup } from '../types'; // Import Enum Group

interface LoginProps {
  onAuthSuccess: (data: { token: string, user: any }) => void;
}

export const Login: React.FC<LoginProps> = ({ onAuthSuccess }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Form State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>(UserRole.DISTRIBUTOR);
  // STATE MỚI: Mặc định là NEW
  const [group, setGroup] = useState<DistributorGroup>(DistributorGroup.NEW); 

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      let res;
      if (isRegistering) {
        // Gửi thêm group khi đăng ký
        await authService.register(username, password, name, role, role === UserRole.DISTRIBUTOR ? group : undefined);
        res = await authService.login(username, password);
      } else {
        res = await authService.login(username, password);
      }

      onAuthSuccess(res.data);

    } catch (err: any) {
      setError(err.response?.data?.msg || 'Authentication failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-96 border border-slate-200 transition-all">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-blue-700">DistriFlow</h1>
          <p className="text-slate-500 mt-2">
            {isRegistering ? 'Create new account' : 'Sign in to your account'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Các trường đăng ký mở rộng */}
          {isRegistering && (
            <>
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
                    placeholder="Company Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Role (Dev Only)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Briefcase className="h-5 w-5 text-slate-400" />
                  </div>
                  <select 
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                  >
                    <option value={UserRole.DISTRIBUTOR}>Distributor</option>
                    <option value={UserRole.ADMIN}>Admin</option>
                  </select>
                </div>
              </div>

              {/* CHỈ HIỆN KHI ROLE LÀ DISTRIBUTOR */}
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
                      <option value={DistributorGroup.NEW}>New (Mới)</option>
                      <option value={DistributorGroup.SILVER}>Silver (Bạc)</option>
                      <option value={DistributorGroup.GOLD}>Gold (Vàng)</option>
                    </select>
                  </div>
                </div>
              )}
            </>
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
            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : (isRegistering ? 'Sign Up' : 'Sign In')}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-slate-600">
            {isRegistering ? "Already have an account? " : "Don't have an account? "}
            <button 
              onClick={() => setIsRegistering(!isRegistering)}
              className="text-blue-600 font-bold hover:underline"
            >
              {isRegistering ? 'Sign In' : 'Register Now'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};