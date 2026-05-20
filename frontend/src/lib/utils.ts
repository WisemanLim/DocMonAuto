import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateStr: string | Date) {
  const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  return d.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function securityLevelColor(level: string) {
  const map: Record<string, string> = {
    OPEN: 'bg-green-100 text-green-800',
    INTERNAL: 'bg-blue-100 text-blue-800',
    CONFIDENTIAL: 'bg-yellow-100 text-yellow-800',
    SECRET: 'bg-red-100 text-red-800',
  };
  return map[level] ?? 'bg-gray-100 text-gray-800';
}

export function jobStatusColor(status: string) {
  const map: Record<string, string> = {
    PENDING: 'bg-gray-100 text-gray-700',
    RUNNING: 'bg-blue-100 text-blue-700',
    COMPLETED: 'bg-green-100 text-green-700',
    FAILED: 'bg-red-100 text-red-700',
    CANCELLED: 'bg-amber-100 text-amber-800',
    // legacy 프론트 표기 호환
    PROCESSING: 'bg-blue-100 text-blue-700',
    DONE: 'bg-green-100 text-green-700',
  };
  return map[status] ?? 'bg-gray-100 text-gray-700';
}

export function agentStatusColor(status: string) {
  const map: Record<string, string> = {
    ONLINE: 'bg-green-100 text-green-700',
    OFFLINE: 'bg-gray-100 text-gray-700',
    ERROR: 'bg-red-100 text-red-700',
  };
  return map[status] ?? 'bg-gray-100 text-gray-700';
}
