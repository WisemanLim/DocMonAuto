export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'EDITOR' | 'VIEWER';
export type StorageProvider = 'AWS_S3' | 'GCP_STORAGE' | 'AZURE_BLOB' | 'ON_PREMISE';
export type SecurityLevel = 'OPEN' | 'INTERNAL' | 'CONFIDENTIAL' | 'SECRET';
export type Jurisdiction = 'KR' | 'US' | 'EU' | 'GLOBAL';
export type IndexingStrategy = 'VECTOR_ONLY' | 'VECTORLESS_ONLY' | 'BOTH';
export type JobStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
export type AgentStatus = 'ONLINE' | 'OFFLINE' | 'ERROR';
export type QueryChannel = 'BROWSER' | 'API' | 'MCP' | 'A2A';

export interface User {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  orgUnit: string | null;
  jurisdiction?: Jurisdiction | null;
  createdAt: string;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export interface Agent {
  id: string;
  name: string;
  endpoint: string;
  status: AgentStatus;
  watchPath?: string | null;
  lastHeartbeat: string | Date | null;
  createdAt: string;
}

export interface Storage {
  id: string;
  name: string;
  provider: StorageProvider;
  bucketOrPath: string;
  region: string | null;
  isActive: boolean;
  agentId: string | null;
  agent: Agent | null;
  createdAt: string;
}

export interface Policy {
  id: string;
  name: string;
  priority: number;
  securityLevels: SecurityLevel[];
  jurisdictions: Jurisdiction[];
  orgUnits: string[];
  strategy: IndexingStrategy;
  indexingLocation: string | null;
  allowedLlms: string[];
  isActive: boolean;
  createdAt: string;
}

export interface IndexingJob {
  id: string;
  documentId: string;
  document: { externalId: string; storageId: string; name?: string } | null;
  status: JobStatus;
  strategy: IndexingStrategy;
  priorityScore: number;
  errorMsg: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

export interface QueryLog {
  id: string;
  query: string;
  answer: string;
  llmProvider: string | null;
  llmModel: string | null;
  latencyMs: number | null;
  channel: QueryChannel;
  createdAt: string;
}

export interface QuerySource {
  documentId: string;
  storageId?: string;
  score: number;
  source?: string | null;
  excerpt?: string | null;
  text?: string;
}

export interface QueryResponse {
  answer: string;
  sources: QuerySource[];
  llmProvider: string | null;
  llmModel: string | null;
  latencyMs: number;
  logId: string | null;
  provider?: string | null;
  model?: string | null;
}

export interface DashboardStats {
  totalDocuments: number;
  activeStorages: number;
  pendingJobs: number;
  onlineAgents: number;
  recentJobs: IndexingJob[];
  recentQueries: QueryLog[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: QueryResponse['sources'];
  llmProvider?: string;
  llmModel?: string;
  latencyMs?: number;
  createdAt: Date;
}
