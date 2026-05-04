'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { policiesApi } from '@/lib/api';
import { securityLevelColor, formatDate } from '@/lib/utils';
import type { Policy, SecurityLevel, Jurisdiction, IndexingStrategy } from '@/types';
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react';

const SECURITY_LEVELS: SecurityLevel[] = ['OPEN', 'INTERNAL', 'CONFIDENTIAL', 'SECRET'];
const JURISDICTIONS: Jurisdiction[] = ['KR', 'US', 'EU', 'GLOBAL'];
const STRATEGIES: IndexingStrategy[] = ['VECTOR_ONLY', 'VECTORLESS_ONLY', 'BOTH'];
const LLM_PROVIDERS = ['openai', 'google', 'ollama', 'aws-bedrock'];

function PolicyModal({
  policy,
  onClose,
  onSaved,
}: {
  policy?: Policy;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: policy?.name ?? '',
    priority: policy?.priority ?? 0,
    securityLevels: policy?.securityLevels ?? [] as SecurityLevel[],
    jurisdictions: policy?.jurisdictions ?? [] as Jurisdiction[],
    strategy: policy?.strategy ?? 'BOTH' as IndexingStrategy,
    allowedLlms: policy?.allowedLlms ?? [] as string[],
    isActive: policy?.isActive ?? true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  function toggleArray<T>(arr: T[], val: T): T[] {
    return arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val];
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      if (policy) {
        await policiesApi.update(policy.id, form);
      } else {
        await policiesApi.create(form);
      }
      onSaved();
      onClose();
    } catch {
      setError('저장에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-5 border-b">
          <h2 className="font-semibold text-gray-900">{policy ? '정책 수정' : '정책 생성'}</h2>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">정책 이름</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">우선순위</label>
              <input
                type="number"
                value={form.priority}
                onChange={(e) => setForm((f) => ({ ...f, priority: Number(e.target.value) }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">보안 등급</label>
            <div className="flex flex-wrap gap-2">
              {SECURITY_LEVELS.map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, securityLevels: toggleArray(f.securityLevels, lvl) }))}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    form.securityLevels.includes(lvl)
                      ? securityLevelColor(lvl) + ' border-transparent'
                      : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">관할권</label>
            <div className="flex flex-wrap gap-2">
              {JURISDICTIONS.map((j) => (
                <button
                  key={j}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, jurisdictions: toggleArray(f.jurisdictions, j) }))}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    form.jurisdictions.includes(j)
                      ? 'bg-blue-100 text-blue-800 border-transparent'
                      : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {j}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">인덱싱 전략</label>
            <select
              value={form.strategy}
              onChange={(e) => setForm((f) => ({ ...f, strategy: e.target.value as IndexingStrategy }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {STRATEGIES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">허용 LLM</label>
            <div className="flex flex-wrap gap-2">
              {LLM_PROVIDERS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, allowedLlms: toggleArray(f.allowedLlms, p) }))}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    form.allowedLlms.includes(p)
                      ? 'bg-purple-100 text-purple-800 border-transparent'
                      : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              checked={form.isActive}
              onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
              className="rounded"
            />
            <label htmlFor="isActive" className="text-sm text-gray-700">활성화</label>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2 justify-end pt-2 border-t">
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
              {submitting ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function PoliciesPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Policy | undefined>(undefined);
  const [showAdd, setShowAdd] = useState(false);

  const { data: policies, isLoading } = useQuery({
    queryKey: ['policies'],
    queryFn: policiesApi.list,
  });

  const deleteMutation = useMutation({
    mutationFn: policiesApi.remove,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['policies'] }),
  });

  function confirmDelete(id: string, name: string) {
    if (confirm(`"${name}" 정책을 삭제하시겠습니까?`)) deleteMutation.mutate(id);
  }

  return (
    <div className="h-full overflow-y-auto scrollbar-thin">
      <div className="px-6 py-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold text-gray-900">정책 관리</h1>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            정책 생성
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
          </div>
        ) : (
          <div className="space-y-3">
            {policies?.map((p) => (
              <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-medium text-gray-900">{p.name}</span>
                      <span className="text-xs text-gray-400">우선순위 {p.priority}</span>
                      {!p.isActive && (
                        <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">비활성</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {p.securityLevels.map((lvl) => (
                        <span key={lvl} className={`text-xs px-2 py-0.5 rounded-full font-medium ${securityLevelColor(lvl)}`}>
                          {lvl}
                        </span>
                      ))}
                      {p.jurisdictions.map((j) => (
                        <span key={j} className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">{j}</span>
                      ))}
                      <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-700">{p.strategy}</span>
                      {p.allowedLlms.map((l) => (
                        <span key={l} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{l}</span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-4">
                    <button
                      onClick={() => setEditing(p)}
                      className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => confirmDelete(p.id, p.name)}
                      className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-3">{formatDate(p.createdAt)}</p>
              </div>
            ))}
            {!policies?.length && (
              <div className="text-center py-20 text-gray-400">등록된 정책이 없습니다</div>
            )}
          </div>
        )}
      </div>

      {(showAdd || editing) && (
        <PolicyModal
          policy={editing}
          onClose={() => { setShowAdd(false); setEditing(undefined); }}
          onSaved={() => qc.invalidateQueries({ queryKey: ['policies'] })}
        />
      )}
    </div>
  );
}
