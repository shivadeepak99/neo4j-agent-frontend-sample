export interface Session {
  sessionId: string;
  title: string;
  createdAt: string;
  updatedAt?: string;
}

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
  // Core identity (backend field names)
  candidateId?: string;
  candidateDirId?: string;
  candidateDirectoryId?: string;
  fullName?: string;
  fullNameNormalized?: string;
  givenNames?: string;
  surname?: string;
  passportId?: string;
  // Rank
  presentRankText?: string;
  presentRankKey?: string;
  targetRankText?: string;
  department?: string;
  // Nationality / location
  nationalityText?: string;
  nationalityCountryCode?: string;
  residenceCountryText?: string;
  currentCity?: string;
  // Availability
  availabilityStatus?: string;
  availableFromDate?: string;
  projectedAvailableFromDate?: string;
  lastSignOffDate?: string;
  seaDaysInCurrentFy?: number;
  // Experience
  totalServiceMonths?: number;
  contractCountTotal?: number;
  distinctVesselTypeCount?: number;
  distinctCompanyCount?: number;
  avgContractDurationMonths?: number;
  avgLeaveBetweenContractsDays?: number;
  // Credentials
  hasValidStcw?: boolean;
  hasManagementLevelCert?: boolean;
  hasOperationalLevelCert?: boolean;
  validPassportUntil?: string;
  validMedicalUntil?: string;
  // Scores
  marlinsEnglishScore?: number;
  cesEnglishScore?: number;
  profileCompletenessScore?: number;
  // Contact
  primaryEmail?: string;
  primaryMobile?: string;
  // Deterministic score (ranker)
  deterministicScore?: number;
  // Legacy / alias fields the frontend also checks
  id?: string;
  name?: string;
  directoryId?: string;
  orgId?: string;
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
