import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color?: string;
  subtitle?: string;
}

export function StatCard({ title, value, icon: Icon, color = 'navy', subtitle }: StatCardProps) {
  const colorMap: Record<string, string> = {
    navy: 'bg-navy-900 text-white',
    blue: 'bg-lightblue-600 text-white',
    green: 'bg-green-600 text-white',
    red: 'bg-red-600 text-white',
    amber: 'bg-amber-500 text-white',
    orange: 'bg-orange-500 text-white',
    gray: 'bg-navy-500 text-white',
  };

  return (
    <div className="card p-5 animate-slide-up">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-navy-500">{title}</p>
          <p className="text-3xl font-bold text-navy-900 mt-1">{value}</p>
          {subtitle && <p className="text-xs text-navy-400 mt-1">{subtitle}</p>}
        </div>
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${colorMap[color]}`}>
          <Icon size={24} />
        </div>
      </div>
    </div>
  );
}

interface BadgeProps {
  children: ReactNode;
  color?: string;
}

export function StatusBadge({ children, color }: BadgeProps) {
  const colorMap: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    assigned: 'bg-blue-100 text-blue-800 border-blue-300',
    in_progress: 'bg-purple-100 text-purple-800 border-purple-300',
    resolved: 'bg-green-100 text-green-800 border-green-300',
    CRITICAL: 'bg-red-100 text-red-800 border-red-300',
    MAJOR: 'bg-orange-100 text-orange-800 border-orange-300',
    MINOR: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    ADVISORY: 'bg-blue-100 text-blue-800 border-blue-300',
    PASSED: 'bg-green-100 text-green-800 border-green-300',
    UNKNOWN: 'bg-gray-100 text-gray-800 border-gray-300',
    emergency: 'bg-red-600 text-white border-red-700',
    critical: 'bg-orange-600 text-white border-orange-700',
    high: 'bg-amber-500 text-white border-amber-600',
    normal: 'bg-navy-400 text-white border-navy-500',
    available: 'bg-green-100 text-green-800 border-green-300',
    unavailable: 'bg-red-100 text-red-800 border-red-300',
    on_leave: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    district: 'bg-navy-100 text-navy-800 border-navy-300',
    deputy: 'bg-lightblue-100 text-lightblue-800 border-lightblue-300',
    info: 'bg-blue-100 text-blue-800 border-blue-300',
    warning: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    error: 'bg-red-100 text-red-800 border-red-300',
    critical_audit: 'bg-red-600 text-white border-red-700',
  };

  const normalized = typeof children === 'string' ? children.toLowerCase().replace(/\s+/g, '_') : '';
  const badgeColor = color || colorMap[normalized] || 'bg-gray-100 text-gray-800 border-gray-300';

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${badgeColor}`}>
      {children}
    </span>
  );
}

interface LoadingSpinnerProps {
  size?: number;
  text?: string;
}

export function LoadingSpinner({ size = 24, text }: LoadingSpinnerProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div
        className="animate-spin rounded-full border-3 border-navy-200 border-t-navy-700"
        style={{ width: size, height: size, borderWidth: 3 }}
      />
      {text && <p className="mt-3 text-sm text-navy-500">{text}</p>}
    </div>
  );
}

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  message: string;
}

export function EmptyState({ icon: Icon, title, message }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-full bg-navy-100 flex items-center justify-center mb-4">
        <Icon size={32} className="text-navy-400" />
      </div>
      <h3 className="text-lg font-semibold text-navy-700">{title}</h3>
      <p className="text-sm text-navy-500 mt-1 max-w-sm">{message}</p>
    </div>
  );
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  action?: ReactNode;
}

export function PageHeader({ title, subtitle, icon: Icon, action }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="w-10 h-10 rounded-lg bg-navy-900 flex items-center justify-center">
            <Icon size={20} className="text-white" />
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold text-navy-900">{title}</h1>
          {subtitle && <p className="text-sm text-navy-500">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}
