'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';
import {
  MessageSquare,
  LayoutDashboard,
  Database,
  Shield,
  Activity,
  Server,
  LogOut,
  FileText,
} from 'lucide-react';

const navItems = [
  { href: '/chat', label: '채팅', icon: MessageSquare },
];

const adminItems = [
  { href: '/admin', label: '대시보드', icon: LayoutDashboard },
  { href: '/admin/storages', label: '스토리지', icon: Database },
  { href: '/admin/policies', label: '정책', icon: Shield },
  { href: '/admin/indexing', label: '인덱싱', icon: Activity },
  { href: '/admin/agents', label: '에이전트', icon: Server },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';

  function handleLogout() {
    logout();
    router.push('/login');
  }

  return (
    <aside className="w-56 shrink-0 h-screen flex flex-col bg-gray-900 text-gray-100">
      <div className="px-4 py-5 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-400" />
          <span className="font-semibold text-sm">DocMonAuto</span>
        </div>
      </div>

      <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto scrollbar-thin">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
              pathname === href || pathname.startsWith(href + '/')
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:bg-gray-800 hover:text-gray-100',
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </Link>
        ))}

        {isAdmin && (
          <>
            <div className="pt-4 pb-1 px-3">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">관리</span>
            </div>
            {adminItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                  pathname === href || (href !== '/admin' && pathname.startsWith(href))
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-gray-100',
                )}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            ))}
          </>
        )}
      </nav>

      <div className="px-2 py-4 border-t border-gray-700">
        <div className="px-3 py-2 mb-1">
          <p className="text-xs font-medium text-gray-300 truncate">{user?.name ?? user?.email}</p>
          <p className="text-xs text-gray-500">{user?.role}</p>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-gray-400 hover:bg-gray-800 hover:text-gray-100 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          로그아웃
        </button>
      </div>
    </aside>
  );
}
