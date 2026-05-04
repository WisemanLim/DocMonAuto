'use client';

import { useQuery } from '@tanstack/react-query';
import { indexingApi } from '@/lib/api';
import { formatDate, jobStatusColor } from '@/lib/utils';
import { Loader2, Activity } from 'lucide-react';

function QueueCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`text-3xl font-semibold mt-1 ${color}`}>{value}</p>
    </div>
  );
}

export default function IndexingPage() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['indexing-stats'],
    queryFn: indexingApi.stats,
    refetchInterval: 10_000,
  });

  const { data: jobs, isLoading: jobsLoading } = useQuery({
    queryKey: ['indexing-jobs'],
    queryFn: indexingApi.jobs,
    refetchInterval: 10_000,
  });

  return (
    <div className="h-full overflow-y-auto scrollbar-thin">
      <div className="px-6 py-6 max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-gray-900">인덱싱 모니터</h1>
          <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
            <Activity className="w-3 h-3" />
            실시간 10s
          </span>
        </div>

        {statsLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <QueueCard label="대기" value={stats?.waiting ?? 0} color="text-yellow-600" />
            <QueueCard label="처리 중" value={stats?.active ?? 0} color="text-blue-600" />
            <QueueCard label="완료" value={stats?.completed ?? 0} color="text-green-600" />
            <QueueCard label="실패" value={stats?.failed ?? 0} color="text-red-600" />
            <QueueCard label="지연" value={stats?.delayed ?? 0} color="text-gray-500" />
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b flex items-center justify-between">
            <h2 className="font-medium text-gray-800">작업 목록</h2>
            {jobsLoading && <Loader2 className="w-4 h-4 animate-spin text-gray-300" />}
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left px-5 py-3 font-medium text-gray-600">문서</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">전략</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">우선순위</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">상태</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">소요 시간</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">생성일</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {jobs?.map((job) => {
                const elapsed =
                  job.startedAt && job.completedAt
                    ? `${Math.round((new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime()) / 1000)}s`
                    : job.startedAt
                    ? '진행 중'
                    : '—';
                return (
                  <tr key={job.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 text-gray-700 font-mono text-xs max-w-[200px] truncate">
                      {job.document?.externalId?.split('/').pop() ?? job.documentId.slice(0, 12) + '…'}
                    </td>
                    <td className="px-5 py-3 text-gray-500 text-xs">{job.strategy}</td>
                    <td className="px-5 py-3 text-gray-500">{job.priorityScore.toFixed(2)}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${jobStatusColor(job.status)}`}>
                        {job.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-400 text-xs">{elapsed}</td>
                    <td className="px-5 py-3 text-gray-400 text-xs">{formatDate(job.createdAt)}</td>
                  </tr>
                );
              })}
              {!jobs?.length && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-gray-400">
                    작업 없음
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
