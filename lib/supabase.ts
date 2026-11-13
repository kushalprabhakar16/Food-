import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export type UserRole = 'administrator' | 'inspector' | 'district_officer' | 'deputy_officer' | 'general_user';

export interface User {
  id: string;
  auth_id: string;
  email: string;
  full_name: string;
  role: UserRole;
  inspector_id: string | null;
  contact: string | null;
  availability: string;
  created_at: string;
  updated_at: string;
}

export interface Officer {
  id: string;
  user_id: string | null;
  officer_name: string;
  officer_type: 'district' | 'deputy';
  email: string;
  contact: string | null;
  zone_id: number | null;
  capacity: number;
  current_workload: number;
  availability: string;
  created_at: string;
  updated_at: string;
  zone?: Zone;
}

export interface Zone {
  id: number;
  zone_id: string;
  zone_name: string;
  pin_start: string;
  pin_end: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface Report {
  id: string;
  report_id: string;
  inspector_id: string;
  inspector_name: string;
  inspector_contact: string | null;
  establishment_name: string;
  inspection_location: string;
  pin_code: string;
  violation_code: string;
  violation_description: string;
  inspection_date: string;
  inspection_time: string;
  urgency_level: 'emergency' | 'critical' | 'high' | 'normal';
  remarks: string | null;
  status: 'pending' | 'assigned' | 'in_progress' | 'resolved';
  category: 'CRITICAL' | 'MAJOR' | 'MINOR' | 'ADVISORY' | 'PASSED' | 'UNKNOWN' | null;
  priority: 'emergency' | 'critical' | 'high' | 'normal';
  zone_id: number | null;
  assigned_officer_id: string | null;
  assigned_at: string | null;
  resolution_remarks: string | null;
  submitted_by: string | null;
  inspector_id_valid: boolean;
  violation_code_valid: boolean;
  dfa_transitions: string | null;
  validation_notes: string | null;
  created_at: string;
  updated_at: string;
  zone?: Zone;
  assigned_officer?: Officer | null;
}

export interface Classification {
  id: string;
  report_id: string;
  category: string;
  violation_code: string;
  classification_reason: string | null;
  conflicting_codes: string | null;
  is_final: boolean;
  created_at: string;
}

export interface Assignment {
  id: string;
  report_id: string;
  officer_id: string;
  assignment_type: 'primary' | 'deputy_fallback' | 'escalated' | 'manual';
  assignment_reason: string | null;
  assigned_at: string;
  is_active: boolean;
}

export interface StatusHistory {
  id: string;
  report_id: string;
  previous_status: string | null;
  new_status: string;
  changed_by: string | null;
  changed_by_name: string | null;
  remarks: string | null;
  created_at: string;
}

export interface RoutingLog {
  id: string;
  report_id: string;
  zone_id: number | null;
  officer_id: string | null;
  decision: string;
  reason: string | null;
  decision_type: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  event_type: string;
  entity_type: string | null;
  entity_id: string | null;
  description: string;
  severity: string;
  user_id: string | null;
  user_email: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface DeputyOfficer {
  id: number;
  officer_id: string;
  zone_id: number;
  priority: number;
  created_at: string;
}
