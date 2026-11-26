import { Menu, Radio } from 'lucide-react';
import type { UserProfile } from '../types/library';
import type { NavTab } from './Sidebar';

interface TopBarProps {
  activeTab: NavTab;
  sseConnected: boolean;
  currentUser: UserProfile | null;
  onOpenMobileMenu: () => void;
  onOpenAuth: (mode?: 'member' | 'register' | 'admin') => void;
}

const BREADCRUMBS: Record<NavTab, { section: string; page: string }> = {
  catalog: { section: "wonu's library", page: 'Katalog & Peminjaman' },
  'member-dashboard': { section: 'Ruang Pembaca', page: 'Dashboard Anggota' },
  'digital-services': { section: 'Layanan Tambahan', page: 'Ruang Baca & Usulan Koleksi' },
  'admin-dashboard': { section: 'Konsol Pustakawan', page: 'Dashboard Admin Real-Time' },
  'collection-manager': { section: 'Konsol Pustakawan', page: 'Manajemen Koleksi' },
  'automated-reports': { section: 'Konsol Pustakawan', page: 'Sistem Pelaporan Otomatis' },
};

export function TopBar({
  activeTab,
  sseConnected,
  currentUser,
  onOpenMobileMenu,
  onOpenAuth,
}: TopBarProps) {
  const crumb = BREADCRUMBS[activeTab];

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-4 lg:px-8 flex items-center justify-between gap-8 shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 -ml-1 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100"
          aria-label="Buka menu navigasi"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 text-sm min-w-0">
          <span className="text-slate-400 whitespace-nowrap hidden sm:inline">{crumb.section}</span>
          <span className="text-slate-300 hidden sm:inline" aria-hidden="true">
            /
          </span>
          <span className="font-semibold text-slate-900 truncate">{crumb.page}</span>
        </div>
      </div>

      <div className="flex items-center gap-5 shrink-0">
        <div
          className="hidden md:flex items-center gap-1.5 text-xs font-medium text-slate-600 whitespace-nowrap"
          title="Status sinkronisasi transaksi real-time dengan server"
        >
          <Radio className={`w-3.5 h-3.5 ${sseConnected ? 'text-[#16A34A]' : 'text-amber-600'}`} />
          <span>{sseConnected ? 'Sinkronisasi Real-Time' : 'Menghubungkan...'}</span>
        </div>

        {currentUser ? (
          <div className="text-xs font-medium text-slate-700 whitespace-nowrap shrink-0">
            {currentUser.name} · <span className="font-mono text-slate-500">{currentUser.memberCode}</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onOpenAuth('member')}
            className="px-4 py-2 text-xs font-medium text-white bg-[#0D5C46] rounded-lg hover:bg-[#094232] transition-colors whitespace-nowrap shrink-0"
          >
            Masuk Akun
          </button>
        )}
      </div>
    </header>
  );
}
