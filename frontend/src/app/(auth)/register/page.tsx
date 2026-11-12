'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Hash,
  Loader2,
  Lock,
  Mail,
  User as UserIcon,
} from 'lucide-react';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { ThemeSwitcher } from '@/components/theme/ThemeProvider';
import { useAuth } from '@/hooks/useAuth';
import { authService } from '@/services/auth.service';
import { ApiErrorResponse, Department } from '@/types';
import {
  cn,
  extractFieldErrors,
  validatePassword,
  validateStudentId,
  validateUniversityEmail,
} from '@/utils/validators';
import { MOCK_DEPARTMENTS } from '@/mocks/data';

export default function RegisterPage() {
  const { register } = useAuth();
  const [departments, setDepartments] = useState<Department[]>(MOCK_DEPARTMENTS);
  const [fullName, setFullName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [universityEmail, setUniversityEmail] = useState('');
  const [departmentId, setDepartmentId] = useState(MOCK_DEPARTMENTS[0].departmentId);
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    authService
      .getDepartments()
      .then((res) => {
        if (res.data?.length) {
          setDepartments(res.data);
          setDepartmentId(res.data[0].departmentId);
        }
      })
      .catch(() => {
        // Fallback to MOCK_DEPARTMENTS if backend /departments is not up yet
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);

    const errors: Record<string, string> = {};
    if (!fullName.trim() || fullName.trim().length < 3) {
      errors.fullName = 'Please enter your full academic name.';
    }
    const idErr = validateStudentId(studentId);
    if (idErr) errors.studentId = idErr;

    const emailErr = validateUniversityEmail(universityEmail);
    if (emailErr) errors.universityEmail = emailErr;

    const passErr = validatePassword(password);
    if (passErr) errors.password = passErr;

    if (!departmentId) {
      errors.departmentId = 'Please select your academic department.';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);

    try {
      await register({
        fullName: fullName.trim(),
        studentId: studentId.trim(),
        universityEmail: universityEmail.trim().toLowerCase(),
        departmentId,
        password,
      });
    } catch (err) {
      const apiErr = err as ApiErrorResponse;
      if (apiErr?.error) {
        setGeneralError(apiErr.error.message);
        setFieldErrors(extractFieldErrors(apiErr.error.details));
      } else {
        setGeneralError('Registration failed. Please check your entries and try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-12 bg-slate-50">
      {/* Left Column: Onboarding Steps */}
      <div className="hidden lg:flex lg:col-span-5 bg-gradient-to-br from-[#1e3a8a] via-[#172554] to-[#0f172a] text-[#ffffff] p-12 flex-col justify-between">
        <div>
          <div className="mb-10 space-y-3">
            <BrandLogo className="h-10" priority />
            <div>
              <h1 className="font-bold text-xl tracking-tight">Almaarefa Network</h1>
              <p className="text-xs text-[#bfdbfe]">Student Onboarding &amp; Verification</p>
            </div>
          </div>

          <h2 className="text-3xl font-bold leading-tight mb-4">
            Join the official Almaarefa student community.
          </h2>
          <p className="text-[#dbeafe] text-sm leading-relaxed mb-8">
            Registration matches contract <code>POST /api/v1/auth/register</code> and links your
            account directly to your academic department.
          </p>

          <ol className="space-y-4">
            {[
              {
                step: '1',
                title: 'Register with @mcst.edu.sa Email',
                desc: 'Use your university email and official 9-digit Student ID.',
              },
              {
                step: '2',
                title: 'Upload Student ID Proof',
                desc: 'Submit your university ID card for fast admin verification.',
              },
              {
                step: '3',
                title: 'Collaborate in Courses & Clubs',
                desc: 'Join course groups, share notes, and RSVP to campus events.',
              },
            ].map((item) => (
              <li
                key={item.step}
                className="flex items-start gap-3.5 bg-[#ffffff]/5 border border-[#ffffff]/10 rounded-xl p-4"
              >
                <span className="w-6 h-6 rounded-full bg-brand-500 text-[#ffffff] font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  {item.step}
                </span>
                <div>
                  <h3 className="text-sm font-semibold">{item.title}</h3>
                  <p className="text-xs text-[#bfdbfe] mt-0.5">{item.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="pt-8 border-t border-[#ffffff]/10 text-xs text-[#bfdbfe] flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>Zero third-party data sharing • Saudi privacy law compliant</span>
        </div>
      </div>

      {/* Right Column: Registration Form */}
      <div className="lg:col-span-7 flex flex-col items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-lg flex justify-end mb-4">
          <ThemeSwitcher />
        </div>
        <div className="w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-slate-900">Create Student Account</h2>
            <p className="text-sm text-slate-500 mt-1">
              Exclusive to Almaarefa University students
            </p>
          </div>

          {generalError && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-red-700 text-xs">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{generalError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="fullName"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Full Name
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-slate-400 absolute start-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="fullName"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Turki Al-Harbi"
                    className={cn(
                      'w-full ps-10 pe-3.5 py-2.5 text-sm rounded-xl border bg-white outline-none transition',
                      fieldErrors.fullName
                        ? 'border-red-400'
                        : 'border-slate-300 focus:border-brand-600 focus:ring-2 focus:ring-brand-100'
                    )}
                  />
                </div>
                {fieldErrors.fullName && (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.fullName}</p>
                )}
              </div>

              <div>
                <label
                  htmlFor="studentId"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Student ID
                </label>
                <div className="relative">
                  <Hash className="w-4 h-4 text-slate-400 absolute start-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="studentId"
                    type="text"
                    inputMode="numeric"
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    placeholder="202110234"
                    className={cn(
                      'w-full ps-10 pe-3.5 py-2.5 text-sm rounded-xl border bg-white outline-none transition',
                      fieldErrors.studentId
                        ? 'border-red-400'
                        : 'border-slate-300 focus:border-brand-600 focus:ring-2 focus:ring-brand-100'
                    )}
                  />
                </div>
                {fieldErrors.studentId && (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.studentId}</p>
                )}
              </div>
            </div>

            <div>
              <label
                htmlFor="departmentId"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Academic Department
              </label>
              <div className="relative">
                <Building2 className="w-4 h-4 text-slate-400 absolute start-3.5 top-1/2 -translate-y-1/2" />
                <select
                  id="departmentId"
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  className="w-full ps-10 pe-4 py-2.5 text-sm rounded-xl border border-slate-300 bg-white focus:border-brand-600 focus:ring-2 focus:ring-brand-100 outline-none transition"
                >
                  {departments.map((dept) => (
                    <option key={dept.departmentId} value={dept.departmentId}>
                      {dept.name} ({dept.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label
                htmlFor="universityEmail"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                University Email (@mcst.edu.sa)
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute start-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="universityEmail"
                  type="email"
                  value={universityEmail}
                  onChange={(e) => setUniversityEmail(e.target.value)}
                  placeholder="s123456@mcst.edu.sa"
                  className={cn(
                    'w-full ps-10 pe-4 py-2.5 text-sm rounded-xl border bg-white outline-none transition',
                    fieldErrors.universityEmail
                      ? 'border-red-400'
                      : 'border-slate-300 focus:border-brand-600 focus:ring-2 focus:ring-brand-100'
                  )}
                />
              </div>
              {fieldErrors.universityEmail && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.universityEmail}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute start-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  className={cn(
                    'w-full ps-10 pe-4 py-2.5 text-sm rounded-xl border bg-white outline-none transition',
                    fieldErrors.password
                      ? 'border-red-400'
                      : 'border-slate-300 focus:border-brand-600 focus:ring-2 focus:ring-brand-100'
                  )}
                />
              </div>
              {fieldErrors.password && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.password}</p>
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
                  <span>Creating Student Account...</span>
                </>
              ) : (
                <>
                  <span>Complete Registration</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-100 text-center text-xs text-slate-600">
            Already have a verified account?{' '}
            <Link
              href="/login"
              className="font-semibold text-brand-700 hover:text-brand-800 underline"
            >
              Sign in here
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

