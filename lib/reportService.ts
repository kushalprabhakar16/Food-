import { supabase, Report, Officer, Zone } from '@/lib/supabase';
import { validateInspectorId, validateViolationCode } from '@/lib/dfa';
import { classifyReport, ClassificationResult } from '@/lib/classification';
import {
  routeReport,
  calculatePriority,
  RoutingDecision,
} from '@/lib/routing';

export interface ReportFormData {
  inspector_id: string;
  inspector_name: string;
  inspector_contact: string;
  establishment_name: string;
  inspection_location: string;
  pin_code: string;
  violation_code: string;
  violation_description: string;
  inspection_date: string;
  inspection_time: string;
  urgency_level: 'emergency' | 'critical' | 'high' | 'normal';
  remarks: string;
}

export interface SubmissionResult {
  success: boolean;
  reportId: string | null;
  validation: {
    inspectorIdValid: boolean;
    violationCodeValid: boolean;
    dfaAgreement: boolean;
    inspectorIdDfa: boolean;
    inspectorIdRegex: boolean;
    violationCodeDfa: boolean;
    violationCodeRegex: boolean;
    dfaTransitions: string;
    notes: string;
  };
  classification: ClassificationResult | null;
  routing: RoutingDecision | null;
  error: string | null;
}

function generateReportId(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `RPT-${year}${month}${day}-${random}`;
}

export async function submitReport(
  formData: ReportFormData,
  submittedBy: string,
  zones: Zone[],
  officers: Officer[],
  deputyAssignments: { officerId: string; zoneId: number }[],
): Promise<SubmissionResult> {
  // Step 1: Validate Inspector ID
  const inspectorValidation = validateInspectorId(formData.inspector_id);
  // Step 2: Validate Violation Code
  const violationValidation = validateViolationCode(formData.violation_code);

  const dfaTransitions = JSON.stringify(inspectorValidation.dfaResult.transitions);
  const notes: string[] = [];

  if (!inspectorValidation.accepted) {
    notes.push(`Inspector ID validation failed: ${inspectorValidation.dfaResult.errorMessage}`);
  }
  if (!violationValidation.accepted) {
    notes.push(`Violation code validation failed: ${violationValidation.dfaResult.errorMessage}`);
  }
  if (!inspectorValidation.agree) {
    notes.push('DFA and regex disagreement on inspector ID.');
  }
  if (!violationValidation.agree) {
    notes.push('DFA and regex disagreement on violation code.');
  }

  // If validation fails, reject before dispatch
  if (!inspectorValidation.accepted || !violationValidation.accepted) {
    return {
      success: false,
      reportId: null,
      validation: {
        inspectorIdValid: inspectorValidation.accepted,
        violationCodeValid: violationValidation.accepted,
        dfaAgreement: inspectorValidation.agree && violationValidation.agree,
        inspectorIdDfa: inspectorValidation.dfaResult.accepted,
        inspectorIdRegex: inspectorValidation.regexResult.accepted,
        violationCodeDfa: violationValidation.dfaResult.accepted,
        violationCodeRegex: violationValidation.regexResult.accepted,
        dfaTransitions,
        notes: notes.join(' | '),
      },
      classification: null,
      routing: null,
      error: 'Validation failed. Report rejected before dispatch.',
    };
  }

  // Step 3: Classify the report
  const classification = classifyReport(formData.violation_code, formData.violation_description);

  // Step 4: Calculate priority
  const priority = calculatePriority(formData.urgency_level, classification.category);

  // Step 5: Route the report
  const routing = routeReport(
    formData.pin_code,
    formData.urgency_level,
    classification.category,
    zones,
    officers,
    deputyAssignments,
  );

  // Step 6: Generate unique report ID
  const reportId = generateReportId();

  // Step 7: Save to database
  const reportRecord: Record<string, unknown> = {
    report_id: reportId,
    inspector_id: formData.inspector_id.trim(),
    inspector_name: formData.inspector_name.trim(),
    inspector_contact: formData.inspector_contact || null,
    establishment_name: formData.establishment_name.trim(),
    inspection_location: formData.inspection_location.trim(),
    pin_code: formData.pin_code.trim(),
    violation_code: formData.violation_code.trim(),
    violation_description: formData.violation_description.trim(),
    inspection_date: formData.inspection_date,
    inspection_time: formData.inspection_time,
    urgency_level: formData.urgency_level,
    remarks: formData.remarks || null,
    status: routing.queued ? 'pending' : 'assigned',
    category: classification.category,
    priority,
    zone_id: routing.zoneId,
    assigned_officer_id: routing.assignedOfficerId,
    assigned_at: routing.assignedOfficerId ? new Date().toISOString() : null,
    submitted_by: submittedBy,
    inspector_id_valid: true,
    violation_code_valid: true,
    dfa_transitions: dfaTransitions,
    validation_notes: notes.length > 0 ? notes.join(' | ') : 'All validations passed.',
  };

  const { data: insertedReport, error: reportError } = await supabase
    .from('reports')
    .insert(reportRecord)
    .select()
    .single();

  if (reportError || !insertedReport) {
    return {
      success: false,
      reportId,
      validation: {
        inspectorIdValid: true,
        violationCodeValid: true,
        dfaAgreement: true,
        inspectorIdDfa: true,
        inspectorIdRegex: true,
        violationCodeDfa: true,
        violationCodeRegex: true,
        dfaTransitions,
        notes: notes.join(' | '),
      },
      classification,
      routing,
      error: `Database error: ${reportError?.message || 'Failed to insert report.'}`,
    };
  }

  const reportUuid = (insertedReport as Report).id;

  // Save classification
  await supabase.from('classifications').insert({
    report_id: reportUuid,
    category: classification.category,
    violation_code: formData.violation_code.trim(),
    classification_reason: classification.reason,
    conflicting_codes: classification.conflictingCodes.length > 0 ? classification.conflictingCodes.join('; ') : null,
    is_final: classification.isFinal,
  });

  // Create assignment if officer assigned
  if (routing.assignedOfficerId) {
    await supabase.from('assignments').insert({
      report_id: reportUuid,
      officer_id: routing.assignedOfficerId,
      assignment_type: routing.assignmentType === 'queued' ? 'manual' : routing.assignmentType,
      assignment_reason: routing.reason,
      is_active: true,
    });

    // Increment officer workload
    const officer = officers.find((o) => o.id === routing.assignedOfficerId);
    if (officer) {
      await supabase
        .from('officers')
        .update({ current_workload: officer.current_workload + 1, updated_at: new Date().toISOString() })
        .eq('id', routing.assignedOfficerId);
    }
  }

  // Log routing decision
  await supabase.from('routing_logs').insert({
    report_id: reportUuid,
    zone_id: routing.zoneId,
    officer_id: routing.assignedOfficerId,
    decision: routing.assignedOfficerId ? `Assigned to ${routing.assignedOfficerName}` : 'Queued',
    reason: routing.reason,
    decision_type: routing.decisionType,
  });

  // Record status history
  await supabase.from('status_history').insert({
    report_id: reportUuid,
    previous_status: null,
    new_status: routing.queued ? 'pending' : 'assigned',
    changed_by: submittedBy,
    changed_by_name: formData.inspector_name,
    remarks: routing.queued ? 'Report queued: ' + routing.reason : 'Report assigned: ' + routing.reason,
  });

  // Audit log
  await supabase.from('audit_logs').insert({
    event_type: routing.queued ? 'report_queued' : 'report_submitted',
    entity_type: 'report',
    entity_id: reportId,
    description: `Report ${reportId} submitted by ${formData.inspector_name}. Category: ${classification.category}, Priority: ${priority}, Zone: ${routing.zoneName || 'Unknown'}. ${routing.reason}`,
    severity: routing.decisionType === 'fallback_correction' ? 'warning' : 'info',
    user_id: submittedBy,
    metadata: { classification: classification.category, priority, routing: routing.decisionType },
  });

  return {
    success: true,
    reportId,
    validation: {
      inspectorIdValid: true,
      violationCodeValid: true,
      dfaAgreement: true,
      inspectorIdDfa: true,
      inspectorIdRegex: true,
      violationCodeDfa: true,
      violationCodeRegex: true,
      dfaTransitions,
      notes: 'All validations passed.',
    },
    classification,
    routing,
    error: null,
  };
}

export async function updateReportStatus(
  reportId: string,
  newStatus: 'pending' | 'assigned' | 'in_progress' | 'resolved',
  changedBy: string,
  changedByName: string,
  remarks: string,
  currentStatus: string,
  assignedOfficerId: string | null,
): Promise<{ error: string | null }> {
  const { error: updateError } = await supabase
    .from('reports')
    .update({
      status: newStatus,
      resolution_remarks: newStatus === 'resolved' ? remarks : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', reportId);

  if (updateError) return { error: updateError.message };

  // Record status history
  await supabase.from('status_history').insert({
    report_id: reportId,
    previous_status: currentStatus,
    new_status: newStatus,
    changed_by: changedBy,
    changed_by_name: changedByName,
    remarks: remarks || null,
  });

  // If resolved, decrement officer workload
  if (newStatus === 'resolved' && assignedOfficerId) {
    const { data: officer } = await supabase
      .from('officers')
      .select('current_workload')
      .eq('id', assignedOfficerId)
      .maybeSingle();
    if (officer && officer.current_workload > 0) {
      await supabase
        .from('officers')
        .update({ current_workload: officer.current_workload - 1, updated_at: new Date().toISOString() })
        .eq('id', assignedOfficerId);
    }
  }

  // Audit log
  await supabase.from('audit_logs').insert({
    event_type: 'status_update',
    entity_type: 'report',
    entity_id: reportId,
    description: `Report status changed from ${currentStatus} to ${newStatus} by ${changedByName}. Remarks: ${remarks || 'None'}`,
    severity: 'info',
    user_id: changedBy,
    metadata: { previous: currentStatus, new: newStatus },
  });

  return { error: null };
}
