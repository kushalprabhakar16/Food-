import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { supabase } from '@/lib/supabase';
import { UserRole } from '@/lib/supabase';
import { Shield, Mail, Lock, User, Eye, EyeOff, Loader2, Building2 } from 'lucide-react';

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'administrator', label: 'Administrator' },
  { value: 'inspector', label: 'Food Inspector' },
  { value: 'district_officer', label: 'District Regulatory Officer' },
  { value: 'deputy_officer', label: 'Deputy Officer' },
  { value: 'general_user', label: 'General User' },
];

export function LoginPage() {
  const navigate = useNavigate();
  const { signIn, signUp } = useAuth();
  const { showToast } = useToast();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>('inspector');
  const [inspectorId, setInspectorId] = useState('');
  const [contact, setContact] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (mode === 'login') {
      const { error } = await signIn(email, password);
      if (error) {
        showToast(error, 'error');
        setLoading(false);
        return;
      }
      showToast('Login successful', 'success');
      navigate('/dashboard');
    } else {
      if (role === 'inspector' && !inspectorId) {
        showToast('Inspector ID is required for inspector role', 'warning');
        setLoading(false);
        return;
      }
      const { error } = await signUp(email, password, fullName, role, inspectorId, contact);
      if (error) {
        showToast(error, 'error');
        setLoading(false);
        return;
      }
      showToast('Account created successfully. Please sign in.', 'success');
      setMode('login');
      setPassword('');
      setLoading(false);
    }
  };

  const fillDemoCredentials = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('Demo1234!');
    setMode('login');
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-navy-900 text-white p-12 flex-col justify-between relative overflow-hidden">
        {/* Decorative shapes */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-lightblue-900/30 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-lightblue-700/20 rounded-full translate-y-1/2 -translate-x-1/3 blur-2xl" />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-lightblue-600 flex items-center justify-center">
              <Shield size={26} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">FOOD SAFETY</h1>
              <p className="text-sm text-lightblue-300">INSPECTION PORTAL</p>
            </div>
          </div>
        </div>

        <div className="relative z-10 space-y-6">
          <h2 className="text-4xl font-bold leading-tight">
            Smart Inspection,<br />
            Intelligent Classification<br />
            & Automated Case Dispatch
          </h2>
          <p className="text-navy-300 text-lg max-w-md">
            A comprehensive government-grade platform for food safety inspections with
            DFA-based validation, automated routing, and real-time analytics.
          </p>
          <div className="space-y-3 pt-4">
            {[
              'DFA & Regex dual validation engine',
              'Automated report classification',
              'Intelligent officer dispatch routing',
              'Real-time analytics & dashboards',
            ].map((feature) => (
              <div key={feature} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-lightblue-600 flex items-center justify-center flex-shrink-0">
                  <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-navy-200 text-sm">{feature}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 text-xs text-navy-400">
          Government of India &middot; Food Safety & Standards Authority
        </div>
      </div>

      {/* Right panel - Form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-navy-50">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-10 h-10 rounded-xl bg-navy-900 flex items-center justify-center">
              <Shield size={22} className="text-lightblue-400" />
            </div>
            <div>
              <h1 className="text-base font-bold text-navy-900">FOOD SAFETY</h1>
              <p className="text-xs text-navy-500">INSPECTION PORTAL</p>
            </div>
          </div>

          <div className="card p-8">
            <h2 className="text-2xl font-bold text-navy-900 mb-1">
              {mode === 'login' ? 'Welcome Back' : 'Create Account'}
            </h2>
            <p className="text-sm text-navy-500 mb-6">
              {mode === 'login'
                ? 'Sign in to your inspection portal account'
                : 'Register for a new portal account'}
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'register' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-navy-700 mb-1.5">Full Name</label>
                    <div className="relative">
                      <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-400" />
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="input-field pl-10"
                        placeholder="John Doe"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-navy-700 mb-1.5">Role</label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value as UserRole)}
                      className="input-field"
                    >
                      {ROLE_OPTIONS.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  </div>

                  {role === 'inspector' && (
                    <div>
                      <label className="block text-sm font-medium text-navy-700 mb-1.5">
                        Inspector ID <span className="text-xs text-navy-400">(Format: INS[A-Z][A-Z][0-9]{4})</span>
                      </label>
                      <input
                        type="text"
                        value={inspectorId}
                        onChange={(e) => setInspectorId(e.target.value.toUpperCase())}
                        className="input-field uppercase"
                        placeholder="INSAB1234"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-navy-700 mb-1.5">Contact Number</label>
                    <input
                      type="text"
                      value={contact}
                      onChange={(e) => setContact(e.target.value)}
                      className="input-field"
                      placeholder="+91 98765 43210"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-navy-700 mb-1.5">Email Address</label>
                <div className="relative">
                  <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input-field pl-10"
                    placeholder="you@gov.in"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-navy-700 mb-1.5">Password</label>
                <div className="relative">
                  <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-field pl-10 pr-10"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-400 hover:text-navy-600"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full flex items-center justify-center gap-2 py-2.5"
              >
                {loading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : mode === 'login' ? (
                  'Sign In'
                ) : (
                  'Create Account'
                )}
              </button>
            </form>

            <div className="mt-5 text-center">
              <button
                onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
                className="text-sm text-lightblue-700 hover:text-lightblue-800 font-medium"
              >
                {mode === 'login' ? "Don't have an account? Register" : 'Already have an account? Sign in'}
              </button>
            </div>
          </div>

          {/* Demo credentials helper */}
          <div className="mt-4 card p-4">
            <p className="text-xs font-semibold text-navy-600 mb-2 flex items-center gap-1.5">
              <Building2 size={14} /> Demo Accounts (click to fill):
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => fillDemoCredentials('admin@fssai.gov.in')}
                className="text-xs text-left px-2 py-1.5 rounded bg-navy-50 hover:bg-navy-100 text-navy-700 transition-colors"
              >
                Administrator
              </button>
              <button
                onClick={() => fillDemoCredentials('inspector@fssai.gov.in')}
                className="text-xs text-left px-2 py-1.5 rounded bg-navy-50 hover:bg-navy-100 text-navy-700 transition-colors"
              >
                Inspector
              </button>
              <button
                onClick={() => fillDemoCredentials('officer@fssai.gov.in')}
                className="text-xs text-left px-2 py-1.5 rounded bg-navy-50 hover:bg-navy-100 text-navy-700 transition-colors"
              >
                District Officer
              </button>
              <button
                onClick={() => fillDemoCredentials('user@fssai.gov.in')}
                className="text-xs text-left px-2 py-1.5 rounded bg-navy-50 hover:bg-navy-100 text-navy-700 transition-colors"
              >
                General User
              </button>
            </div>
            <p className="text-xs text-navy-400 mt-2">Password for all demo accounts: Demo1234!</p>
          </div>
        </div>
      </div>
    </div>
  );
}
