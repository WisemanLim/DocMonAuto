import axios from 'axios';
import type {
  AuthResponse,
  Storage,
  Policy,
  Agent,
  IndexingJob,
  QueueStats,
  QueryLog,
  QueryResponse,
  QuerySource,
  DashboardStats,
  StorageProvider,
} from '@/types';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('access_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  },
);

function normalizeQueryResponse(raw: QueryResponse): QueryResponse {
  const sources: QuerySource[] = (raw.sources ?? []).map((s) => ({
    documentId: s.documentId,
    storageId: s.storageId,
    score: typeof s.score === 'number' ? s.score : 0,
    source: s.source ?? null,
    excerpt: s.excerpt ?? null,
    text: s.text ?? s.excerpt ?? '',
  }));
  return {
    ...raw,
    sources,
    llmProvider: raw.llmProvider ?? raw.provider ?? null,
    llmModel: raw.llmModel ?? raw.model ?? null,
  };
}

export const authApi = {
  login: (email: string, password: string) =>
    api.post<AuthResponse>('/v1/auth/login', { email, password }).then((r) => r.data),
};

export const queryApi = {
  ask: (query: string) =>
    api
      .post<QueryResponse>('/v1/query', { query, channel: 'BROWSER' })
      .then((r) => normalizeQueryResponse(r.data)),
  history: () => api.get<QueryLog[]>('/v1/query/history').then((r) => r.data),
};

export type StorageCreateInput = {
  name: string;
  provider: StorageProvider;
  bucketOrPath: string;
  region?: string;
  agentId?: string;
};

export const storagesApi = {
  list: () => api.get<Storage[]>('/v1/storages').then((r) => r.data),
  create: (data: StorageCreateInput) => {
    const config: Record<string, string> = { bucketOrPath: data.bucketOrPath };
    if (data.provider === 'ON_PREMISE') {
      config.watchPath = data.bucketOrPath;
    }
    if (data.region) {
      config.region = data.region;
    }
    return api
      .post<Storage>('/v1/storages', {
        name: data.name,
        provider: data.provider,
        config,
        agentId: data.agentId,
      })
      .then((r) => r.data);
  },
  toggleActive: (id: string, isActive: boolean) =>
    api.patch<Storage>(`/v1/storages/${id}/active`, { isActive }).then((r) => r.data),
  remove: (id: string) => api.delete(`/v1/storages/${id}`),
};

export const policiesApi = {
  list: () => api.get<Policy[]>('/v1/policies').then((r) => r.data),
  create: (data: Partial<Policy>) => api.post<Policy>('/v1/policies', data).then((r) => r.data),
  update: (id: string, data: Partial<Policy>) =>
    api.put<Policy>(`/v1/policies/${id}`, data).then((r) => r.data),
  remove: (id: string) => api.delete(`/v1/policies/${id}`),
};

export const indexingApi = {
  stats: () => api.get<QueueStats>('/v1/indexing/stats').then((r) => r.data),
  jobs: () => api.get<IndexingJob[]>('/v1/indexing/jobs').then((r) => r.data),
};

export type RegisterAgentInput = {
  name: string;
  endpoint: string;
  secret: string;
  watchPath?: string;
};

export const adminApi = {
  dashboard: () => api.get<DashboardStats>('/v1/admin/dashboard').then((r) => r.data),
  agents: () => api.get<Agent[]>('/v1/admin/agents').then((r) => r.data),
  createAgent: (data: RegisterAgentInput) =>
    api.post<Agent>('/v1/admin/agents', data).then((r) => r.data),
  pingAgent: (id: string) =>
    api
      .post<{ status: 'online' | 'offline'; latencyMs: number }>(`/v1/admin/agents/${id}/ping`)
      .then((r) => r.data),
  queryLogs: () => api.get<QueryLog[]>('/v1/admin/query-logs').then((r) => r.data),
};

export default api;
