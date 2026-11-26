import { useEffect, useState } from 'react';
import {
  Bell,
  Bookmark,
  BookOpen,
  CalendarClock,
  CheckCheck,
  CreditCard,
  RefreshCw,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import type {
  ActivityEvent,
  Book,
  LibraryNotification,
  LoanTransaction,
  Reservation,
  UserProfile,
} from '../types/library';
import { daysRemainingLabel, formatDateId, formatRupiah, formatTimeOnly } from '../utils/format';

interface MemberDashboardData {
  loans: LoanTransaction[];
  reservations: Reservation[];
  wishlistIds: string[];
  wishlistBooks: Book[];
  notifications: LibraryNotification[];
  personalStats: {
    activeCount: number;
    overdueCount: number;
    completedCount: number;
    totalFines: number;
    categoryBreakdown: { category: string; count: number }[];
  };
  recentActivities: ActivityEvent[];
}

interface MemberDashboardProps {
  currentUser: UserProfile | null;
  token: string | null;
  refreshKey: number;
  liveActivities: ActivityEvent[];
  onOpenAuth: (mode: 'member' | 'register' | 'admin') => void;
  onSelectBook: (book: Book) => void;
  onReturnLoan: (loanId: string) => Promise<void>;
  onRenewLoan: (loanId: string) => Promise<void>;
  onCancelReservation: (resId: string) => Promise<void>;
  onRemoveWishlist: (bookId: string) => Promise<void>;
}

export function MemberDashboard({
  currentUser,
  token,
  refreshKey,
  liveActivities,
  onOpenAuth,
  onSelectBook,
  onReturnLoan,
  onRenewLoan,
  onCancelReservation,
  onRemoveWishlist,
}: MemberDashboardProps) {
  const [data, setData] = useState<MemberDashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [historyFilter, setHistoryFilter] = useState<'active' | 'history'>('active');

  useEffect(() => {
    if (!currentUser || !token) {
      setData(null);
      return;
    }
    setLoading(true);
    fetch('/api/member/dashboard', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((json: MemberDashboardData) => {
        setData(json);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [currentUser, token, refreshKey]);

  if (!currentUser || !token) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-10 text-center max-w-xl mx-auto my-8 space-y-4">
        <h2 className="font-serif text-2xl font-semibold text-slate-900">Dashboard Anggota</h2>
        <p className="text-sm text-slate-600 leading-relaxed">
          Masuk atau daftarkan akun anggota untuk memantau pinjaman aktif, jadwal jatuh tempo, antrean reservasi,
          daftar baca tersimpan, dan kartu anggota digital Anda.
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => onOpenAuth('member')}
            className="px-5 py-2.5 text-xs font-medium text-white bg-[#0D5C46] rounded-lg hover:bg-[#094232] transition-colors"
          >
            Masuk Anggota
          </button>
          <button
            type="button"
            onClick={() => onOpenAuth('register')}
            className="px-5 py-2.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Daftar Anggota Baru
          </button>
        </div>
      </div>
    );
  }

  async function handleAction(id: string, fn: () => Promise<void>, successText: string) {
    setBusyId(id);
    setNotice(null);
    try {
      await fn();
      setNotice({ type: 'success', text: successText });
    } catch (err) {
      setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Tindakan gagal.' });
    } finally {
      setBusyId(null);
    }
  }

  async function markAllNotificationsRead() {
    if (!token) return;
    await fetch('/api/member/notifications/read', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    setData((prev) =>
      prev
        ? { ...prev, notifications: prev.notifications.map((n) => ({ ...n, read: true })) }
        : prev
    );
  }

  const loans = data?.loans || [];
  const activeLoans = loans.filter((l) => l.status === 'active' || l.status === 'overdue');
  const pastLoans = loans.filter((l) => l.status === 'returned');
  const shownLoans = historyFilter === 'active' ? activeLoans : pastLoans;
  const unreadNotifs = (data?.notifications || []).filter((n) => !n.read).length;

  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500">Pinjaman Aktif</p>
          <p className="font-mono text-2xl font-semibold text-slate-900 tabular-nums mt-1">
            {data?.personalStats.activeCount ?? 0}{' '}
            <span className="text-xs font-normal text-slate-400">/ {currentUser.maxLoans}</span>
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500">Buku Selesai Dibaca</p>
          <p className="font-mono text-2xl font-semibold text-[#16A34A] tabular-nums mt-1">
            {data?.personalStats.completedCount ?? 0}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500">Antrean Reservasi</p>
          <p className="font-mono text-2xl font-semibold text-slate-900 tabular-nums mt-1">
            {data?.reservations.length ?? 0}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500">Akumulasi Denda</p>
          <p
            className={`font-mono text-2xl font-semibold tabular-nums mt-1 ${
              (data?.personalStats.totalFines ?? 0) > 0 ? 'text-[#DC2626]' : 'text-slate-900'
            }`}
          >
            {formatRupiah(data?.personalStats.totalFines ?? 0)}
          </p>
        </div>
      </div>

      {notice && (
        <div
          className={`px-4 py-3 rounded-lg border text-xs ${
            notice.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          {notice.text}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left: Active & Past Loans */}
        <div className="xl:col-span-8 space-y-6">
          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-serif text-lg font-semibold text-slate-900">Sirkulasi Peminjaman Saya</h2>
                <p className="text-xs text-slate-500">Kelola pengembalian mandiri atau perpanjangan masa pinjam</p>
              </div>
              <div className="inline-flex items-center p-1 bg-slate-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => setHistoryFilter('active')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    historyFilter === 'active' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Sedang Dipinjam ({activeLoans.length})
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryFilter('history')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    historyFilter === 'history' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Riwayat ({pastLoans.length})
                </button>
              </div>
            </div>

            {loading && !data ? (
              <div className="p-8 text-center text-xs text-slate-500">Memuat data peminjaman...</div>
            ) : shownLoans.length === 0 ? (
              <div className="p-10 text-center space-y-2">
                <p className="text-sm font-medium text-slate-800">
                  {historyFilter === 'active'
                    ? 'Tidak ada buku yang sedang Anda pinjam saat ini.'
                    : 'Belum ada riwayat pengembalian buku.'}
                </p>
                <p className="text-xs text-slate-500">
                  Jelajahi katalog untuk meminjam buku cetak maupun edisi digital.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                      <th className="py-3 px-5">Buku &amp; Kode Transaksi</th>
                      <th className="py-3 px-4">Jatuh Tempo</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-5 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {shownLoans.map((loan) => {
                      const rem = daysRemainingLabel(loan.dueDate);
                      return (
                        <tr key={loan.id} className="hover:bg-slate-50/60">
                          <td className="py-3.5 px-5">
                            <p className="font-semibold text-slate-900">{loan.bookTitle}</p>
                            <p className="font-mono text-[11px] text-slate-500 mt-0.5">
                              {loan.code} · {loan.bookCallNumber}
                            </p>
                          </td>
                          <td className="py-3.5 px-4 font-mono tabular-nums text-slate-700">
                            <div>{formatDateId(loan.dueDate)}</div>
                            {loan.status !== 'returned' && (
                              <div
                                className={`text-[11px] mt-0.5 ${
                                  rem.overdue ? 'text-[#DC2626] font-medium' : rem.urgent ? 'text-[#D97706]' : 'text-slate-400'
                                }`}
                              >
                                {rem.text}
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            {loan.status === 'returned' ? (
                              <span className="font-medium text-slate-600">
                                Dikembalikan {formatDateId(loan.returnedAt)}
                              </span>
                            ) : loan.status === 'overdue' ? (
                              <span className="font-medium text-[#DC2626] tabular-nums">
                                Terlambat · {formatRupiah(loan.fineAmount)}
                              </span>
                            ) : (
                              <span className="font-medium text-[#16A34A]">Aktif</span>
                            )}
                          </td>
                          <td className="py-3.5 px-5 text-right whitespace-nowrap">
                            {loan.status !== 'returned' ? (
                              <div className="inline-flex items-center gap-2">
                                {loan.status === 'active' && loan.renewedCount === 0 && (
                                  <button
                                    type="button"
                                    disabled={busyId === loan.id}
                                    onClick={() =>
                                      handleAction(
                                        loan.id,
                                        () => onRenewLoan(loan.id),
                                        `Masa pinjam "${loan.bookTitle}" diperpanjang +7 hari.`
                                      )
                                    }
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-50"
                                  >
                                    <RefreshCw className="w-3 h-3" />
                                    <span>Perpanjang</span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  disabled={busyId === loan.id}
                                  onClick={() =>
                                    handleAction(
                                      loan.id,
                                      () => onReturnLoan(loan.id),
                                      `Buku "${loan.bookTitle}" berhasil dikembalikan.`
                                    )
                                  }
                                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-[#0D5C46] rounded-md hover:bg-[#094232] disabled:opacity-50"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  <span>Kembalikan</span>
                                </button>
                              </div>
                            ) : (
                              <span className="font-mono text-[11px] text-slate-400">Selesai</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Reservations & Wishlist */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CalendarClock className="w-4 h-4 text-[#0D5C46]" />
                  <h3 className="text-sm font-semibold text-slate-900">Antrean Reservasi</h3>
                </div>
                <span className="font-mono text-xs text-slate-500 tabular-nums">
                  {data?.reservations.length ?? 0} aktif
                </span>
              </div>

              {(data?.reservations.length ?? 0) === 0 ? (
                <p className="text-xs text-slate-500">Anda tidak memiliki antrean reservasi buku saat ini.</p>
              ) : (
                <div className="space-y-3">
                  {data!.reservations.map((res) => (
                    <div
                      key={res.id}
                      className="pb-3 border-b border-slate-100 last:border-b-0 last:pb-0 flex items-start justify-between gap-3"
                    >
                      <div>
                        <p className="text-xs font-semibold text-slate-900">{res.bookTitle}</p>
                        <p className="text-[11px] font-mono text-slate-500 mt-0.5">
                          Antrean sejak {formatDateId(res.createdAt)}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={busyId === res.id}
                        onClick={() =>
                          handleAction(res.id, () => onCancelReservation(res.id), 'Reservasi dibatalkan.')
                        }
                        className="p-1.5 text-slate-400 hover:text-[#DC2626] rounded-md hover:bg-red-50"
                        title="Batalkan reservasi"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bookmark className="w-4 h-4 text-[#0D5C46]" />
                  <h3 className="text-sm font-semibold text-slate-900">Daftar Baca Tersimpan</h3>
                </div>
                <span className="font-mono text-xs text-slate-500 tabular-nums">
                  {data?.wishlistBooks.length ?? 0} judul
                </span>
              </div>

              {(data?.wishlistBooks.length ?? 0) === 0 ? (
                <p className="text-xs text-slate-500">Simpan buku favorit dari katalog untuk dibaca nanti.</p>
              ) : (
                <div className="space-y-3">
                  {data!.wishlistBooks.map((book) => (
                    <div
                      key={book.id}
                      className="pb-3 border-b border-slate-100 last:border-b-0 last:pb-0 flex items-center justify-between gap-3"
                    >
                      <button
                        type="button"
                        onClick={() => onSelectBook(book)}
                        className="text-left min-w-0 flex-1"
                      >
                        <p className="text-xs font-semibold text-slate-900 truncate hover:text-[#0D5C46]">
                          {book.title}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate">
                          {book.author} · {book.availableCopies > 0 ? 'Tersedia' : 'Dipinjam'}
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemoveWishlist(book.id)}
                        className="text-[11px] text-slate-400 hover:text-[#DC2626] shrink-0"
                      >
                        Hapus
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>

        {/* Right: Digital Card, Notifications & Live Feed */}
        <div className="xl:col-span-4 space-y-6">
          {/* Digital Member Card */}
          <section className="bg-[#0F2A22] text-white rounded-xl p-6 space-y-5 border border-[#194336]">
            <div className="flex items-center justify-between">
              <span className="font-serif text-lg font-semibold">wonu&apos;s library</span>
              <CreditCard className="w-5 h-5 text-emerald-300/80" />
            </div>

            <div className="space-y-1">
              <p className="text-xs text-emerald-200/80">Kartu Anggota Digital</p>
              <p className="text-lg font-semibold tracking-tight">{currentUser.name}</p>
              <p className="font-mono text-xs text-emerald-200/90 tabular-nums">{currentUser.memberCode}</p>
            </div>

            <div className="pt-4 border-t border-white/15 flex items-center justify-between text-[11px] text-emerald-100/80">
              <span>Kuota Maksimal: {currentUser.maxLoans} Buku</span>
              <span className="font-mono">Status: Aktif</span>
            </div>
          </section>

          {/* Notifications */}
          <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-[#0D5C46]" />
                <h3 className="text-sm font-semibold text-slate-900">
                  Notifikasi {unreadNotifs > 0 ? `(${unreadNotifs})` : ''}
                </h3>
              </div>
              {unreadNotifs > 0 && (
                <button
                  type="button"
                  onClick={markAllNotificationsRead}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-[#0D5C46] hover:underline"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>Tandai dibaca</span>
                </button>
              )}
            </div>

            {(data?.notifications.length ?? 0) === 0 ? (
              <p className="text-xs text-slate-500">Belum ada pemberitahuan baru.</p>
            ) : (
              <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                {data!.notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`p-3 rounded-lg border text-xs space-y-1 ${
                      notif.read ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-900">{notif.title}</span>
                      <span className="font-mono text-[10px] text-slate-400 shrink-0">
                        {formatDateId(notif.createdAt)}
                      </span>
                    </div>
                    <p className="text-slate-600 leading-relaxed">{notif.message}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Live Circulation Ticker */}
          <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[#0D5C46]" />
              <h3 className="text-sm font-semibold text-slate-900">Aktivitas Perpustakaan Terkini</h3>
            </div>
            <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
              {(liveActivities.length > 0 ? liveActivities : data?.recentActivities || []).slice(0, 8).map((act) => (
                <div key={act.id} className="pb-2.5 border-b border-slate-100 last:border-b-0 last:pb-0 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-slate-900">{act.title}</span>
                    <span className="font-mono text-[10px] text-slate-400 tabular-nums shrink-0">
                      {formatTimeOnly(act.timestamp)}
                    </span>
                  </div>
                  <p className="text-slate-600 mt-0.5 truncate">{act.detail}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
