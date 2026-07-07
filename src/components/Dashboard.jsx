import { useNavigate } from 'react-router-dom';
import { LogOut, Calendar } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { useToast } from '../Toast';
import { todayDateString } from '../utils';
import { FlowTracker } from '../FlowTracker';

export function DashboardHeader({ role }) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const toast = useToast();

  const handleLogout = async () => {
    await logout();
    toast.show('Logged out successfully', 'success');
    navigate('/login');
  };

  const fullName = user
    ? `${user.firstName} ${user.lastName}`.trim() || role.fullName
    : role.fullName;
  const staffId = user?.staffId || role.staffId;

  return (
    <header className={`bg-${role.color}-600 text-white shadow-md`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">{role.name} Dashboard</h1>
          <p className="text-sm text-white/80 flex items-center gap-1.5 mt-0.5">
            <Calendar className="w-3.5 h-3.5" />
            {todayDateString()}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-medium">
              Logged in as {fullName}
            </p>
            <p className="text-xs text-white/70">{staffId}</p>
          </div>
          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 bg-white/15 hover:bg-white/25 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}

export function DashboardShell({ role, stats, children }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <DashboardHeader role={role} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <FlowTracker />
        {stats && <StatsRow stats={stats} role={role} />}
        {children}
      </div>
    </div>
  );
}

export function StatsRow({ stats, role }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((s) => {
        const Icon = s.icon;
        return (
          <div
            key={s.label}
            className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{s.label}</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  {s.value}
                </p>
              </div>
              <div
                className={`w-11 h-11 rounded-xl flex items-center justify-center bg-${s.color || role.color}-100 text-${s.color || role.color}-600`}
              >
                <Icon className="w-5 h-5" />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="border-b border-gray-200 overflow-x-auto">
      <nav className="flex gap-1 min-w-max">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              active === t.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

export function EmptyState({ message = 'No records found' }) {
  return (
    <div className="text-center py-12 text-gray-400">
      <p className="text-sm">{message}</p>
    </div>
  );
}

export function StatusBadge({ status }) {
  const map = {
    Paid: 'bg-green-100 text-green-700',
    Pending: 'bg-amber-100 text-amber-700',
    'In Stock': 'bg-green-100 text-green-700',
    'Low Stock': 'bg-yellow-100 text-yellow-700',
    'Out of Stock': 'bg-red-100 text-red-700',
    Emergency: 'bg-red-100 text-red-700',
    Urgent: 'bg-orange-100 text-orange-700',
    'Semi-Urgent': 'bg-yellow-100 text-yellow-700',
    'Non-Urgent': 'bg-green-100 text-green-700',
    Normal: 'bg-green-100 text-green-700',
    Abnormal: 'bg-yellow-100 text-yellow-700',
    Critical: 'bg-red-100 text-red-700',
    Completed: 'bg-green-100 text-green-700',
    'In Progress': 'bg-blue-100 text-blue-700',
    'Waiting for Lab Payment': 'bg-red-100 text-red-700',
    'Waiting for Final Payment': 'bg-red-100 text-red-700',
    'Results Ready': 'bg-orange-100 text-orange-700',
    'Approved': 'bg-green-100 text-green-700',
    'Rejected': 'bg-red-100 text-red-700',
  };
  const cls = map[status] || 'bg-gray-100 text-gray-700';
  return (
    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${cls}`}>
      {status || '—'}
    </span>
  );
}
