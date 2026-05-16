'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { href: '/', label: '首页' },
  { href: '/worlds', label: '世界' },
  { href: '/providers', label: 'Provider' },
  { href: '/profiles', label: 'Profile' },
  { href: '/characters', label: '角色' },
  { href: '/simulation', label: '模拟控制台' },
  { href: '/chapters', label: '章节' },
  { href: '/traces', label: 'Trace' },
  { href: '/memories', label: '记忆审批' },
  { href: '/cost', label: '成本' },
];

export function TopNav() {
  const pathname = usePathname();
  return (
    <nav className="sticky top-0 z-30 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur">
      <div className="max-w-7xl mx-auto px-6 h-12 flex items-center gap-1 overflow-x-auto">
        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 mr-4 whitespace-nowrap">
          XXSP
        </span>
        {NAV.map((n) => {
          const active =
            n.href === '/' ? pathname === '/' : pathname.startsWith(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              className={`px-3 py-1 text-sm rounded whitespace-nowrap ${
                active
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900'
              }`}
            >
              {n.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
