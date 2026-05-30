export interface Session {
  sessionId: string;
  title: string;
  createdAt: string;
  updatedAt?: string;
}

// ---------------------------------------------------------------------------
// Dynamic card field types — mirrors buildResponse.ts CardField / DisplayField
// ---------------------------------------------------------------------------

export type FieldType = 'string' | 'number' | 'date' | 'boolean' | 'array';

/**
 * One labeled, typed field on a candidate card.
 * `requested: true` means the user explicitly asked for it — the UI
 * highlights / pins these to the top of the card.
 */
export interface CardField {
  key:       string;
  label:     string;
  value:     unknown;
  type:      FieldType;
  requested: boolean;
}

/**
 * Top-level descriptor of which dynamic columns to highlight across all cards.
 * Use this to build a consistent column header; each card's `fields` array
 * contains the actual values.
 */
export interface DisplayField {
  key:   string;
  label: string;
  type:  FieldType;
}

// ---------------------------------------------------------------------------
// UI stream message part
// ---------------------------------------------------------------------------

export interface UIMessagePart {
  type: string;
  text?: string;
  toolCallId?: string;
  toolName?: string;
  state?: string;
  input?: Record<string, unknown>;
  output?: {
    rowCount?: number;
    references?: CandidateReference[];
    rows?: Candidate[];
    /** Dynamic columns the user asked for — used to build the column header. */
    displayFields?: DisplayField[];
    /** Structured narrator answer {headline, bullets} for richer rendering. */
    answer?: { headline: string; bullets: string[] } | null;
    truncated?: boolean;
  };
  [key: string]: unknown;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  parts: UIMessagePart[];
  createdAt: string;
}

export interface CandidateReference {
  orgId: string;
  directoryId: string;
  passportId: string;
  fullname?: string | null;
}

export interface Candidate {
  // ── Core identity (backend v2 field names from buildResponse.ts) ──────────
  candidateId?: string;
  candidateDirId?: string;
  candidateDirectoryId?: string;
  fullName?: string;
  passportId?: string;

  // Backend sends these short names (not the Neo4j property names):
  rank?: string | null;           // present_rank_text
  nationality?: string | null;    // nationality_text
  availability?: string | null;   // availability_status
  score?: number;
  matchQualityBand?: 'high' | 'medium' | 'low';
  justification?: string;
  certWarnings?: string[];
  gaps?: string[];

  // Dynamic per-card fields — the user's requested fields first (requested:true),
  // then the always-on core identity fields. Render these generically so any
  // field (age, address, email, passport…) shows up without a frontend deploy.
  fields?: CardField[];

  // ── Service analytics (used for sidebar display) ─────────────────────────
  totalServiceMonths?: number;
  contractCountTotal?: number;
  projectedAvailableFrom?: string | null;
  lastSignOffDate?: string | null;

  // ── Legacy / alias fields the frontend also checks ────────────────────────
  id?: string;
  name?: string;
  directoryId?: string;
  orgId?: string;
  // Neo4j property name aliases (some historical responses used these):
  presentRankText?: string;
  nationalityText?: string;
  availabilityStatus?: string;
  fullNameNormalized?: string;
  givenNames?: string;
  surname?: string;

  [key: string]: unknown;
}

export interface QueryResponse {
  runId: string;
  userMsg: string;
  response: {
    text: string;
    [key: string]: unknown;
  };
  references: Candidate[];
  clarificationNeeded: boolean;
  pendingQuestion: string | null;
  clarificationOptions: string[];
}

export interface SessionDetail {
  session: {
    id: string;
    orgId: string;
    userId: string;
    title: string;
    createdAt: string;
    updatedAt: string;
  };
  messages: ChatMessage[];
}

export interface ApiSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}
