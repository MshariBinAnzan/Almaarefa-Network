'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { ThemeSwitcher } from '@/components/theme/ThemeProvider';
import { useAuth } from '@/hooks/useAuth';
import {
  cn,
  extractFieldErrors,
  validatePassword,
  validateUniversityEmail,
} from '@/utils/validators';
import { ApiErrorResponse } from '@/types';
import { isMockMode } from '@/services/auth.service';

export default function LoginPage() {
  const { login } = useAuth();
  const [universityEmail, setUniversityEmail] = useState('s123456@mcst.edu.sa');
  const [password, setPassword] = useState('StrongPassword123!');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);

    const errors: Record<string, string> = {};
    const emailErr = validateUniversityEmail(universityEmail);
    const passErr = validatePassword(password);
    if (emailErr) errors.universityEmail = emailErr;
    if (passErr) errors.password = passErr;

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);

    try {
      await login({
        universityEmail: universityEmail.trim(),
        password,
      });
    } catch (err) {
      const apiErr = err as ApiErrorResponse;
      if (apiErr?.error) {
        setGeneralError(apiErr.error.message);
        setFieldErrors(extractFieldErrors(apiErr.error.details));
      } else {
        setGeneralError('Unable to sign in. Please verify your credentials.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const fillDemoAccount = (email: string) => {
    setUniversityEmail(email);
    setPassword('StrongPassword123!');
    setFieldErrors({});
    setGeneralError(null);
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-12 bg-slate-50">
      {/* Left Column: University Branding & Value Prop */}
      <div className="hidden lg:flex lg:col-span-5 bg-gradient-to-br from-[#1e3a8a] via-[#172554] to-[#0f172a] text-[#ffffff] p-12 flex-col justify-between relative overflow-hidden">
        <div className="relative z-10">
          <div className="mb-10 space-y-3">
            <BrandLogo className="h-10" priority />
            <div>
              <h1 className="font-bold text-xl tracking-tight">Almaarefa Network</h1>
              <p className="text-xs text-[#bfdbfe]">Almaarefa University Digital Campus</p>
            </div>
          </div>

          <h2 className="text-3xl font-bold leading-tight mb-4">
            Your verified academic &amp; campus community in one place.
          </h2>
          <p className="text-[#dbeafe] text-sm leading-relaxed mb-8">
            Designed exclusively for Almaarefa University students and faculty to collaborate in
            official course groups, discover student clubs, and track campus events—free from spam
            and external distractions.
          </p>

          <div className="space-y-4">
            {[
              {
                title: 'Verified @mcst.edu.sa Identity',
                desc: 'Strictly restricted to official Almaarefa University credentials.',
              },
              {
                title: 'Official Course Communities',
                desc: 'Discuss lectures, share study resources, and search past Q&A by course code.',
              },
              {
                title: 'Student Clubs & Unified Event Calendar',
                desc: 'Follow recognized campus clubs and RSVP to workshops and activities.',
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="flex items-start gap-3 bg-[#ffffff]/5 border border-[#ffffff]/10 rounded-xl p-3.5"
              >
                <CheckCircle2 className="w-5 h-5 text-[#93c5fd] shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-semibold text-[#ffffff]">{feature.title}</h3>
                  <p className="text-xs text-[#bfdbfe] mt-0.5">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 pt-8 border-t border-[#ffffff]/10 flex items-center justify-between text-xs text-[#bfdbfe]">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Compliant with University Privacy Standards
          </span>
          <span>v1.0 • Milestone 1</span>
        </div>
      </div>

      {/* Right Column: Login Form */}
      <div className="lg:col-span-7 flex flex-col justify-center items-center p-6 sm:p-12 relative">
        <div className="w-full max-w-md flex justify-end mb-4">
          <ThemeSwitcher />
        </div>
        <div className="w-full max-w-md space-y-6">
          {/* Mobile Header */}
          <div className="lg:hidden space-y-2 mb-2">
            <BrandLogo className="h-10" priority />
            <div>
              <h1 className="font-bold text-lg text-slate-900">Almaarefa Network</h1>
              <p className="text-xs text-slate-500">Verified University Platform</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-slate-900">Welcome back</h2>
              <p className="text-sm text-slate-500 mt-1">
                Sign in with your official Almaarefa University email
              </p>
            </div>

            {generalError && (
              <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-red-700 text-xs">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{generalError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div>
                <label
                  htmlFor="universityEmail"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  University Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute start-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="universityEmail"
                    type="email"
                    autoComplete="email"
                    value={universityEmail}
                    onChange={(e) => {
                      setUniversityEmail(e.target.value);
                      if (fieldErrors.universityEmail) {
                        setFieldErrors((prev) => ({ ...prev, universityEmail: '' }));
                      }
                    }}
                    placeholder="s123456@mcst.edu.sa"
                    className={cn(
                      'w-full ps-10 pe-4 py-2.5 text-sm rounded-xl border bg-white outline-none transition',
                      fieldErrors.universityEmail
                        ? 'border-red-400 focus:ring-2 focus:ring-red-100'
                        : 'border-slate-300 focus:border-brand-600 focus:ring-2 focus:ring-brand-100'
                    )}
                  />
                </div>
                {fieldErrors.universityEmail ? (
                  <p className="mt-1.5 text-xs text-red-600 font-medium">
                    {fieldErrors.universityEmail}
                  </p>
                ) : (
                  <p className="mt-1 text-[11px] text-slate-400">
                    Must end with <strong>@mcst.edu.sa</strong> (external domains are rejected)
                  </p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="password"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Password
                  </label>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute start-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (fieldErrors.password) {
                        setFieldErrors((prev) => ({ ...prev, password: '' }));
                      }
                    }}
                    placeholder="••••••••••••"
                    className={cn(
                      'w-full ps-10 pe-4 py-2.5 text-sm rounded-xl border bg-white outline-none transition',
                      fieldErrors.password
                        ? 'border-red-400 focus:ring-2 focus:ring-red-100'
                        : 'border-slate-300 focus:border-brand-600 focus:ring-2 focus:ring-brand-100'
                    )}
                  />
                </div>
                {fieldErrors.password && (
                  <p className="mt-1.5 text-xs text-red-600 font-medium">{fieldErrors.password}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 px-4 rounded-xl bg-brand-700 hover:bg-brand-800 disabled:opacity-60 text-[#ffffff] font-semibold text-sm shadow-sm flex items-center justify-center gap-2 transition"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Authenticating...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In to Campus Network</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-slate-100 text-center text-xs text-slate-600">
              New student at Almaarefa University?{' '}
              <Link
                href="/register"
                className="font-semibold text-brand-700 hover:text-brand-800 underline"
              >
                Create verified student account
              </Link>
            </div>
          </div>

          {/* Quick-Fill Demo Credentials Box (Mock Mode Helper) */}
          {isMockMode() && (
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-brand-600" />
                  Quick Demo Accounts (Mock Mode Active)
                </span>
                <span className="text-[11px] text-slate-400">Click to fill</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Verified Student', email: 's123456@mcst.edu.sa' },
                  { label: 'Unverified Student', email: 'newstudent@mcst.edu.sa' },
                  { label: 'Club Leader', email: 'leader@mcst.edu.sa' },
                  { label: 'System Admin', email: 'admin@mcst.edu.sa' },
                ].map((demo) => (
                  <button
                    key={demo.email}
                    type="button"
                    onClick={() => fillDemoAccount(demo.email)}
                    className={cn(
                      'text-start p-2 rounded-lg border text-xs transition',
                      universityEmail === demo.email
                        ? 'border-brand-500 bg-brand-50/60 text-brand-900'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    )}
                  >
                    <div className="font-semibold">{demo.label}</div>
                    <div className="text-[11px] text-slate-500 truncate">{demo.email}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

