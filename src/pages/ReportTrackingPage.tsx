import { useState } from 'react';
import { supabase, Report, StatusHistory, Zone, Officer } from '@/lib/supabase';
import { PageHeader, LoadingSpinner, StatusBadge, EmptyState } from '@/components/ui';
import { Search, FileSearch, Clock, MapPin, User, Calendar, History, CheckCircle2 } from 'lucide-react';

export function ReportTrackingPage() {
  const [searchId, setSearchId] = useState('');
  const [report, setReport] = useState<Report | null>(null);
  const [history, setHistory] = useState<StatusHistory[]>([]);
  const [zone, setZone] = useState<Zone | null>(null);
  const [officer, setOfficer] = useState<Officer | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (!searchId.trim()) return;
    setLoading(true);
    setSearched(true);

    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .eq('report_id', searchId.trim())
      .maybeSingle();

    if (error || !data) {
      setReport(null);
      setHistory([]);
      setLoading(false);
      return;
    }

    const reportData = data as Report;
    setReport(reportData);

    // Fetch related data
    if (reportData.zone_id) {
      const { data: zoneData } = await supabase.from('zones').select('*').eq('id', reportData.zone_id).maybeSingle();
      setZone(zoneData as Zone | null);
    } else {
      setZone(null);
    }

    if (reportData.assigned_officer_id) {
      const { data: officerData } = await supabase.from('officers').select('*').eq('id', reportData.assigned_officer_id).maybeSingle();
      setOfficer(officerData as Officer | null);
    } else {
      setOfficer(null);
    }

    const { data: historyData } = await supabase
      .from('status_history')
      .select('*')
      .eq('report_id', reportData.id)
      .order('created_at', { ascending: true });

    setHistory((historyData as StatusHistory[]) || []);
    setLoading(false);
  };

  return (
    <div>
      <PageHeader
        title="Report Tracking"
        subtitle="Search for an inspection report by its unique Report ID"
        icon={Search}
      />

      {/* Search bar */}
      <div className="card p-5 mb-6">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <FileSearch size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-400" />
            <input
              type="text"
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="input-field pl-10 font-mono"
              placeholder="Enter Report ID (e.g. RPT-20261113-AB12CD)"
            />
          </div>
          <button onClick={handleSearch} disabled={loading} className="btn-primary flex items-center gap-2">
            {loading ? <LoadingSpinner size={18} /> : <Search size={18} />}
            Track
          </button>
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <LoadingSpinner text="Searching for report..." />
      ) : searched && !report ? (
        <EmptyState
          icon={FileSearch}
          title="Report Not Found"
          message={`No report found with ID "${searchId}". Please check the ID and try again.`}
        />
      ) : report ? (
        <div className="space-y-6 animate-slide-up">
          {/* Report details */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-navy-900 text-lg font-mono">{report.report_id}</h3>
                <p className="text-sm text-navy-500">{report.establishment_name}</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <StatusBadge>{report.status}</StatusBadge>
                <StatusBadge>{report.category || 'UNKNOWN'}</StatusBadge>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <MapPin size={18} className="text-navy-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-navy-500">Location</p>
                    <p className="text-sm text-navy-700">{report.inspection_location}</p>
                    <p className="text-xs text-navy-500">PIN: {report.pin_code}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Calendar size={18} className="text-navy-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-navy-500">Inspection Date & Time</p>
                    <p className="text-sm text-navy-700">{report.inspection_date} at {report.inspection_time}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Clock size={18} className="text-navy-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-navy-500">Submitted</p>
                    <p className="text-sm text-navy-700">{new Date(report.created_at).toLocaleString()}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <User size={18} className="text-navy-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-navy-500">Assigned Department</p>
                    <p className="text-sm text-navy-700">{zone?.zone_name || 'Not yet assigned'}</p>
                    {officer && <p className="text-xs text-navy-500">Officer: {officer.officer_name}</p>}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-navy-500 mb-1">Priority</p>
                  <StatusBadge>{report.priority}</StatusBadge>
                </div>
                <div>
                  <p className="text-xs text-navy-500 mb-1">Violation Code</p>
                  <p className="text-sm font-mono text-navy-700">{report.violation_code}</p>
                </div>
              </div>
            </div>

            {report.resolution_remarks && (
              <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
                <p className="text-xs text-green-700 font-medium flex items-center gap-1.5 mb-1">
                  <CheckCircle2 size={14} /> Resolution Information
                </p>
                <p className="text-sm text-green-800">{report.resolution_remarks}</p>
              </div>
            )}

            {report.remarks && (
              <div className="mt-4 p-3 bg-navy-50 rounded-lg">
                <p className="text-xs text-navy-500 mb-1">Supporting Remarks</p>
                <p className="text-sm text-navy-700">{report.remarks}</p>
              </div>
            )}
          </div>

          {/* Status History */}
          <div className="card p-6">
            <h3 className="font-semibold text-navy-900 mb-4 flex items-center gap-2">
              <History size={18} className="text-navy-500" /> Status History
            </h3>
            {history.length === 0 ? (
              <p className="text-sm text-navy-400">No status updates recorded.</p>
            ) : (
              <div className="space-y-4">
                {history.map((entry, index) => (
                  <div key={entry.id} className="flex gap-4">
                    {/* Timeline dot */}
                    <div className="flex flex-col items-center">
                      <div className={`w-3 h-3 rounded-full ${
                        entry.new_status === 'resolved' ? 'bg-green-500' :
                        entry.new_status === 'in_progress' ? 'bg-purple-500' :
                        entry.new_status === 'assigned' ? 'bg-blue-500' : 'bg-yellow-500'
                      }`} />
                      {index < history.length - 1 && <div className="w-0.5 h-12 bg-navy-200" />}
                    </div>
                    {/* Content */}
                    <div className="flex-1 -mt-1">
                      <div className="flex items-center gap-2">
                        <StatusBadge>{entry.new_status}</StatusBadge>
                        {entry.previous_status && (
                          <span className="text-xs text-navy-400">from {entry.previous_status}</span>
                        )}
                      </div>
                      <p className="text-xs text-navy-500 mt-1">
                        {new Date(entry.created_at).toLocaleString()}
                        {entry.changed_by_name && ` by ${entry.changed_by_name}`}
                      </p>
                      {entry.remarks && <p className="text-sm text-navy-700 mt-1">{entry.remarks}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
