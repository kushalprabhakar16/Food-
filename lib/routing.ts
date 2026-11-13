// Routing and Dispatch Engine
// Determines zone from PIN code, assigns officers based on capacity and availability

import type { Officer, Zone, Report } from './supabase';

export interface RoutingDecision {
  zoneId: number | null;
  zoneName: string | null;
  assignedOfficerId: string | null;
  assignedOfficerName: string | null;
  assignmentType: 'primary' | 'deputy_fallback' | 'escalated' | 'queued' | 'fallback_correction';
  reason: string;
  decisionType: 'assigned' | 'deputy_fallback' | 'queued' | 'escalated' | 'emergency_override' | 'fallback_correction';
  queued: boolean;
}

const MAX_CAPACITY = 10;

export function findZoneByPinCode(pinCode: string, zones: Zone[]): Zone | null {
  const pin = pinCode.trim();
  // First try exact match in zone ranges
  for (const zone of zones) {
    if (pin >= zone.pin_start && pin <= zone.pin_end) {
      return zone;
    }
  }
  // Also check prefix match (first 3 digits)
  for (const zone of zones) {
    const zonePrefix = zone.pin_start.substring(0, 3);
    if (pin.startsWith(zonePrefix)) {
      return zone;
    }
  }
  return null;
}

export function calculatePriority(
  urgencyLevel: 'emergency' | 'critical' | 'high' | 'normal',
  category: string,
): 'emergency' | 'critical' | 'high' | 'normal' {
  // Emergency urgency always gets emergency priority
  if (urgencyLevel === 'emergency') return 'emergency';
  // Critical urgency or CRITICAL category gets critical priority
  if (urgencyLevel === 'critical' || category === 'CRITICAL') return 'critical';
  // High urgency or MAJOR category gets high priority
  if (urgencyLevel === 'high' || category === 'MAJOR') return 'high';
  return 'normal';
}

export function getPriorityRank(priority: string): number {
  switch (priority) {
    case 'emergency': return 0;
    case 'critical': return 1;
    case 'high': return 2;
    default: return 3;
  }
}

export function sortReportsByPriority(reports: Report[]): Report[] {
  return [...reports].sort((a, b) => {
    const pA = getPriorityRank(a.priority);
    const pB = getPriorityRank(b.priority);
    if (pA !== pB) return pA - pB;
    // Secondary sort: created_at ascending (earlier first)
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
}

export function routeReport(
  pinCode: string,
  urgencyLevel: 'emergency' | 'critical' | 'high' | 'normal',
  category: string,
  zones: Zone[],
  officers: Officer[],
  deputyAssignments: { officerId: string; zoneId: number }[],
): RoutingDecision {
  const zone = findZoneByPinCode(pinCode, zones);

  // Scenario 1: Unknown PIN-code zone
  if (!zone) {
    return {
      zoneId: null,
      zoneName: null,
      assignedOfficerId: null,
      assignedOfficerName: null,
      assignmentType: 'fallback_correction',
      reason: `Unknown PIN code zone for ${pinCode}. Report sent to central fallback/correction queue for administrative review.`,
      decisionType: 'fallback_correction',
      queued: true,
    };
  }

  const priority = calculatePriority(urgencyLevel, category);

  // Find eligible district officers in this zone
  const zoneOfficers = officers
    .filter((o) => o.officer_type === 'district' && o.zone_id === zone.id)
    .sort((a, b) => a.current_workload - b.current_workload); // least-loaded first

  // Emergency priority override: assign to least-loaded available officer immediately
  if (priority === 'emergency') {
    const availableOfficer = zoneOfficers.find(
      (o) => o.availability === 'available' && o.current_workload < o.capacity,
    );
    if (availableOfficer) {
      return {
        zoneId: zone.id,
        zoneName: zone.zone_name,
        assignedOfficerId: availableOfficer.id,
        assignedOfficerName: availableOfficer.officer_name,
        assignmentType: 'primary',
        reason: `Emergency priority override: assigned to ${availableOfficer.officer_name} (least-loaded available officer in ${zone.zone_name}). Workload: ${availableOfficer.current_workload}/${availableOfficer.capacity}.`,
        decisionType: 'emergency_override',
        queued: false,
      };
    }
    // No district officer available, try deputy fallback for emergency
    const deputyOfficers = getDeputyOfficersForZone(zone.id, officers, deputyAssignments);
    const availableDeputy = deputyOfficers.find(
      (o) => o.availability === 'available' && o.current_workload < o.capacity,
    );
    if (availableDeputy) {
      return {
        zoneId: zone.id,
        zoneName: zone.zone_name,
        assignedOfficerId: availableDeputy.id,
        assignedOfficerName: availableDeputy.officer_name,
        assignmentType: 'deputy_fallback',
        reason: `Emergency priority override: no district officer available in ${zone.zone_name}. Assigned to deputy ${availableDeputy.officer_name}. Workload: ${availableDeputy.current_workload}/${availableDeputy.capacity}.`,
        decisionType: 'emergency_override',
        queued: false,
      };
    }
    return {
      zoneId: zone.id,
      zoneName: zone.zone_name,
      assignedOfficerId: null,
      assignedOfficerName: null,
      assignmentType: 'queued',
      reason: `Emergency priority override: no available officer or deputy in ${zone.zone_name}. Report placed at front of waiting queue.`,
      decisionType: 'queued',
      queued: true,
    };
  }

  // Non-emergency: check district officers with capacity
  const availableOfficer = zoneOfficers.find(
    (o) => o.availability === 'available' && o.current_workload < o.capacity,
  );

  if (availableOfficer) {
    return {
      zoneId: zone.id,
      zoneName: zone.zone_name,
      assignedOfficerId: availableOfficer.id,
      assignedOfficerName: availableOfficer.officer_name,
      assignmentType: 'primary',
      reason: `Assigned to ${availableOfficer.officer_name} (least-loaded available district officer in ${zone.zone_name}). Workload: ${availableOfficer.current_workload}/${availableOfficer.capacity}.`,
      decisionType: 'assigned',
      queued: false,
    };
  }

  // Scenario 4: Officer capacity exceeded - try deputy fallback
  const deputyOfficers = getDeputyOfficersForZone(zone.id, officers, deputyAssignments);
  const availableDeputy = deputyOfficers.find(
    (o) => o.availability === 'available' && o.current_workload < o.capacity,
  );

  if (availableDeputy) {
    return {
      zoneId: zone.id,
      zoneName: zone.zone_name,
      assignedOfficerId: availableDeputy.id,
      assignedOfficerName: availableDeputy.officer_name,
      assignmentType: 'deputy_fallback',
      reason: `All district officers in ${zone.zone_name} at capacity or unavailable. Deputy fallback: assigned to ${availableDeputy.officer_name}. Workload: ${availableDeputy.current_workload}/${availableDeputy.capacity}.`,
      decisionType: 'deputy_fallback',
      queued: false,
    };
  }

  // Scenario 3: No available officer or deputy - queue the report
  return {
    zoneId: zone.id,
    zoneName: zone.zone_name,
    assignedOfficerId: null,
    assignedOfficerName: null,
    assignmentType: 'queued',
    reason: `No available officers or deputies in ${zone.zone_name}. All at capacity (max ${MAX_CAPACITY}) or unavailable. Report placed in waiting queue.`,
    decisionType: 'queued',
    queued: true,
  };
}

function getDeputyOfficersForZone(
  zoneId: number,
  officers: Officer[],
  deputyAssignments: { officerId: string; zoneId: number }[],
): Officer[] {
  const deputyIds = deputyAssignments
    .filter((d) => d.zoneId === zoneId)
    .map((d) => d.officerId);
  return officers
    .filter((o) => deputyIds.includes(o.id))
    .sort((a, b) => a.current_workload - b.current_workload);
}

export { MAX_CAPACITY };
