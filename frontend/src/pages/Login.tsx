import React, { useState } from 'react';

interface LoginProps {
  onLogin: (username: string) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('admin');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin(username);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-96 border border-slate-200">
        <h1 className="text-2xl font-bold text-slate-800 mb-6 text-center">DistriFlow Login</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Select Role (Simulation)</label>
            <select 
              className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            >
              <option value="admin">Admin (Store Owner)</option>
              <option value="user1">Distributor Gold (user1)</option>
              <option value="user2">Distributor Silver (user2)</option>
              <option value="user3">Distributor New (user3)</option>
            </select>
          </div>
          <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition font-bold shadow-sm">
            Sign In
          </button>
        </form>
        <p className="text-xs text-center text-slate-400 mt-6">
            Secure Supply Chain Management System
        </p>
      </div>
    </div>
  );
};