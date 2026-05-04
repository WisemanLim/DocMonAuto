'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { storagesApi } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import type { StorageProvider } from '@/types';
import { Plus, Trash2, Power, Loader2, Database } from 'lucide-react';

const PROVIDERS: StorageProvider[] = ['AWS_S3', 'GCP_STORAGE', 'AZURE_BLOB', 'ON_PREMISE'];
const PROVIDER_LABEL: Record<StorageProvider, string> = {
  AWS_S3: 'AWS S3',
  GCP_STORAGE: 'GCP Storage',
  AZURE_BLOB: 'Azure Blob',
  ON_PREMISE: '온프레미스',
};

function AddStorageModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    name: '',
    provider: 'ON_PREMISE' as StorageProvider,
    bucketOrPath: '',
    region: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await storagesApi.create(form);
      onCreated();
      onClose();
    } catch {
      setError('스토리지 생성에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h2 className="font-semibold text-gray-900 mb-4">스토리지 등록</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">이름</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">제공자</label>
            <select
              value={form.provider}
              onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value as StorageProvider }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {PROVIDERS.map((p) => (
                <option key={p} value={p}>{PROVIDER_LABEL[p]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              버킷 / 경로
            </label>
            <input
              required
              value={form.bucketOrPath}
              onChange={(e) => setForm((f) => ({ ...f, bucketOrPath: e.target.value }))}
              placeholder={form.provider === 'ON_PREMISE' ? '/watch' : 'my-bucket'}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {form.provider !== 'ON_PREMISE' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">리전</label>
              <input
                value={form.region}
                onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))}
                placeholder="ap-northeast-2"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}
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

export default function StoragesPage() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);

  const { data: storages, isLoading } = useQuery({
    queryKey: ['storages'],
    queryFn: storagesApi.list,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      storagesApi.toggleActive(id, isActive),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['storages'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: storagesApi.remove,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['storages'] }),
  });

  function confirmDelete(id: string, name: string) {
    if (confirm(`"${name}" 스토리지를 삭제하시겠습니까?`)) {
      deleteMutation.mutate(id);
    }
  }

  return (
    <div className="h-full overflow-y-auto scrollbar-thin">
      <div className="px-6 py-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold text-gray-900">스토리지 관리</h1>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            스토리지 등록
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
                  <th className="text-left px-5 py-3 font-medium text-gray-600">제공자</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">경로/버킷</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">에이전트</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">상태</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">등록일</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {storages?.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-900 flex items-center gap-2">
                      <Database className="w-4 h-4 text-gray-400" />
                      {s.name}
                    </td>
                    <td className="px-5 py-3 text-gray-600">{PROVIDER_LABEL[s.provider]}</td>
                    <td className="px-5 py-3 text-gray-500 font-mono text-xs">{s.bucketOrPath}</td>
                    <td className="px-5 py-3 text-gray-500 text-xs">{s.agent?.name ?? '—'}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          s.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {s.isActive ? '활성' : '비활성'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-400 text-xs">{formatDate(s.createdAt)}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => toggleMutation.mutate({ id: s.id, isActive: !s.isActive })}
                          className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                          title={s.isActive ? '비활성화' : '활성화'}
                        >
                          <Power className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => confirmDelete(s.id, s.name)}
                          className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"
                          title="삭제"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!storages?.length && (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-gray-400">
                      등록된 스토리지가 없습니다
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAdd && (
        <AddStorageModal
          onClose={() => setShowAdd(false)}
          onCreated={() => qc.invalidateQueries({ queryKey: ['storages'] })}
        />
      )}
    </div>
  );
}
