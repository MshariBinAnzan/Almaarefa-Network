'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BookOpen,
  Calendar,
  CheckCircle2,
  Home,
  LogOut,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  User as UserIcon,
  Users,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { ThemeSwitcher } from '@/components/theme/ThemeProvider';
import { isMockMode } from '@/services/auth.service';
import { cn } from '@/utils/validators';
import { MOCK_USERS } from '@/mocks/data';

interface AppShellProps {
  children: React.ReactNode;
  activeTab?: string;
  onSelectSection?: (section: string) => void;
}

export function AppShell({ children, activeTab = 'feed', onSelectSection }: AppShellProps) {
  const { user, logout, switchMockPersona } = useAuth();
  const pathname = usePathname();
  const mockActive = isMockMode();

  const navItems = [
    { id: 'feed', label: 'Campus Feed', icon: Home, href: '/' },
    { id: 'courses', label: 'Course Groups', icon: BookOpen, href: '/?tab=courses' },
    { id: 'clubs', label: 'Student Clubs', icon: Users, href: '/?tab=clubs' },
    { id: 'calendar', label: 'Events Calendar', icon: Calendar, href: '/?tab=calendar' },
    { id: 'profile', label: 'My Profile & ID', icon: UserIcon, href: '/?tab=profile' },
  ];

  if (user?.role === 'ADMIN') {
    navItems.push({
      id: 'admin',
      label: 'Moderation Panel',
      icon: ShieldAlert,
      href: '/?tab=admin',
    });
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col pb-16 md:pb-0">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
          {/* University Brand */}
          <div className="flex items-center gap-3 shrink-0">
            <Link
              href="/"
              aria-label="Almaarefa Network home"
              className="inline-flex items-center shrink-0"
            >
              <BrandLogo className="h-7 sm:h-8" priority />
            </Link>
            <div className="hidden sm:flex flex-col justify-center ps-3 border-s border-slate-200 leading-tight">
              <div className="flex items-center gap-2 whitespace-nowrap">
                <span className="font-bold text-sm tracking-tight text-slate-900">
                  Network
                </span>
                <span
                  className={cn(
                    'text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap leading-none',
                    mockActive
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  )}
                  title="Controlled via NEXT_PUBLIC_USE_MOCK in .env.local"
                >
                  {mockActive ? 'Mock API Mode' : 'Live API'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 whitespace-nowrap mt-0.5">
                Verified Digital Campus Community
              </p>
            </div>
          </div>

          {/* Global In-Course & Campus Search */}
          <div className="hidden lg:flex flex-1 max-w-xs mx-2">
            <div className="relative w-full">
              <Search className="w-4 h-4 text-slate-400 absolute start-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                placeholder="Search courses (e.g. CS312), clubs, study files..."
                className="w-full ps-10 pe-4 py-2 text-sm bg-slate-100 border border-transparent rounded-xl focus:bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none transition"
              />
            </div>
          </div>

          {/* Right Controls: Theme Switcher + Persona Switcher (Dev Helper) + User Profile */}
          <div className="flex items-center gap-2.5 shrink-0">
            <ThemeSwitcher />
            {mockActive && (
            <div className="hidden lg:flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-xl border border-slate-200 whitespace-nowrap">
                <Sparkles className="w-3.5 h-3.5 text-brand-600 shrink-0" aria-hidden="true" />
                <label htmlFor="persona-switcher" className="text-[11px] font-medium text-slate-500">
                  Role:
                </label>
                <select
                  id="persona-switcher"
                  value={
                    (
                      Object.keys(MOCK_USERS) as Array<keyof typeof MOCK_USERS>
                    ).find((k) => MOCK_USERS[k].userId === user?.userId) ?? 'studentVerified'
                  }
                  onChange={(e) =>
                    switchMockPersona(e.target.value as keyof typeof MOCK_USERS)
                  }
                  className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer"
                >
                  <option value="studentVerified" style={{ color: 'black' }}>Verified Student</option>
                  <option value="studentUnverified" style={{ color: 'black' }}>Unverified Student</option>
                  <option value="clubLeader" style={{ color: 'black' }}>Club Leader</option>
                  <option value="admin" style={{ color: 'black' }}>Admin</option>
                </select>
              </div>
            )}

            {user && (
              <div className="flex items-center gap-3 ps-2 border-s border-slate-200">
                <div className="text-end hidden sm:block">
                  <div className="flex items-center justify-end gap-1">
                    <span className="text-sm font-semibold text-slate-900">
                      {user.profile.fullName}
                    </span>
                    {user.isVerified ? (
                      <CheckCircle2
                        className="w-4 h-4 text-brand-600 shrink-0"
                        aria-label="Verified Almaarefa Student"
                      />
                    ) : (
                      <AlertTriangle
                        className="w-4 h-4 text-amber-500 shrink-0"
                        aria-label="Verification Pending"
                      />
                    )}
                  </div>
                  <div className="flex items-center justify-end gap-1.5 text-xs text-slate-500">
                    <span>{user.profile.departmentName || user.universityEmail}</span>
                    <span className="px-1.5 py-0.2 bg-slate-100 text-slate-700 rounded font-medium text-[10px]">
                      {user.role}
                    </span>
                  </div>
                </div>

                <div className="w-9 h-9 rounded-full bg-brand-100 text-brand-700 font-bold flex items-center justify-center text-sm border border-brand-200">
                  {user.profile.fullName
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase()}
                </div>

                <button
                  type="button"
                  onClick={logout}
                  title="Sign out"
                  className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Unverified Student Alert Banner */}
      {user && !user.isVerified && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 text-amber-900 text-sm">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>Student ID Verification Pending:</strong> You can browse course feeds and
                campus events, but posting and joining clubs requires verifying your Almaarefa
                Student ID.
              </span>
            </div>
            <button
              type="button"
              onClick={() => onSelectSection?.('profile')}
              className="text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-[#ffffff] px-3 py-1.5 rounded-lg transition shrink-0"
            >
              Upload Student ID Now
            </button>
          </div>
        </div>
      )}

      {/* Main Content Layout */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Left Navigation Sidebar (Desktop) */}
        <aside className="hidden md:block md:col-span-3 lg:col-span-3">
          <div className="sticky top-24 space-y-6">
            <nav className="bg-white rounded-2xl border border-slate-200 p-2 shadow-sm space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id && pathname === '/';
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectSection?.(item.id)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition text-start',
                      isActive
                        ? 'bg-brand-50 text-brand-700 font-semibold'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    )}
                  >
                    <Icon
                      className={cn('w-5 h-5', isActive ? 'text-brand-600' : 'text-slate-400')}
                    />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* Campus Trust & Security Card */}
            <div className="bg-gradient-to-br from-[#1e3a8a] to-[#172554] rounded-2xl p-4 text-[#ffffff] shadow-sm border border-brand-700/30">
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck className="w-5 h-5 text-[#93c5fd]" />
                <h3 className="text-sm font-semibold">Verified Campus Space</h3>
              </div>
              <p className="text-xs text-[#dbeafe] leading-relaxed">
                Exclusively restricted to verified <strong>@mcst.edu.sa</strong> students, club
                leaders, and faculty. Zero commercial spam or unauthorized links.
              </p>
              <div className="mt-3 pt-3 border-t border-[#1e40af]/60 flex items-center justify-between text-[11px] text-[#bfdbfe]">
                <span>Status: {user?.isVerified ? 'Verified ID' : 'Pending ID Proof'}</span>
                <Link href="/login" className="underline hover:text-[#ffffff]">
                  Switch Account
                </Link>
              </div>
            </div>
          </div>
        </aside>

        {/* Center / Main View */}
        <main className="md:col-span-9 lg:col-span-9">{children}</main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 z-30 flex items-center justify-around py-2 px-2">
        {navItems.slice(0, 5).map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectSection?.(item.id)}
              className={cn(
                'flex flex-col items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium',
                isActive ? 'text-brand-700 font-semibold' : 'text-slate-500'
              )}
            >
              <Icon className="w-5 h-5" />
              <span>{item.label.split(' ')[0]}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

