import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase, Report, Officer, Zone } from '@/lib/supabase';
import { StatCard, LoadingSpinner, PageHeader, StatusBadge, EmptyState } from '@/components/ui';
import { LayoutDashboard, FileText, Clock, CheckCircle2, AlertTriangle, TrendingUp, Activity, Users, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';

const ROLE_LABELS: Record<string, string> = {
  administrator: 'Administrator',
  inspector: 'Food Inspector',
  district_officer: 'District Regulatory Officer',
  deputy_officer: 'Deputy Officer',
  general_user: 'General User',
};

export function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ total: 0, pending: 0, assigned: 0, inProgress: 0, resolved: 0 });
  const [recentReports, setRecentReports] = useState<Report[]>([]);
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);

    let reportQuery = supabase.from('reports').select('*');
    if (user?.role === 'inspector') {
      reportQuery = reportQuery.eq('inspector_id', user.inspector_id || '');
    } else if (user?.role === 'district_officer' || user?.role === 'deputy_officer') {
      // Officers see assigned reports - we'll fetch all and filter
    }

    const { data: reports } = await reportQuery.order('created_at', { ascending: false }).limit(10);

    const { count: total } = await supabase.from('reports').select('*', { count: 'exact', head: true });
    const { count: pending } = await supabase.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'pending');
    const { count: assigned } = await supabase.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'assigned');
    const { count: inProgress } = await supabase.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'in_progress');
    const { count: resolved } = await supabase.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'resolved');

    const { data: officerData } = await supabase.from('officers').select('*');
    const { data: zoneData } = await supabase.from('zones').select('*');

    setStats({
      total: total || 0,
      pending: pending || 0,
      assigned: assigned || 0,
      inProgress: inProgress || 0,
      resolved: resolved || 0,
    });
    setRecentReports((reports as Report[]) || []);
    setOfficers((officerData as Officer[]) || []);
    setZones((zoneData as Zone[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) return <LoadingSpinner text="Loading dashboard..." />;
  if (!user) return null;

  const roleLabel = ROLE_LABELS[user.role] || user.role;

  return (
    <div>
      <PageHeader
        title={`Welcome, ${user.full_name.split(' ')[0]}`}
        subtitle={`You are signed in as ${roleLabel}`}
        icon={LayoutDashboard}
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <StatCard title="Total Reports" value={stats.total} icon={FileText} color="navy" />
        <StatCard title="Pending" value={stats.pending} icon={Clock} color="amber" />
        <StatCard title="Assigned" value={stats.assigned} icon={Users} color="blue" />
        <StatCard title="In Progress" value={stats.inProgress} icon={Activity} color="orange" />
        <StatCard title="Resolved" value={stats.resolved} icon={CheckCircle2} color="green" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Reports */}
        <div className="lg:col-span-2 card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-navy-900">Recent Reports</h3>
            <Link to="/reports/track" className="text-sm text-lightblue-700 hover:text-lightblue-800 font-medium">
              View all →
            </Link>
          </div>
          {recentReports.length === 0 ? (
            <EmptyState icon={FileText} title="No reports yet" message="Reports will appear here once they are submitted." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-navy-100">
                    <th className="pb-2 font-medium text-navy-500">Report ID</th>
                    <th className="pb-2 font-medium text-navy-500">Establishment</th>
                    <th className="pb-2 font-medium text-navy-500">Category</th>
                    <th className="pb-2 font-medium text-navy-500">Status</th>
                    <th className="pb-2 font-medium text-navy-500">Priority</th>
                  </tr>
                </thead>
                <tbody>
                  {recentReports.slice(0, 8).map((report) => (
                    <tr key={report.id} className="border-b border-navy-50 hover:bg-navy-50/50">
                      <td className="py-2.5 font-mono text-xs text-navy-700">{report.report_id}</td>
                      <td className="py-2.5 text-navy-700 truncate max-w-[160px]">{report.establishment_name}</td>
                      <td className="py-2.5"><StatusBadge>{report.category || 'UNKNOWN'}</StatusBadge></td>
                      <td className="py-2.5"><StatusBadge>{report.status}</StatusBadge></td>
                      <td className="py-2.5"><StatusBadge>{report.priority}</StatusBadge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Quick Stats Sidebar */}
        <div className="space-y-4">
          {/* Officer workload overview */}
          <div className="card p-5">
            <h3 className="font-semibold text-navy-900 mb-3 flex items-center gap-2">
              <Users size={18} className="text-navy-500" /> Officer Workload
            </h3>
            {officers.length === 0 ? (
              <p className="text-sm text-navy-400">No officers registered yet.</p>
            ) : (
              <div className="space-y-2.5">
                {officers.slice(0, 5).map((officer) => (
                  <div key={officer.id}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-navy-700 truncate max-w-[120px]">{officer.officer_name}</span>
                      <span className="text-xs text-navy-500">{officer.current_workload}/{officer.capacity}</span>
                    </div>
                    <div className="w-full bg-navy-100 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full transition-all ${
                          officer.current_workload >= officer.capacity ? 'bg-red-500' :
                          officer.current_workload >= officer.capacity * 0.7 ? 'bg-amber-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${Math.min((officer.current_workload / officer.capacity) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Zones overview */}
          <div className="card p-5">
            <h3 className="font-semibold text-navy-900 mb-3 flex items-center gap-2">
              <MapPin size={18} className="text-navy-500" /> Routing Zones
            </h3>
            {zones.length === 0 ? (
              <p className="text-sm text-navy-400">No zones configured.</p>
            ) : (
              <div className="space-y-2">
                {zones.map((zone) => (
                  <div key={zone.id} className="flex items-center justify-between text-sm">
                    <span className="text-navy-700">{zone.zone_id}</span>
                    <span className="text-navy-500 text-xs truncate max-w-[140px]">{zone.zone_name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        {(user.role === 'inspector' || user.role === 'administrator') && (
          <Link to="/reports/submit" className="card p-4 hover:shadow-md transition-shadow group">
            <div className="w-10 h-10 rounded-lg bg-lightblue-600 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
              <FileText size={20} className="text-white" />
            </div>
            <p className="font-medium text-navy-900 text-sm">Submit Report</p>
            <p className="text-xs text-navy-500">File a new inspection</p>
          </Link>
        )}
        <Link to="/reports/track" className="card p-4 hover:shadow-md transition-shadow group">
          <div className="w-10 h-10 rounded-lg bg-navy-700 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
            <TrendingUp size={20} className="text-white" />
          </div>
          <p className="font-medium text-navy-900 text-sm">Track Report</p>
          <p className="text-xs text-navy-500">Search by report ID</p>
        </Link>
        <Link to="/dfa" className="card p-4 hover:shadow-md transition-shadow group">
          <div className="w-10 h-10 rounded-lg bg-navy-500 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
            <Activity size={20} className="text-white" />
          </div>
          <p className="font-medium text-navy-900 text-sm">DFA Validator</p>
          <p className="text-xs text-navy-500">Test ID validation</p>
        </Link>
        {user.role === 'administrator' && (
          <Link to="/analytics" className="card p-4 hover:shadow-md transition-shadow group">
            <div className="w-10 h-10 rounded-lg bg-navy-900 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
              <AlertTriangle size={20} className="text-white" />
            </div>
            <p className="font-medium text-navy-900 text-sm">Analytics</p>
            <p className="text-xs text-navy-500">View insights</p>
          </Link>
        )}
      </div>
    </div>
  );
}
