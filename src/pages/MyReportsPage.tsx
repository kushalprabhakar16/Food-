import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase, Report } from '@/lib/supabase';
import { PageHeader, LoadingSpinner, StatusBadge, EmptyState } from '@/components/ui';
import { ClipboardList, FileText, Search, Filter } from 'lucide-react';
import { Link } from 'react-router-dom';

export function MyReportsPage() {
  const { user } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchReports = useCallback(async () => {
    if (!user?.inspector_id) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('reports')
      .select('*')
      .eq('inspector_id', user.inspector_id)
      .order('created_at', { ascending: false });
    setReports((data as Report[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const filteredReports = reports.filter((r) => {
    const matchesSearch =
      r.report_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.establishment_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) return <LoadingSpinner text="Loading your reports..." />;

  const stats = {
    total: reports.length,
    pending: reports.filter((r) => r.status === 'pending').length,
    assigned: reports.filter((r) => r.status === 'assigned').length,
    inProgress: reports.filter((r) => r.status === 'in_progress').length,
    resolved: reports.filter((r) => r.status === 'resolved').length,
  };

  return (
    <div>
      <PageHeader
        title="My Submitted Reports"
        subtitle="Track all reports you have submitted"
        icon={ClipboardList}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {[
          { label: 'Total', value: stats.total, color: 'text-navy-900' },
          { label: 'Pending', value: stats.pending, color: 'text-amber-600' },
          { label: 'Assigned', value: stats.assigned, color: 'text-blue-600' },
          { label: 'In Progress', value: stats.inProgress, color: 'text-purple-600' },
          { label: 'Resolved', value: stats.resolved, color: 'text-green-600' },
        ].map((stat) => (
          <div key={stat.label} className="card p-4">
            <p className="text-xs text-navy-500">{stat.label}</p>
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card p-4 mb-4 flex flex-wrap gap-3">
        <div className="flex-1 min-w-[200px] relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field pl-10"
            placeholder="Search by report ID or establishment..."
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-navy-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input-field"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="assigned">Assigned</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {filteredReports.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No Reports Found"
          message={reports.length === 0 ? "You haven't submitted any reports yet. Click 'Submit Report' to file your first inspection." : "No reports match your filters."}
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-navy-50">
                <tr className="text-left">
                  <th className="px-4 py-3 font-medium text-navy-500">Report ID</th>
                  <th className="px-4 py-3 font-medium text-navy-500">Establishment</th>
                  <th className="px-4 py-3 font-medium text-navy-500">Category</th>
                  <th className="px-4 py-3 font-medium text-navy-500">Priority</th>
                  <th className="px-4 py-3 font-medium text-navy-500">Status</th>
                  <th className="px-4 py-3 font-medium text-navy-500">Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredReports.map((report) => (
                  <tr key={report.id} className="border-t border-navy-50 hover:bg-navy-50/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-navy-700">{report.report_id}</td>
                    <td className="px-4 py-3 text-navy-700">{report.establishment_name}</td>
                    <td className="px-4 py-3"><StatusBadge>{report.category || 'UNKNOWN'}</StatusBadge></td>
                    <td className="px-4 py-3"><StatusBadge>{report.priority}</StatusBadge></td>
                    <td className="px-4 py-3"><StatusBadge>{report.status}</StatusBadge></td>
                    <td className="px-4 py-3 text-navy-500 text-xs">{new Date(report.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-4">
        <Link to="/reports/submit" className="btn-primary inline-flex items-center gap-2">
          <FileText size={18} /> Submit New Report
        </Link>
      </div>
    </div>
  );
}
