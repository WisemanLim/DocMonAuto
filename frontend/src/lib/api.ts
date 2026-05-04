import axios from 'axios';
import type {
  AuthResponse,
  Storage,
  Policy,
  Agent,
  AgentStatus,
  IndexingJob,
  QueueStats,
  QueryLog,
  QueryResponse,
  DashboardStats,
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

export const authApi = {
  login: (email: string, password: string) =>
    api.post<AuthResponse>('/api/v1/auth/login', { email, password }).then((r) => r.data),
};

export const queryApi = {
  ask: (query: string) =>
    api.post<QueryResponse>('/api/v1/query', { query, channel: 'BROWSER' }).then((r) => r.data),
  history: () =>
    api.get<QueryLog[]>('/api/v1/query/history').then((r) => r.data),
};

export const storagesApi = {
  list: () => api.get<Storage[]>('/api/v1/storages').then((r) => r.data),
  create: (data: Partial<Storage> & { credentials?: Record<string, string> }) =>
    api.post<Storage>('/api/v1/storages', data).then((r) => r.data),
  toggleActive: (id: string, isActive: boolean) =>
    api.patch<Storage>(`/api/v1/storages/${id}/active`, { isActive }).then((r) => r.data),
  remove: (id: string) => api.delete(`/api/v1/storages/${id}`),
};

export const policiesApi = {
  list: () => api.get<Policy[]>('/api/v1/policies').then((r) => r.data),
  create: (data: Partial<Policy>) =>
    api.post<Policy>('/api/v1/policies', data).then((r) => r.data),
  update: (id: string, data: Partial<Policy>) =>
    api.put<Policy>(`/api/v1/policies/${id}`, data).then((r) => r.data),
  remove: (id: string) => api.delete(`/api/v1/policies/${id}`),
};

export const indexingApi = {
  stats: () => api.get<QueueStats>('/api/v1/indexing/stats').then((r) => r.data),
  jobs: () => api.get<IndexingJob[]>('/api/v1/indexing/jobs').then((r) => r.data),
};

export const adminApi = {
  dashboard: () => api.get<DashboardStats>('/api/v1/admin/dashboard').then((r) => r.data),
  agents: () => api.get<Agent[]>('/api/v1/admin/agents').then((r) => r.data),
  createAgent: (data: { name: string; endpoint: string }) =>
    api.post<Agent>('/api/v1/admin/agents', data).then((r) => r.data),
  pingAgent: (id: string) =>
    api.post<{ status: AgentStatus; latencyMs: number }>(`/api/v1/admin/agents/${id}/ping`).then((r) => r.data),
  queryLogs: () => api.get<QueryLog[]>('/api/v1/admin/query-logs').then((r) => r.data),
};

export default api;
