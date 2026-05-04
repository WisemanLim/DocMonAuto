'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/lib/api';
import { agentStatusColor, formatDate } from '@/lib/utils';
import { Plus, Wifi, Loader2, Server } from 'lucide-react';

function AddAgentModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ name: '', endpoint: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await adminApi.createAgent(form);
      onCreated();
      onClose();
    } catch {
      setError('에이전트 등록에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
        <h2 className="font-semibold text-gray-900 mb-4">에이전트 등록</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">이름</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Local Agent"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">엔드포인트</label>
            <input
              required
              value={form.endpoint}
              onChange={(e) => setForm((f) => ({ ...f, endpoint: e.target.value }))}
              placeholder="http://agent:8080"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? '등록 중...' : '등록'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AgentsPage() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [pingResults, setPingResults] = useState<Record<string, { latencyMs: number } | 'error'>>({});

  const { data: agents, isLoading } = useQuery({
    queryKey: ['admin-agents'],
    queryFn: adminApi.agents,
    refetchInterval: 30_000,
  });

  const pingMutation = useMutation({
    mutationFn: adminApi.pingAgent,
    onSuccess: (data, id) => {
      setPingResults((prev) => ({ ...prev, [id]: { latencyMs: data.latencyMs } }));
      qc.invalidateQueries({ queryKey: ['admin-agents'] });
    },
    onError: (_, id) => {
      setPingResults((prev) => ({ ...prev, [id]: 'error' }));
    },
  });

  return (
    <div className="h-full overflow-y-auto scrollbar-thin">
      <div className="px-6 py-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold text-gray-900">에이전트 관리</h1>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            에이전트 등록
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-5 py-3 font-medium text-gray-600">이름</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">엔드포인트</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">상태</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">마지막 확인</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">등록일</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {agents?.map((agent) => {
                  const ping = pingResults[agent.id];
                  return (
                    <tr key={agent.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3 font-medium text-gray-900 flex items-center gap-2">
                        <Server className="w-4 h-4 text-gray-400" />
                        {agent.name}
                      </td>
                      <td className="px-5 py-3 text-gray-500 font-mono text-xs">{agent.endpoint}</td>
                      <td className="px-5 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${agentStatusColor(agent.status)}`}>
                          {agent.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-gray-400 text-xs">
                        {agent.lastSeenAt ? formatDate(agent.lastSeenAt) : '—'}
                      </td>
                      <td className="px-5 py-3 text-gray-400 text-xs">{formatDate(agent.createdAt)}</td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center gap-2 justify-end">
                          {ping && ping !== 'error' && (
                            <span className="text-xs text-green-600">{ping.latencyMs}ms</span>
                          )}
                          {ping === 'error' && (
                            <span className="text-xs text-red-500">연결 실패</span>
                          )}
                          <button
                            onClick={() => pingMutation.mutate(agent.id)}
                            disabled={pingMutation.isPending}
                            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                          >
                            {pingMutation.isPending ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Wifi className="w-3 h-3" />
                            )}
                            Ping
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!agents?.length && (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-gray-400">
                      등록된 에이전트가 없습니다
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAdd && (
        <AddAgentModal
          onClose={() => setShowAdd(false)}
          onCreated={() => qc.invalidateQueries({ queryKey: ['admin-agents'] })}
        />
      )}
    </div>
  );
}
