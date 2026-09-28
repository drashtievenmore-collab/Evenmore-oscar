import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Infinity as InfinityIcon,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Building2,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  HelpCircle,
  ChevronDown,
} from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { login as loginRequest } from '../../services/authService';
import { describeError } from '../../services/resourceSync';
import { getStoredToken } from '../../utils/authUtils';
import LoginShowroomBackground from './LoginShowroomBackground';
import './login-showroom.css';

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('returnTo') || '/dashboard';

  const setCurrentUser = useAppStore((s) => s.setCurrentUser);
  const setPermissions = useAppStore((s) => s.setPermissions);
  const showToast = useAppStore((s) => s.showToast);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  // Empty by default: the server resolves the tenant from the email address and
  // only needs a slug when the same address exists in more than one tenant
  // (api.md §2).
  const [tenant, setTenant] = useState('');
  const [showTenant, setShowTenant] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  useEffect(() => {
    const existingToken = getStoredToken();
    if (existingToken) {
      navigate(returnTo || '/dashboard', { replace: true });
    }
  }, [navigate, returnTo]);

  const handleLoginSubmit = async (e) => {
    e?.preventDefault();
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const { user, permissions } = await loginRequest({
        email,
        password,
        tenant,
        remember: rememberMe,
      });

      setCurrentUser(user);
      setPermissions(permissions);

      showToast?.(`Signed in successfully as ${user?.name || email}`);
      navigate(returnTo, { replace: true });
    } catch (err) {
      setError(describeError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotSubmit = (e) => {
    e.preventDefault();
    if (!forgotEmail.trim()) return;
    setForgotSent(true);
  };

  return (
    <div className="min-h-screen w-full relative overflow-hidden font-sans bg-[#f3efe8] text-slate-900">
      <LoginShowroomBackground />

      {/* Center stage: card docked right like the reference */}
      <main className="relative z-10 min-h-screen w-full max-w-[1440px] mx-auto px-4 sm:px-8 py-8 flex items-center justify-center lg:justify-end">
        <div className="w-full max-w-[420px] bg-white rounded-[24px] px-6 py-7 sm:px-8 sm:py-8 shadow-[0_24px_70px_rgba(30,50,90,0.18)] border border-white">
          {/* Logo */}
          <div className="text-center">
            <div className="flex justify-center">
              <div className="relative inline-flex items-center justify-center">
                <InfinityIcon size={64} strokeWidth={2.4} className="text-[#1f7aff]" />
                <span className="absolute -right-1 top-1 flex gap-[3px]">
                  <i className="w-[5px] h-[5px] rounded-full bg-[#1f7aff] block" />
                  <i className="w-[4px] h-[4px] rounded-full bg-[#1f7aff]/70 block mt-[6px]" />
                </span>
                <span className="absolute right-[2px] top-[18px] flex gap-[3px]">
                  <i className="w-[4px] h-[4px] rounded-full bg-[#1f7aff]/80 block" />
                  <i className="w-[3px] h-[3px] rounded-full bg-[#1f7aff]/60 block" />
                </span>
              </div>
            </div>
            <div className="text-[32px] leading-none font-extrabold tracking-tight text-[#0f2743] -mt-1">
              Oscar
            </div>
            <h1 className="mt-4 text-[24px] font-extrabold tracking-tight text-[#0f2743]">
              Welcome Back
            </h1>
            <p className="mt-1 text-[13px] text-slate-500">Sign in to your account</p>
          </div>

          {error && (
            <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs flex items-start gap-2">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{error}</div>
            </div>
          )}

          <form onSubmit={handleLoginSubmit} className="mt-5 space-y-3">
            <div className="relative flex items-center">
              <Mail size={16} className="absolute left-3.5 text-slate-500 pointer-events-none" />
              <input
                type="text"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email Address or Username"
                className="w-full bg-white border border-slate-200 rounded-xl py-3 pl-10 pr-3.5 text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div className="relative flex items-center">
              <Lock size={16} className="absolute left-3.5 text-slate-500 pointer-events-none" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full bg-white border border-slate-200 rounded-xl py-3 pl-10 pr-10 text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 text-slate-500 hover:text-slate-800 p-0.5 cursor-pointer"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            <div className="flex justify-end -mt-1">
              <button
                type="button"
                onClick={() => setIsForgotModalOpen(true)}
                className="text-[12px] font-medium text-[#1f7aff] hover:underline cursor-pointer"
              >
                Forgot password?
              </button>
            </div>

            <div>
              <button
                type="button"
                onClick={() => setShowTenant(!showTenant)}
                className="w-full flex items-center gap-2 bg-white border border-slate-200 rounded-xl py-3 px-3.5 text-[13px] text-slate-500 hover:border-slate-300 cursor-pointer"
              >
                <Building2 size={16} className="shrink-0" />
                <span className="flex-1 text-left truncate">
                  {tenant ? tenant : 'Custom workspace / tenant domain'}
                </span>
                <ChevronDown size={16} className={`shrink-0 transition-transform ${showTenant ? 'rotate-180' : ''}`} />
              </button>
              {showTenant && (
                <div className="mt-2">
                  <input
                    type="text"
                    value={tenant}
                    onChange={(e) => setTenant(e.target.value)}
                    placeholder="Tenant identifier (e.g. evenmore-main)"
                    className="w-full bg-white border border-slate-200 rounded-xl py-2.5 px-3 text-[13px] focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              )}
            </div>

            <label className="flex items-center gap-2 cursor-pointer select-none pt-1">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded accent-blue-600 cursor-pointer"
              />
              <span className="text-[12px] font-medium text-slate-700">Keep me signed in on this device</span>
            </label>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-b from-[#3b8bff] to-[#1663ff] hover:from-[#2f80ff] hover:to-[#0f56f5] text-white font-semibold text-[15px] shadow-[0_10px_25px_rgba(37,110,255,0.4)] flex items-center justify-center gap-3 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Sign In to Workspace</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-[12px]">
            <span className="text-slate-500">Need access assistance?</span>
            <button
              type="button"
              onClick={() => setIsHelpOpen(true)}
              className="text-[#1f7aff] font-semibold hover:underline flex items-center gap-1.5 cursor-pointer"
            >
              <HelpCircle size={14} />
              <span>IT Helpdesk</span>
            </button>
          </div>
        </div>
      </main>

      {isForgotModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
          onClick={(e) => { if (e.target === e.currentTarget) setIsForgotModalOpen(false); }}
        >
          <div className="w-full max-w-sm bg-white rounded-2xl p-6 shadow-2xl">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center mb-3">
              <KeyRound size={20} />
            </div>
            <h3 className="text-base font-bold text-slate-900">Reset Your Password</h3>
            <p className="text-xs text-slate-500 mt-1 mb-4 leading-relaxed">
              Enter your corporate email address. If an account is active, your system administrator will issue password reset credentials.
            </p>
            {forgotSent ? (
              <div className="space-y-4">
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 text-xs flex items-center gap-2">
                  <CheckCircle2 size={16} className="shrink-0" />
                  <span>Recovery link generated. Please check your inbox or notify your workspace administrator.</span>
                </div>
                <button
                  type="button"
                  onClick={() => { setIsForgotModalOpen(false); setForgotSent(false); }}
                  className="w-full py-2 rounded-xl bg-slate-100 text-slate-800 text-xs font-semibold hover:bg-slate-200 cursor-pointer"
                >
                  Return to Sign In
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotSubmit} className="space-y-3">
                <input
                  type="email"
                  required
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-blue-500"
                />
                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={() => setIsForgotModalOpen(false)} className="flex-1 py-2 rounded-xl bg-slate-100 text-xs font-semibold hover:bg-slate-200 cursor-pointer">
                    Cancel
                  </button>
                  <button type="submit" className="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer">
                    Send Instructions
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {isHelpOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
          onClick={(e) => { if (e.target === e.currentTarget) setIsHelpOpen(false); }}
        >
          <div className="w-full max-w-sm bg-white rounded-2xl p-6 shadow-2xl">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center mb-3">
              <HelpCircle size={20} />
            </div>
            <h3 className="text-base font-bold text-slate-900">Enterprise IT Helpdesk</h3>
            <div className="text-xs text-slate-500 mt-2 space-y-2.5 leading-relaxed">
              <p>For immediate credentials assistance, account lockouts, or role authorization requests:</p>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 text-[11px] font-mono">
                <p><span className="font-semibold">Email:</span> support@evenmore.io</p>
                <p><span className="font-semibold">Ext:</span> +91 (022) 4800-ERP1</p>
                <p><span className="font-semibold">Hours:</span> 24/7 Operations Desk</p>
              </div>
            </div>
            <div className="mt-5">
              <button type="button" onClick={() => setIsHelpOpen(false)} className="w-full py-2 rounded-xl bg-slate-100 text-xs font-semibold hover:bg-slate-200 cursor-pointer">
                Close Window
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
