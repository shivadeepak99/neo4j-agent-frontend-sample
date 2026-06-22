/** Candidate reference card shape — identical to the POC's runCypher output. */
export interface Reference {
  orgId: string;
  directoryId: string;
  passportId: string;
  fullname?: string | null;
  rank?: string | null;
}

/** A stored UIMessage part (as returned by GET /api/sessions/:id). */
export interface StoredPart {
  type: string;
  text?: string;
  [key: string]: unknown;
}

/** A stored chat message (history). */
export interface StoredMessage {
  id: string;
  role: "user" | "assistant" | string;
  parts: StoredPart[];
  createdAt?: string;
}

/** Session as the sidebar uses it. */
export interface Session {
  sessionId: string;
  title: string;
  createdAt: string;
  updatedAt?: string;
}

/** Raw session row from the API. */
export interface ApiSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

/** GET /api/sessions/:id response. */
export interface SessionDetail {
  session: { id: string; title: string; createdAt: string; updatedAt: string };
  messages: StoredMessage[];
}
