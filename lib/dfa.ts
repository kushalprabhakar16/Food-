// Deterministic Finite Automaton (DFA) for Inspector ID validation
// Format: INS[2 UPPERCASE LETTERS][4 DIGITS] e.g. INSAB1234
// Also implements a second DFA for Violation Code: V[2 DIGITS]-[CATEGORY]

export interface DFATransition {
  state: number;
  input: string;
  nextState: number;
}

export interface DFAValidationResult {
  accepted: boolean;
  input: string;
  transitions: DFATransition[];
  finalState: number | null;
  errorMessage: string | null;
  method: 'dfa';
}

export interface DFAStateInfo {
  id: number;
  label: string;
  isAccepting: boolean;
  isInitial: boolean;
  isReject: boolean;
}

// ============================================================
// Inspector ID DFA: INS[A-Z]{2}[0-9]{4}
// States:
// 0  -> initial (expect 'I')
// 1  -> got 'I' (expect 'N')
// 2  -> got 'IN' (expect 'S')
// 3  -> got 'INS' (expect first letter A-Z)
// 4  -> got INS + 1 letter (expect second letter A-Z)
// 5  -> got INS + 2 letters (expect digit 1)
// 6  -> got INS + 2 letters + 1 digit (expect digit 2)
// 7  -> got INS + 2 letters + 2 digits (expect digit 3)
// 8  -> got INS + 2 letters + 3 digits (expect digit 4)
// 9  -> ACCEPT (INS + 2 letters + 4 digits)
// 10 -> REJECT (dead state)
// ============================================================

const INSPECTOR_STATES: DFAStateInfo[] = [
  { id: 0, label: 'q0 (start)', isAccepting: false, isInitial: true, isReject: false },
  { id: 1, label: 'q1 (I)', isAccepting: false, isInitial: false, isReject: false },
  { id: 2, label: 'q2 (IN)', isAccepting: false, isInitial: false, isReject: false },
  { id: 3, label: 'q3 (INS)', isAccepting: false, isInitial: false, isReject: false },
  { id: 4, label: 'q4 (INS+L1)', isAccepting: false, isInitial: false, isReject: false },
  { id: 5, label: 'q5 (INS+L2)', isAccepting: false, isInitial: false, isReject: false },
  { id: 6, label: 'q6 (INS+L2+D1)', isAccepting: false, isInitial: false, isReject: false },
  { id: 7, label: 'q7 (INS+L2+D2)', isAccepting: false, isInitial: false, isReject: false },
  { id: 8, label: 'q8 (INS+L2+D3)', isAccepting: false, isInitial: false, isReject: false },
  { id: 9, label: 'q9 (ACCEPT)', isAccepting: true, isInitial: false, isReject: false },
  { id: 10, label: 'q_reject', isAccepting: false, isInitial: false, isReject: true },
];

function inspectorTransition(state: number, char: string): number {
  switch (state) {
    case 0: return char === 'I' ? 1 : 10;
    case 1: return char === 'N' ? 2 : 10;
    case 2: return char === 'S' ? 3 : 10;
    case 3: return char >= 'A' && char <= 'Z' ? 4 : 10;
    case 4: return char >= 'A' && char <= 'Z' ? 5 : 10;
    case 5: return char >= '0' && char <= '9' ? 6 : 10;
    case 6: return char >= '0' && char <= '9' ? 7 : 10;
    case 7: return char >= '0' && char <= '9' ? 8 : 10;
    case 8: return char >= '0' && char <= '9' ? 9 : 10;
    case 9: return 10; // any extra char after acceptance -> reject
    default: return 10;
  }
}

export function validateInspectorIdDFA(input: string): DFAValidationResult {
  const transitions: DFATransition[] = [];
  let state = 0;
  const cleanInput = input.trim();

  if (cleanInput.length === 0) {
    return {
      accepted: false,
      input: input,
      transitions: [],
      finalState: 0,
      errorMessage: 'Inspector ID is empty.',
      method: 'dfa',
    };
  }

  for (let i = 0; i < cleanInput.length; i++) {
    const char = cleanInput[i];
    const nextState = inspectorTransition(state, char);
    transitions.push({ state, input: char, nextState });
    state = nextState;
    if (state === 10) {
      // continue recording transitions for remaining chars but they all go to reject
    }
  }

  const accepted = state === 9;
  let errorMessage: string | null = null;

  if (!accepted) {
    if (state === 10) {
      if (cleanInput.length < 9) {
        errorMessage = `Inspector ID too short (expected 9 characters, got ${cleanInput.length}). Must match INS[2 letters][4 digits].`;
      } else if (cleanInput.length > 9) {
        errorMessage = `Inspector ID too long (expected 9 characters, got ${cleanInput.length}). Extra characters after valid ID.`;
      } else {
        errorMessage = `Invalid character in Inspector ID. Must match format INS[A-Z]{2}[0-9]{4} (e.g. INSAB1234).`;
      }
    } else {
      errorMessage = `Inspector ID incomplete. Reached state ${INSPECTOR_STATES[state]?.label} but did not reach accepting state. Must match INS[A-Z]{2}[0-9]{4}.`;
    }
  }

  return {
    accepted,
    input: input,
    transitions,
    finalState: state,
    errorMessage,
    method: 'dfa',
  };
}

// ============================================================
// Violation Code DFA: V[0-9]{2}-(CRITICAL|MAJOR|MINOR|ADVISORY|PASSED)
// States:
// 0  -> initial (expect 'V')
// 1  -> got 'V' (expect digit 1)
// 2  -> got V + 1 digit (expect digit 2)
// 3  -> got V + 2 digits (expect '-')
// 4  -> got V##- (start category matching)
// 5..9 -> category matching states
// 10 -> ACCEPT
// 11 -> REJECT
// ============================================================

const CATEGORIES = ['CRITICAL', 'MAJOR', 'MINOR', 'ADVISORY', 'PASSED'];

export interface ViolationDFAValidationResult extends DFAValidationResult {
  matchedCategory: string | null;
}

export function validateViolationCodeDFA(input: string): ViolationDFAValidationResult {
  const transitions: DFATransition[] = [];
  const cleanInput = input.trim();

  if (cleanInput.length === 0) {
    return {
      accepted: false,
      input,
      transitions: [],
      finalState: 0,
      errorMessage: 'Violation code is empty.',
      method: 'dfa',
      matchedCategory: null,
    };
  }

  // Basic structure DFA: V##-XXXXX
  // After '-', we match against category tokens via sub-DFA
  let state = 0;
  let i = 0;

  // Phase 1: structural part V##-
  for (; i < cleanInput.length; i++) {
    const char = cleanInput[i];
    let nextState = 11; // reject by default

    if (state === 0 && char === 'V') nextState = 1;
    else if (state === 1 && char >= '0' && char <= '9') nextState = 2;
    else if (state === 2 && char >= '0' && char <= '9') nextState = 3;
    else if (state === 3 && char === '-') nextState = 4;
    else if (state === 4) break; // move to category matching

    transitions.push({ state, input: char, nextState });
    state = nextState;
    if (state === 11) {
      // Record remaining transitions as reject
      for (let j = i + 1; j < cleanInput.length; j++) {
        transitions.push({ state: 11, input: cleanInput[j], nextState: 11 });
      }
      return {
        accepted: false,
        input,
        transitions,
        finalState: 11,
        errorMessage: `Invalid violation code structure. Must match V[0-9]{2}-(CRITICAL|MAJOR|MINOR|ADVISORY|PASSED).`,
        method: 'dfa',
        matchedCategory: null,
      };
    }
  }

  if (state !== 4) {
    // Didn't reach the category part
    return {
      accepted: false,
      input,
      transitions,
      finalState: state,
      errorMessage: `Violation code incomplete. Expected format V[0-9]{2}-(CRITICAL|MAJOR|MINOR|ADVISORY|PASSED).`,
      method: 'dfa',
      matchedCategory: null,
    };
  }

  // Phase 2: category matching
  const categoryPart = cleanInput.substring(i);
  let matchedCategory: string | null = null;

  for (const cat of CATEGORIES) {
    if (categoryPart === cat) {
      matchedCategory = cat;
      break;
    }
  }

  // Record category transitions
  for (let j = 0; j < categoryPart.length; j++) {
    transitions.push({ state: 4, input: categoryPart[j], nextState: 4 });
  }

  if (matchedCategory) {
    transitions.push({ state: 4, input: '[EOS]', nextState: 10 });
    return {
      accepted: true,
      input,
      transitions,
      finalState: 10,
      errorMessage: null,
      method: 'dfa',
      matchedCategory,
    };
  } else {
    transitions.push({ state: 4, input: '[EOS]', nextState: 11 });
    return {
      accepted: false,
      input,
      transitions,
      finalState: 11,
      errorMessage: `Unknown category "${categoryPart}". Allowed: CRITICAL, MAJOR, MINOR, ADVISORY, PASSED.`,
      method: 'dfa',
      matchedCategory: null,
    };
  }
}

// ============================================================
// Regex Validation (must agree with DFA)
// ============================================================

export interface RegexValidationResult {
  accepted: boolean;
  input: string;
  errorMessage: string | null;
  method: 'regex';
  pattern: string;
}

export function validateInspectorIdRegex(input: string): RegexValidationResult {
  const pattern = '^INS[A-Z]{2}[0-9]{4}$';
  const regex = new RegExp(pattern);
  const cleanInput = input.trim();

  if (cleanInput.length === 0) {
    return { accepted: false, input, errorMessage: 'Inspector ID is empty.', method: 'regex', pattern };
  }

  const accepted = regex.test(cleanInput);
  return {
    accepted,
    input,
    errorMessage: accepted ? null : `Inspector ID "${input}" does not match pattern ${pattern}.`,
    method: 'regex',
    pattern,
  };
}

export function validateViolationCodeRegex(input: string): RegexValidationResult {
  const pattern = '^V[0-9]{2}-(CRITICAL|MAJOR|MINOR|ADVISORY|PASSED)$';
  const regex = new RegExp(pattern);
  const cleanInput = input.trim();

  if (cleanInput.length === 0) {
    return { accepted: false, input, errorMessage: 'Violation code is empty.', method: 'regex', pattern };
  }

  const accepted = regex.test(cleanInput);
  return {
    accepted,
    input,
    errorMessage: accepted ? null : `Violation code "${input}" does not match pattern ${pattern}.`,
    method: 'regex',
    pattern,
  };
}

// Cross-validation: DFA and regex must agree
export interface CrossValidationResult {
  dfaResult: DFAValidationResult;
  regexResult: RegexValidationResult;
  agree: boolean;
  accepted: boolean;
}

export function validateInspectorId(input: string): CrossValidationResult {
  const dfaResult = validateInspectorIdDFA(input);
  const regexResult = validateInspectorIdRegex(input);
  return {
    dfaResult,
    regexResult,
    agree: dfaResult.accepted === regexResult.accepted,
    accepted: dfaResult.accepted && regexResult.accepted,
  };
}

export interface ViolationCrossValidationResult {
  dfaResult: ViolationDFAValidationResult;
  regexResult: RegexValidationResult;
  agree: boolean;
  accepted: boolean;
  matchedCategory: string | null;
}

export function validateViolationCode(input: string): ViolationCrossValidationResult {
  const dfaResult = validateViolationCodeDFA(input);
  const regexResult = validateViolationCodeRegex(input);
  return {
    dfaResult,
    regexResult,
    agree: dfaResult.accepted === regexResult.accepted,
    accepted: dfaResult.accepted && regexResult.accepted,
    matchedCategory: dfaResult.matchedCategory,
  };
}

export { INSPECTOR_STATES, CATEGORIES };
