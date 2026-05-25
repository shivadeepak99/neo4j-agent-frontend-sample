export interface Session {
  sessionId: string;
  title: string;
  userId: string;
  createdAt: string;
}

export interface Turn {
  turnIndex: number;
  userQuery: string;
  agentAnswer: string;
  latencyMs?: number;
  createdAt?: string;
}

export interface Candidate {
  id: string;
  name: string;
  role: string;
  vessels?: string;
  availability?: string;
  status?: string;
  wage?: string;
  lastContact?: string;
  [key: string]: any;
}

export interface QueryResponse {
  runId: string;
  userMsg: string;
  response: {
    text: string;
    [key: string]: any;
  };
  references: Candidate[];
  clarificationNeeded: boolean;
  pendingQuestion: string | null;
  clarificationOptions: string[];
}

export interface SessionDetail {
  sessionId: string;
  userId: string;
  title: string;
  turns: Turn[];
  lastResultSet: string[];
  lastResultSummaries: Candidate[];
}
