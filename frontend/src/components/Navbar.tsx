'use client';

import { useSession, signOut } from 'next-auth/react';
import { Mail, LogOut, Activity, ShieldCheck } from 'lucide-react';

export function Navbar() {
  const { data: session } = useSession();

  return (
    <header className="border-b border-gray-800 bg-[#0f172a]/95 backdrop-blur sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-lg text-white tracking-tight">ReachInbox</span>
              <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/60">
                Email Dispatcher
              </span>
            </div>
            <p className="text-xs text-gray-400 font-mono">BullMQ + Redis Engine</p>
          </div>
        </div>

        {/* System Status & User Control */}
        <div className="flex items-center space-x-6">
          {/* Status Indicator */}
          <div className="hidden sm:flex items-center space-x-2 px-3 py-1.5 rounded-full bg-emerald-950/40 border border-emerald-800/40 text-xs font-medium text-emerald-400">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            <span>Engine Active</span>
          </div>

          {/* User profile dropdown / button */}
          {session?.user && (
            <div className="flex items-center space-x-3 border-l border-gray-800 pl-6">
              {session.user.image ? (
                <img
                  src={session.user.image}
                  alt={session.user.name || 'User'}
                  className="w-8 h-8 rounded-full border border-gray-700 object-cover"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-semibold text-xs">
                  {session.user.name?.charAt(0) || session.user.email?.charAt(0) || 'U'}
                </div>
              )}
              <div className="hidden md:block text-left">
                <div className="text-sm font-medium text-gray-200 line-clamp-1">
                  {session.user.name || 'Outreach Manager'}
                </div>
                <div className="text-xs text-gray-400 line-clamp-1 font-mono">
                  {session.user.email}
                </div>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                title="Log out of ReachInbox"
                className="p-2 rounded-lg text-gray-400 hover:text-rose-400 hover:bg-rose-950/30 transition-colors border border-transparent hover:border-rose-900/50"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
