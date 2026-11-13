import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { supabase, Report, Officer, Zone } from '@/lib/supabase';
import { updateReportStatus } from '@/lib/reportService';
import { PageHeader, LoadingSpinner, StatusBadge, EmptyState, StatCard } from '@/components/ui';
import { Shield, FileText, Clock, CheckCircle2, Activity, User, TrendingUp } from 'lucide-react';

export function HandlerDashboardPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [reports, setReports] = useState<Report[]>([]);
  const [officer, setOfficer] = useState<Officer | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<'assigned' | 'in_progress' | 'resolved'>('assigned');

  const fetchData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    // Find officer record linked to this user
    const { data: officerData } = await supabase
      .from('officers')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    let officerRecord = officerData as Officer | null;

    // If no officer record exists, try by email
    if (!officerRecord) {
      const { data: officerByEmail } = await supabase
        .from('officers')
        .select('*')
        .eq('email', user.email)
        .maybeSingle();
      officerRecord = officerByEmail as Officer | null;
    }

    setOfficer(officerRecord);

    const { data: zoneData } = await supabase.from('zones').select('*');
    setZones((zoneData as Zone[]) || []);

    if (officerRecord) {
      const { data: reportData } = await supabase
        .from('reports')
        .select('*')
        .eq('assigned_officer_id', officerRecord.id)
        .order('created_at', { ascending: false });
      setReports((reportData as Report[]) || []);
    }

    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleStatusUpdate = async (report: Report, newStatus: 'in_progress' | 'resolved') => {
    setActionLoading(true);
    const remark = remarks[report.id] || '';
    const { error } = await updateReportStatus(
      report.id,
      newStatus,
      user?.id || '',
      user?.full_name || 'Officer',
      remark,
      report.status,
      report.assigned_officer_id,
    );

    if (error) {
      showToast(error, 'error');
    } else {
      showToast(`Report marked as ${newStatus.replace('_', ' ')}`, 'success');
      setRemarks((prev) => ({ ...prev, [report.id]: '' }));
      fetchData();
    }
    setActionLoading(false);
  };

  const handleAvailabilityChange = async (newAvailability: string) => {
    if (!officer) return;
    const { error } = await supabase
      .from('officers')
      .update({ availability: newAvailability, updated_at: new Date().toISOString() })
      .eq('id', officer.id);
    if (error) {
      showToast(error.message, 'error');
    } else {
      showToast(`Availability updated to ${newAvailability.replace('_', ' ')}`, 'success');
      fetchData();
    }
  };

  if (loading) return <LoadingSpinner text="Loading handler dashboard..." />;

  if (!officer) {
    return (
      <div>
        <PageHeader title="Handler Dashboard" icon={Shield} />
        <EmptyState
          icon={Shield}
          title="No Officer Profile"
          message="Your account is not linked to an officer record. Please contact an administrator to set up your officer profile."
        />
      </div>
    );
  }

  const stats = {
    assigned: reports.filter((r) => r.status === 'assigned').length,
    inProgress: reports.filter((r) => r.status === 'in_progress').length,
    resolved: reports.filter((r) => r.status === 'resolved').length,
    remaining: officer.capacity - officer.current_workload,
  };

  const filteredReports = reports.filter((r) => {
    if (activeTab === 'assigned') return r.status === 'assigned';
    if (activeTab === 'in_progress') return r.status === 'in_progress';
    if (activeTab === 'resolved') return r.status === 'resolved';
    return false;
  });

  return (
    <div>
      <PageHeader
        title="Handler Dashboard"
        subtitle={`${officer.officer_name} · ${officer.officer_type === 'district' ? 'District Officer' : 'Deputy Officer'}`}
        icon={Shield}
      />

      {/* Officer status bar */}
      <div className="card p-4 mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <div>
            <p className="text-xs text-navy-500">Current Workload</p>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-navy-900">{officer.current_workload}</span>
              <span className="text-sm text-navy-400">/ {officer.capacity}</span>
            </div>
          </div>
          <div className="w-32">
            <div className="w-full bg-navy-100 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  officer.current_workload >= officer.capacity ? 'bg-red-500' :
                  officer.current_workload >= officer.capacity * 0.7 ? 'bg-amber-500' : 'bg-green-500'
                }`}
                style={{ width: `${Math.min((officer.current_workload / officer.capacity) * 100, 100)}%` }}
              />
            </div>
          </div>
          <div>
            <p className="text-xs text-navy-500">Availability</p>
            <StatusBadge>{officer.availability}</StatusBadge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-navy-500">Change:</label>
          <select
            value={officer.availability}
            onChange={(e) => handleAvailabilityChange(e.target.value)}
            className="input-field text-sm py-1.5"
          >
            <option value="available">Available</option>
            <option value="unavailable">Unavailable</option>
            <option value="on_leave">On Leave</option>
          </select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard title="Assigned" value={stats.assigned} icon={FileText} color="blue" />
        <StatCard title="In Progress" value={stats.inProgress} icon={Activity} color="orange" />
        <StatCard title="Resolved" value={stats.resolved} icon={CheckCircle2} color="green" />
        <StatCard title="Remaining Capacity" value={stats.remaining} icon={TrendingUp} color="navy" />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {[
          { key: 'assigned' as const, label: 'Assigned', count: stats.assigned },
          { key: 'in_progress' as const, label: 'In Progress', count: stats.inProgress },
          { key: 'resolved' as const, label: 'Resolved', count: stats.resolved },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.key ? 'bg-navy-900 text-white' : 'bg-white text-navy-600 hover:bg-navy-50 border border-navy-100'
            }`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Reports list */}
      {filteredReports.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={`No ${activeTab.replace('_', ' ')} reports`}
          message={activeTab === 'assigned' ? "You have no new assignments. New reports will appear here when dispatched to you." : `No ${activeTab.replace('_', ' ')} reports to display.`}
        />
      ) : (
        <div className="space-y-4">
          {filteredReports.map((report) => {
            const reportZone = zones.find((z) => z.id === report.zone_id);
            return (
              <div key={report.id} className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono font-semibold text-navy-900 text-sm">{report.report_id}</span>
                      <StatusBadge>{report.status}</StatusBadge>
                      <StatusBadge>{report.category || 'UNKNOWN'}</StatusBadge>
                      <StatusBadge>{report.priority}</StatusBadge>
                    </div>
                    <p className="text-sm text-navy-700 font-medium">{report.establishment_name}</p>
                    <p className="text-xs text-navy-500">{report.inspection_location} · PIN: {report.pin_code} · {reportZone?.zone_name || 'Unzoned'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-navy-400">Submitted</p>
                    <p className="text-xs text-navy-600">{new Date(report.created_at).toLocaleDateString()}</p>
                  </div>
                </div>

                <div className="bg-navy-50 rounded-lg p-3 mb-3">
                  <p className="text-xs text-navy-500 mb-1">Violation</p>
                  <p className="text-sm text-navy-700">
                    <span className="font-mono font-semibold">{report.violation_code}</span> — {report.violation_description}
                  </p>
                </div>

                {/* Action area */}
                {report.status !== 'resolved' && (
                  <div className="flex flex-wrap items-center gap-3">
                    <input
                      type="text"
                      value={remarks[report.id] || ''}
                      onChange={(e) => setRemarks((prev) => ({ ...prev, [report.id]: e.target.value }))}
                      className="input-field flex-1 text-sm"
                      placeholder="Add remarks for this action..."
                    />
                    {report.status === 'assigned' && (
                      <button
                        onClick={() => handleStatusUpdate(report, 'in_progress')}
                        disabled={actionLoading}
                        className="btn-secondary text-sm flex items-center gap-2"
                      >
                        <Activity size={16} /> Accept & Start
                      </button>
                    )}
                    {report.status === 'in_progress' && (
                      <button
                        onClick={() => handleStatusUpdate(report, 'resolved')}
                        disabled={actionLoading}
                        className="btn-primary text-sm flex items-center gap-2"
                      >
                        <CheckCircle2 size={16} /> Mark Resolved
                      </button>
                    )}
                  </div>
                )}

                {report.status === 'resolved' && report.resolution_remarks && (
                  <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                    <p className="text-xs text-green-700 font-medium mb-1">Resolution Remarks</p>
                    <p className="text-sm text-green-800">{report.resolution_remarks}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
