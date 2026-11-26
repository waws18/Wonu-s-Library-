import {
  BarChart3,
  BookOpen,
  Compass,
  FileSpreadsheet,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  UserCheck,
  X,
} from 'lucide-react';
import type { UserProfile } from '../types/library';

export type NavTab =
  | 'catalog'
  | 'member-dashboard'
  | 'admin-dashboard'
  | 'collection-manager'
  | 'automated-reports'
  | 'digital-services';

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  currentUser: UserProfile | null;
  onOpenAuth: (defaultMode?: 'member' | 'register' | 'admin') => void;
  onLogout: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({
  activeTab,
  onSelectTab,
  currentUser,
  onOpenAuth,
  onLogout,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const navItems: {
    id: NavTab;
    label: string;
    section: 'umum' | 'admin';
    icon: typeof BookOpen;
  }[] = [
    { id: 'catalog', label: 'Jelajah Katalog', section: 'umum', icon: BookOpen },
    { id: 'member-dashboard', label: 'Dashboard Anggota', section: 'umum', icon: LayoutDashboard },
    { id: 'digital-services', label: 'Layanan Digital', section: 'umum', icon: Compass },
    { id: 'admin-dashboard', label: 'Dashboard Admin', section: 'admin', icon: BarChart3 },
    { id: 'collection-manager', label: 'Manajemen Koleksi', section: 'admin', icon: FolderKanban },
    { id: 'automated-reports', label: 'Pelaporan Otomatis', section: 'admin', icon: FileSpreadsheet },
  ];

  const handleNav = (id: NavTab) => {
    onSelectTab(id);
    onCloseMobile();
  };

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 z-30 lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-[252px] bg-white border-r border-slate-200 flex flex-col transition-transform duration-200 lg:static lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-16 px-5 flex items-center justify-between border-b border-slate-200 shrink-0">
          <button
            type="button"
            onClick={() => handleNav('catalog')}
            className="text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D5C46] rounded-sm"
          >
            <span className="font-serif text-xl font-semibold tracking-tight text-slate-900 whitespace-nowrap">
              wonu&apos;s library
            </span>
          </button>
          <button
            type="button"
            onClick={onCloseMobile}
            className="lg:hidden p-1.5 text-slate-500 hover:text-slate-900 rounded-md"
            aria-label="Tutup navigasi"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-5 space-y-6">
          <div>
            <p className="px-3 mb-2 text-xs font-medium text-slate-400">Ruang Pembaca</p>
            <div className="space-y-1">
              {navItems
                .filter((i) => i.section === 'umum')
                .map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleNav(item.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                        isActive
                          ? 'bg-[#0D5C46] text-white'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200">
            <p className="px-3 mb-2 text-xs font-medium text-slate-400">Konsol Pustakawan</p>
            <div className="space-y-1">
              {navItems
                .filter((i) => i.section === 'admin')
                .map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleNav(item.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                        isActive
                          ? 'bg-[#0D5C46] text-white'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
            </div>
          </div>
        </nav>

        <div className="p-4 border-t border-slate-200 bg-slate-50/70 shrink-0">
          {currentUser ? (
            <div className="space-y-3">
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-md bg-[#0D5C46]/10 text-[#0D5C46] flex items-center justify-center shrink-0">
                  {currentUser.role === 'admin' ? (
                    <ShieldCheck className="w-4 h-4" />
                  ) : (
                    <UserCheck className="w-4 h-4" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900 truncate">{currentUser.name}</p>
                  <p className="text-xs font-mono text-slate-500 truncate">
                    {currentUser.role === 'admin' ? 'Admin' : 'Anggota'} · {currentUser.memberCode}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onLogout}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Keluar Sesi</span>
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-slate-600 leading-relaxed">
                Masuk untuk meminjam buku, memantau aktivitas, atau mengelola koleksi.
              </p>
              <button
                type="button"
                onClick={() => onOpenAuth('member')}
                className="w-full px-3 py-2 text-xs font-medium text-white bg-[#0D5C46] rounded-lg hover:bg-[#094232] transition-colors"
              >
                Masuk atau Daftar
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
