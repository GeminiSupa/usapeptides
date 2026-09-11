'use client';

import React, { useState } from 'react';
import { User, ShieldCheck, Lock, Package, History, Key } from 'lucide-react';

export default function MyAccountPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggedIn(true);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      
      <div className="border-b border-brand-border pb-6">
        <div className="text-xs font-bold text-cyan-400 uppercase tracking-widest mb-1">
          Researcher Portal
        </div>
        <h1 className="text-3xl font-extrabold text-white">
          Laboratory Account &amp; Order History
        </h1>
      </div>

      {!isLoggedIn ? (
        <div className="max-w-md mx-auto p-6 sm:p-8 rounded-2xl bg-brand-card border border-brand-border space-y-5 shadow-2xl">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-xl bg-brand-darker border border-brand-border mx-auto flex items-center justify-center text-cyan-400">
              <User className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-white">Sign In to Lab Account</h2>
            <p className="text-xs text-gray-400">View past invoices, batch COAs, and saved delivery addresses</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Email or Lab Username</label>
              <input
                type="text"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-brand-dark border border-brand-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-brand-dark border border-brand-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-brand-accent hover:bg-blue-600 text-white font-bold text-xs rounded-xl shadow-lg transition-colors"
            >
              Log In to Portal
            </button>
          </form>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-brand-card border border-brand-border flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-cyan-950 text-cyan-400 flex items-center justify-center font-bold">
                LAB
              </div>
              <div>
                <h3 className="font-bold text-white text-sm">Verified Research Account</h3>
                <p className="text-xs text-gray-400 font-mono">{email || 'researcher@lab.edu'}</p>
              </div>
            </div>
            <button
              onClick={() => setIsLoggedIn(false)}
              className="text-xs text-rose-400 hover:underline"
            >
              Sign Out
            </button>
          </div>

          <div className="p-6 rounded-2xl bg-brand-card border border-brand-border space-y-4">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <History className="w-4 h-4 text-cyan-400" />
              Recent Orders &amp; HPLC Certificates
            </h3>
            <div className="p-4 rounded-xl bg-brand-darker border border-brand-border text-xs text-gray-400 text-center py-8">
              No previous orders found for this simulated session. All new orders will be tracked here.
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
