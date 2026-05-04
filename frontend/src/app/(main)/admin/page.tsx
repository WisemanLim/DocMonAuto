'use client';

import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@/lib/api';
import { formatDate, jobStatusColor } from '@/lib/utils';
import { FileText, Database, Activity, Server, Loader2 } from 'lucide-react';

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number | undefined;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-2xl font-semibold text-gray-900 mt-1">
            {value ?? <Loader2 className="w-5 h-5 animate-spin text-gray-300" />}
          </p>
        </div>
        <div className={`p-3 rounded-xl ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: adminApi.dashboard,
    refetchInterval: 30_000,
  });

  return (
    <div className="h-full overflow-y-auto scrollbar-thin">
      <div className="px-6 py-6 max-w-6xl mx-auto space-y-6">
        <h1 className="text-xl font-semibold text-gray-900">대시보드</h1>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="총 문서"
            value={data?.totalDocuments}
            icon={FileText}
            color="bg-blue-50 text-blue-600"
          />
          <StatCard
            label="활성 스토리지"
            value={data?.activeStorages}
            icon={Database}
            color="bg-green-50 text-green-600"
          />
          <StatCard
            label="대기 중 작업"
            value={data?.pendingJobs}
            icon={Activity}
            color="bg-yellow-50 text-yellow-600"
          />
          <StatCard
            label="온라인 에이전트"
            value={data?.onlineAgents}
            icon={Server}
            color="bg-purple-50 text-purple-600"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="px-5 py-4 border-b">
              <h2 className="font-medium text-gray-800">최근 인덱싱 작업</h2>
            </div>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
              </div>
            ) : (
              <div className="divide-y">
                {data?.recentJobs?.slice(0, 8).map((job) => (
                  <div key={job.id} className="px-5 py-3 flex items-center justify-between text-sm">
                    <span className="text-gray-600 truncate max-w-[200px]">
                      {job.document?.externalId?.split('/').pop() ?? job.documentId.slice(0, 8)}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${jobStatusColor(job.status)}`}
                    >
                      {job.status}
                    </span>
                  </div>
                ))}
                {!data?.recentJobs?.length && (
                  <p className="text-sm text-gray-400 text-center py-8">작업 없음</p>
                )}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200">
            <div className="px-5 py-4 border-b">
              <h2 className="font-medium text-gray-800">최근 질의</h2>
            </div>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
              </div>
            ) : (
              <div className="divide-y">
                {data?.recentQueries?.slice(0, 8).map((q) => (
                  <div key={q.id} className="px-5 py-3 text-sm">
                    <p className="text-gray-800 truncate">{q.query}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {formatDate(q.createdAt)} · {q.llmProvider}
                    </p>
                  </div>
                ))}
                {!data?.recentQueries?.length && (
                  <p className="text-sm text-gray-400 text-center py-8">질의 없음</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
