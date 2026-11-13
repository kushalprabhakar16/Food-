import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { supabase, Officer, Zone } from '@/lib/supabase';
import { submitReport, ReportFormData } from '@/lib/reportService';
import { validateInspectorId, validateViolationCode } from '@/lib/dfa';
import { classifyReport } from '@/lib/classification';
import { PageHeader, LoadingSpinner, StatusBadge } from '@/components/ui';
import { FilePlus, CheckCircle2, XCircle, Loader2, RotateCcw, Send, Eye, Cpu, ArrowRight } from 'lucide-react';

const URGENCY_OPTIONS = [
  { value: 'emergency', label: 'Emergency' },
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'normal', label: 'Normal' },
];

const VIOLATION_CODE_PRESETS = [
  'V01-CRITICAL',
  'V02-MAJOR',
  'V03-MINOR',
  'V04-ADVISORY',
  'V05-PASSED',
];

const initialFormData: ReportFormData = {
  inspector_id: '',
  inspector_name: '',
  inspector_contact: '',
  establishment_name: '',
  inspection_location: '',
  pin_code: '',
  violation_code: '',
  violation_description: '',
  inspection_date: new Date().toISOString().split('T')[0],
  inspection_time: new Date().toTimeString().substring(0, 5),
  urgency_level: 'normal',
  remarks: '',
};

export function ReportSubmissionPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [formData, setFormData] = useState<ReportFormData>({
    ...initialFormData,
    inspector_id: user?.inspector_id || '',
    inspector_name: user?.full_name || '',
    inspector_contact: user?.contact || '',
  });
  const [validationResult, setValidationResult] = useState<{
    inspector: ReturnType<typeof validateInspectorId> | null;
    violation: ReturnType<typeof validateViolationCode> | null;
  }>({ inspector: null, violation: null });
  const [classificationResult, setClassificationResult] = useState<ReturnType<typeof classifyReport> | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<{
    reportId: string;
    category: string;
    priority: string;
    zone: string;
    officer: string;
    routingReason: string;
  } | null>(null);
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);

  const fetchData = useCallback(async () => {
    const { data: officerData } = await supabase.from('officers').select('*');
    const { data: zoneData } = await supabase.from('zones').select('*');
    const { data: deputyData } = await supabase.from('deputy_officers').select('*');
    setOfficers((officerData as Officer[]) || []);
    setZones((zoneData as Zone[]) || []);
    // Store deputy assignments for routing
    if (deputyData) {
      (window as any).__deputyAssignments = deputyData.map((d: any) => ({ officerId: d.officer_id, zoneId: d.zone_id }));
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleChange = (field: keyof ReportFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear previous results when editing
    setValidationResult({ inspector: null, violation: null });
    setClassificationResult(null);
  };

  const handleValidate = () => {
    const inspector = validateInspectorId(formData.inspector_id);
    const violation = validateViolationCode(formData.violation_code);
    setValidationResult({ inspector, violation });

    if (inspector.accepted && violation.accepted) {
      const classification = classifyReport(formData.violation_code, formData.violation_description);
      setClassificationResult(classification);
      showToast('Validation passed. Report ready for submission.', 'success');
    } else {
      if (!inspector.accepted) showToast(inspector.dfaResult.errorMessage || 'Invalid inspector ID', 'error');
      if (!violation.accepted) showToast(violation.dfaResult.errorMessage || 'Invalid violation code', 'error');
    }
  };

  const handleSubmit = async () => {
    // Validate first
    const inspector = validateInspectorId(formData.inspector_id);
    const violation = validateViolationCode(formData.violation_code);
    setValidationResult({ inspector, violation });

    if (!inspector.accepted || !violation.accepted) {
      showToast('Validation failed. Please fix errors before submitting.', 'error');
      return;
    }

    // Check required fields
    const required: (keyof ReportFormData)[] = ['inspector_id', 'inspector_name', 'establishment_name', 'inspection_location', 'pin_code', 'violation_code', 'violation_description', 'inspection_date', 'inspection_time'];
    for (const field of required) {
      if (!formData[field].trim()) {
        showToast(`Please fill in all required fields`, 'warning');
        return;
      }
    }

    setSubmitting(true);
    const deputyAssignments = (window as any).__deputyAssignments || [];
    const result = await submitReport(formData, user?.id || '', zones, officers, deputyAssignments);
    setSubmitting(false);

    if (result.success) {
      const report = result.routing;
      const zoneName = zones.find((z) => z.id === report?.zoneId)?.zone_name || 'Unknown Zone';
      const officerName = report?.assignedOfficerName || 'Not assigned (queued)';
      setSubmissionResult({
        reportId: result.reportId!,
        category: result.classification!.category,
        priority: ['emergency', 'critical', 'high', 'normal'].includes(
          result.routing?.decisionType === 'emergency_override' ? 'emergency' : 'normal',
        ) ? 'calculated' : 'normal',
        zone: zoneName,
        officer: officerName,
        routingReason: report?.reason || '',
      });
      showToast(`Report ${result.reportId} submitted successfully!`, 'success');
      setFormData({ ...initialFormData });
      setValidationResult({ inspector: null, violation: null });
      setClassificationResult(null);
      // Refresh officer data to get updated workloads
      fetchData();
    } else {
      showToast(result.error || 'Submission failed', 'error');
    }
  };

  const handleReset = () => {
    setFormData({
      ...initialFormData,
      inspector_id: user?.inspector_id || '',
      inspector_name: user?.full_name || '',
      inspector_contact: user?.contact || '',
    });
    setValidationResult({ inspector: null, violation: null });
    setClassificationResult(null);
    setSubmissionResult(null);
  };

  if (submissionResult) {
    return (
      <div>
        <PageHeader title="Report Submitted" subtitle="Your inspection report has been processed" icon={CheckCircle2} />
        <div className="card p-8 max-w-2xl mx-auto animate-slide-up">
          <div className="flex items-center justify-center mb-6">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 size={40} className="text-green-600" />
            </div>
          </div>
          <h2 className="text-xl font-bold text-center text-navy-900 mb-2">Submission Confirmed</h2>
          <p className="text-center text-navy-500 text-sm mb-6">Your report has been validated, classified, and routed.</p>

          <div className="space-y-3 bg-navy-50 rounded-lg p-5">
            <div className="flex justify-between text-sm">
              <span className="text-navy-500">Report ID:</span>
              <span className="font-mono font-semibold text-navy-900">{submissionResult.reportId}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-navy-500">Classification:</span>
              <StatusBadge>{submissionResult.category}</StatusBadge>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-navy-500">Routing Zone:</span>
              <span className="font-medium text-navy-900">{submissionResult.zone}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-navy-500">Assigned Officer:</span>
              <span className="font-medium text-navy-900">{submissionResult.officer}</span>
            </div>
            <div className="pt-2 border-t border-navy-200">
              <p className="text-xs text-navy-500 mb-1">Routing Decision:</p>
              <p className="text-sm text-navy-700">{submissionResult.routingReason}</p>
            </div>
          </div>

          <div className="mt-6 flex gap-3 justify-center">
            <button onClick={() => setSubmissionResult(null)} className="btn-outline">
              Submit Another Report
            </button>
            <a href={`/reports/track`} className="btn-primary" onClick={(e) => { e.preventDefault(); window.location.hash = '#/reports/track'; }}>
              Track This Report
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Submit Inspection Report"
        subtitle="Complete the form below to file a food safety inspection report"
        icon={FilePlus}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form */}
        <div className="lg:col-span-2">
          <div className="card p-6 space-y-4">
            <h3 className="font-semibold text-navy-900 border-b border-navy-100 pb-2">Inspector Information</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-navy-700 mb-1">
                  Inspector ID <span className="text-red-500">*</span>
                  <span className="text-xs text-navy-400 ml-1">(INS[A-Z][A-Z][0-9]{4})</span>
                </label>
                <input
                  type="text"
                  value={formData.inspector_id}
                  onChange={(e) => handleChange('inspector_id', e.target.value.toUpperCase())}
                  className="input-field uppercase font-mono"
                  placeholder="INSAB1234"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-navy-700 mb-1">
                  Inspector Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.inspector_name}
                  onChange={(e) => handleChange('inspector_name', e.target.value)}
                  className="input-field"
                  placeholder="Full name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-navy-700 mb-1">Contact Info</label>
                <input
                  type="text"
                  value={formData.inspector_contact}
                  onChange={(e) => handleChange('inspector_contact', e.target.value)}
                  className="input-field"
                  placeholder="Phone or email"
                />
              </div>
            </div>

            <h3 className="font-semibold text-navy-900 border-b border-navy-100 pb-2 pt-2">Establishment Details</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-navy-700 mb-1">
                  Restaurant/Unit Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.establishment_name}
                  onChange={(e) => handleChange('establishment_name', e.target.value)}
                  className="input-field"
                  placeholder="e.g. Spice Garden Restaurant"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-navy-700 mb-1">
                  Inspection Location <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.inspection_location}
                  onChange={(e) => handleChange('inspection_location', e.target.value)}
                  className="input-field"
                  placeholder="Full address"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-navy-700 mb-1">
                  PIN Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.pin_code}
                  onChange={(e) => handleChange('pin_code', e.target.value)}
                  className="input-field font-mono"
                  placeholder="6-digit PIN code"
                  maxLength={6}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-navy-700 mb-1">Urgency Level</label>
                <select
                  value={formData.urgency_level}
                  onChange={(e) => handleChange('urgency_level', e.target.value)}
                  className="input-field"
                >
                  {URGENCY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <h3 className="font-semibold text-navy-900 border-b border-navy-100 pb-2 pt-2">Violation Details</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-navy-700 mb-1">
                  Violation Code <span className="text-red-500">*</span>
                  <span className="text-xs text-navy-400 ml-1">(V##-CATEGORY)</span>
                </label>
                <input
                  type="text"
                  value={formData.violation_code}
                  onChange={(e) => handleChange('violation_code', e.target.value.toUpperCase())}
                  className="input-field uppercase font-mono"
                  placeholder="V01-CRITICAL"
                />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {VIOLATION_CODE_PRESETS.map((code) => (
                    <button
                      key={code}
                      onClick={() => handleChange('violation_code', code)}
                      className="text-xs px-2 py-1 rounded bg-navy-50 hover:bg-navy-100 text-navy-600 transition-colors"
                    >
                      {code}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-navy-700 mb-1">Inspection Date</label>
                <input
                  type="date"
                  value={formData.inspection_date}
                  onChange={(e) => handleChange('inspection_date', e.target.value)}
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-navy-700 mb-1">Inspection Time</label>
                <input
                  type="time"
                  value={formData.inspection_time}
                  onChange={(e) => handleChange('inspection_time', e.target.value)}
                  className="input-field"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-navy-700 mb-1">
                Violation Description <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.violation_description}
                onChange={(e) => handleChange('violation_description', e.target.value)}
                className="input-field min-h-[80px]"
                placeholder="Describe the violation in detail..."
                rows={3}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-navy-700 mb-1">Supporting Remarks</label>
              <textarea
                value={formData.remarks}
                onChange={(e) => handleChange('remarks', e.target.value)}
                className="input-field"
                placeholder="Additional remarks or observations..."
                rows={2}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3 pt-2">
              <button onClick={handleValidate} className="btn-outline flex items-center gap-2">
                <Eye size={18} /> Validate
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="btn-primary flex items-center gap-2"
              >
                {submitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                Submit Report
              </button>
              <button onClick={handleReset} className="btn-outline flex items-center gap-2">
                <RotateCcw size={18} /> Reset Form
              </button>
            </div>
          </div>
        </div>

        {/* Validation Panel */}
        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="font-semibold text-navy-900 mb-3 flex items-center gap-2">
              <Cpu size={18} className="text-lightblue-600" /> Validation Results
            </h3>

            {/* Inspector ID Validation */}
            <div className="space-y-2 mb-4">
              <p className="text-xs font-medium text-navy-500">Inspector ID</p>
              {validationResult.inspector ? (
                <div className={`p-3 rounded-lg border ${validationResult.inspector.accepted ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    {validationResult.inspector.accepted ? (
                      <CheckCircle2 size={16} className="text-green-600" />
                    ) : (
                      <XCircle size={16} className="text-red-600" />
                    )}
                    <span className="text-sm font-medium">
                      {validationResult.inspector.accepted ? 'Valid' : 'Invalid'}
                    </span>
                  </div>
                  <div className="text-xs space-y-1 text-navy-600">
                    <div>DFA: {validationResult.inspector.dfaResult.accepted ? 'Accepted' : 'Rejected'}</div>
                    <div>Regex: {validationResult.inspector.regexResult.accepted ? 'Accepted' : 'Rejected'}</div>
                    <div>Agreement: {validationResult.inspector.agree ? 'Yes' : 'No'}</div>
                    {validationResult.inspector.dfaResult.errorMessage && (
                      <div className="text-red-600 mt-1">{validationResult.inspector.dfaResult.errorMessage}</div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-navy-400 italic">Click "Validate" to check</p>
              )}
            </div>

            {/* Violation Code Validation */}
            <div className="space-y-2 mb-4">
              <p className="text-xs font-medium text-navy-500">Violation Code</p>
              {validationResult.violation ? (
                <div className={`p-3 rounded-lg border ${validationResult.violation.accepted ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    {validationResult.violation.accepted ? (
                      <CheckCircle2 size={16} className="text-green-600" />
                    ) : (
                      <XCircle size={16} className="text-red-600" />
                    )}
                    <span className="text-sm font-medium">
                      {validationResult.violation.accepted ? 'Valid' : 'Invalid'}
                    </span>
                  </div>
                  <div className="text-xs space-y-1 text-navy-600">
                    <div>DFA: {validationResult.violation.dfaResult.accepted ? 'Accepted' : 'Rejected'}</div>
                    <div>Regex: {validationResult.violation.regexResult.accepted ? 'Accepted' : 'Rejected'}</div>
                    <div>Agreement: {validationResult.violation.agree ? 'Yes' : 'No'}</div>
                    {validationResult.violation.dfaResult.errorMessage && (
                      <div className="text-red-600 mt-1">{validationResult.violation.dfaResult.errorMessage}</div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-navy-400 italic">Click "Validate" to check</p>
              )}
            </div>

            {/* Classification Preview */}
            {classificationResult && (
              <div className="p-3 rounded-lg border bg-lightblue-50 border-lightblue-200 mb-4">
                <p className="text-xs font-medium text-navy-500 mb-1">Classification Preview</p>
                <div className="flex items-center gap-2 mb-2">
                  <StatusBadge>{classificationResult.category}</StatusBadge>
                  {classificationResult.isFinal && (
                    <span className="text-xs text-green-600 font-medium">Final</span>
                  )}
                </div>
                <p className="text-xs text-navy-600">{classificationResult.reason}</p>
                {classificationResult.conflictingCodes.length > 0 && (
                  <p className="text-xs text-amber-600 mt-1">
                    Conflicts: {classificationResult.conflictingCodes.join(', ')}
                  </p>
                )}
              </div>
            )}

            {/* DFA State Transitions */}
            {validationResult.inspector?.dfaResult.transitions.length ? (
              <div className="p-3 rounded-lg border bg-navy-50 border-navy-200">
                <p className="text-xs font-medium text-navy-500 mb-2">DFA State Transitions</p>
                <div className="text-xs font-mono space-y-0.5 max-h-40 overflow-y-auto">
                  {validationResult.inspector.dfaResult.transitions.map((t, i) => (
                    <div key={i} className="flex items-center gap-1 text-navy-600">
                      <span className="text-navy-400">q{t.state}</span>
                      <ArrowRight size={10} />
                      <span className="font-semibold text-navy-700">'{t.input}'</span>
                      <ArrowRight size={10} />
                      <span className={t.nextState === 9 ? 'text-green-600 font-bold' : t.nextState === 10 ? 'text-red-600 font-bold' : 'text-navy-600'}>
                        q{t.nextState}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
