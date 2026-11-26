import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BellRing,
  Check,
  RotateCcw,
  Search,
  ShieldAlert,
  Users,
  X,
} from 'lucide-react';
import type {
  ActivityEvent,
  BookRequest,
  LibrarySummaryStats,
  LoanTransaction,
  Reservation,
  UserProfile,
} from '../types/library';
import { formatDateId, formatRupiah, formatTimeOnly } from '../utils/format';
import { CategoryBreakdownChart, CirculationTrendChart } from './Charts';

interface AdminMemberRow extends UserProfile {
  activeLoansCount: number;
  totalBorrowedCount: number;
}

interface AdminDashboardData {
  stats: LibrarySummaryStats;
  loans: LoanTransaction[];
  reservations: Reservation[];
  members: AdminMemberRow[];
  requests: BookRequest[];
  activities: ActivityEvent[];
}

interface AdminDashboardProps {
  currentUser: UserProfile | null;
  token: string | null;
  refreshKey: number;
  liveActivities: ActivityEvent[];
  liveStats: LibrarySummaryStats | null;
  onOpenAuth: (mode: 'member' | 'register' | 'admin') => void;
  onReturnLoan: (loanId: string) => Promise<void>;
  onRefreshTrigger: () => void;
}

export function AdminDashboard({
  currentUser,
  token,
  refreshKey,
  liveActivities,
  liveStats,
  onOpenAuth,
  onReturnLoan,
  onRefreshTrigger,
}: AdminDashboardProps) {
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [loanFilter, setLoanFilter] = useState<'all' | 'active' | 'overdue' | 'returned'>('all');
  const [searchLoan, setSearchLoan] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!currentUser || currentUser.role !== 'admin' || !token) {
      setData(null);
      return;
    }
    setLoading(true);
    fetch('/api/admin/dashboard', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((json: AdminDashboardData) => setData(json))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [currentUser, token, refreshKey]);

  const stats = liveStats || data?.stats || null;
  const activities = liveActivities.length > 0 ? liveActivities : data?.activities || [];

  const filteredLoans = useMemo(() => {
    const q = searchLoan.trim().toLowerCase();
    return (data?.loans || []).filter((loan) => {
      if (loanFilter !== 'all' && loan.status !== loanFilter) return false;
      if (!q) return true;
      return (
        loan.code.toLowerCase().includes(q) ||
        loan.bookTitle.toLowerCase().includes(q) ||
        loan.userName.toLowerCase().includes(q) ||
        loan.memberCode.toLowerCase().includes(q)
      );
    });
  }, [data?.loans, loanFilter, searchLoan]);

  if (!currentUser || currentUser.role !== 'admin' || !token) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-10 text-center max-w-xl mx-auto my-8 space-y-4">
        <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-5 h-5" />
        </div>
        <h2 className="font-serif text-2xl font-semibold text-slate-900">Konsol Pustakawan (Admin)</h2>
        <p className="text-sm text-slate-600 leading-relaxed">
          Masuk menggunakan akun Pustakawan untuk memantau transaksi real-time, melihat analitik sirkulasi,
          mengirim pengingat jatuh tempo, dan mengelola usulan pengadaan buku.
        </p>
        <div className="pt-2">
          <button
            type="button"
            onClick={() => onOpenAuth('admin')}
            className="px-5 py-2.5 text-xs font-medium text-white bg-[#0D5C46] rounded-lg hover:bg-[#094232] transition-colors"
          >
            Masuk sebagai Pustakawan
          </button>
        </div>
      </div>
    );
  }

  async function handleSendReminder(loanId: string) {
    if (!token) return;
    setBusyId(loanId);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/loans/${loanId}/remind`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal mengirim pengingat.');
      setNotice({ type: 'success', text: 'Notifikasi pengingat telah dikirim ke kotak masuk anggota.' });
      onRefreshTrigger();
    } catch (err) {
      setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Gagal mengirim pengingat.' });
    } finally {
      setBusyId(null);
    }
  }

  async function handleRequestDecision(requestId: string, status: 'approved' | 'rejected') {
    if (!token) return;
    setBusyId(requestId);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/requests/${requestId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal memperbarui usulan.');
      setNotice({
        type: 'success',
        text: status === 'approved' ? 'Usulan pengadaan buku disetujui.' : 'Usulan pengadaan buku ditolak.',
      });
      onRefreshTrigger();
    } catch (err) {
      setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Gagal memproses usulan.' });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500">Peminjaman Aktif</p>
          <p className="font-mono text-2xl font-semibold text-slate-900 tabular-nums mt-1">
            {stats?.activeLoans ?? 0}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500">Transaksi Hari Ini</p>
          <p className="font-mono text-2xl font-semibold text-[#0D5C46] tabular-nums mt-1">
            {stats?.totalTransactionsToday ?? 0}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500">Melewati Jatuh Tempo</p>
          <p
            className={`font-mono text-2xl font-semibold tabular-nums mt-1 ${
              (stats?.overdueLoans ?? 0) > 0 ? 'text-[#DC2626]' : 'text-slate-900'
            }`}
          >
            {stats?.overdueLoans ?? 0}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500">Antrean Reservasi</p>
          <p className="font-mono text-2xl font-semibold text-slate-900 tabular-nums mt-1">
            {stats?.waitingReservations ?? 0}
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

      {/* Charts + Live Real-Time Stream */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch">
        <div className="xl:col-span-8 bg-white border border-slate-200 rounded-xl p-6 space-y-8">
          {stats ? (
            <>
              <CirculationTrendChart data={stats.dailyTrend} />
              <div className="pt-6 border-t border-slate-200">
                <CategoryBreakdownChart data={stats.categoryStats} />
              </div>
            </>
          ) : (
            <div className="p-8 text-center text-xs text-slate-500">Memuat grafik statistik...</div>
          )}
        </div>

        <section className="xl:col-span-4 bg-white border border-slate-200 rounded-xl p-6 flex flex-col">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200 shrink-0">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#0D5C46]" />
              <h3 className="text-sm font-semibold text-slate-900">Aktivitas Transaksi Real-Time</h3>
            </div>
            <span className="text-[11px] font-mono text-[#16A34A]">Live SSE</span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 max-h-[430px] mt-2">
            {activities.length === 0 ? (
              <p className="py-6 text-xs text-slate-500 text-center">Belum ada aktivitas tercatat.</p>
            ) : (
              activities.map((act) => (
                <div key={act.id} className="py-3 space-y-1 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-900">{act.title}</span>
                    <span className="font-mono text-[11px] text-slate-400 tabular-nums shrink-0">
                      {formatTimeOnly(act.timestamp)}
                    </span>
                  </div>
                  <p className="text-slate-700">{act.detail}</p>
                  <p className="text-[11px] text-slate-500">{act.actorLabel}</p>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* Circulation Table */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="font-serif text-lg font-semibold text-slate-900">Monitor Transaksi Peminjaman</h3>
            <p className="text-xs text-slate-500">Pantau seluruh status transaksi aktif, keterlambatan, dan pengembalian</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={searchLoan}
                onChange={(e) => setSearchLoan(e.target.value)}
                placeholder="Cari transaksi / anggota..."
                className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-[#0D5C46]"
              />
            </div>

            <div className="inline-flex items-center p-1 bg-slate-100 rounded-lg">
              {(
                [
                  ['all', 'Semua'],
                  ['active', 'Aktif'],
                  ['overdue', 'Terlambat'],
                  ['returned', 'Selesai'],
                ] as const
              ).map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setLoanFilter(val)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    loanFilter === val ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading && !data ? (
          <div className="p-8 text-center text-xs text-slate-500">Memuat tabel transaksi...</div>
        ) : filteredLoans.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">Tidak ada transaksi yang sesuai filter.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                  <th className="py-3 px-5">Kode &amp; Judul Buku</th>
                  <th className="py-3 px-4">Anggota</th>
                  <th className="py-3 px-4">Pinjam / Jatuh Tempo</th>
                  <th className="py-3 px-4">Status &amp; Denda</th>
                  <th className="py-3 px-5 text-right">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredLoans.map((loan) => (
                  <tr key={loan.id} className="hover:bg-slate-50/60">
                    <td className="py-3.5 px-5">
                      <p className="font-semibold text-slate-900">{loan.bookTitle}</p>
                      <p className="font-mono text-[11px] text-slate-500 mt-0.5">{loan.code}</p>
                    </td>
                    <td className="py-3.5 px-4">
                      <p className="font-medium text-slate-900">{loan.userName}</p>
                      <p className="font-mono text-[11px] text-slate-500">{loan.memberCode}</p>
                    </td>
                    <td className="py-3.5 px-4 font-mono tabular-nums text-slate-600">
                      <div>Pinjam: {formatDateId(loan.borrowedAt)}</div>
                      <div>Tempo: {formatDateId(loan.dueDate)}</div>
                    </td>
                    <td className="py-3.5 px-4 tabular-nums">
                      {loan.status === 'returned' ? (
                        <span className="text-slate-600">
                          Dikembalikan {formatDateId(loan.returnedAt)}
                          {loan.fineAmount > 0 ? ` · Denda ${formatRupiah(loan.fineAmount)}` : ''}
                        </span>
                      ) : loan.status === 'overdue' ? (
                        <span className="font-semibold text-[#DC2626]">
                          Terlambat · {formatRupiah(loan.fineAmount)}
                        </span>
                      ) : (
                        <span className="font-medium text-[#16A34A]">Sedang Dipinjam</span>
                      )}
                    </td>
                    <td className="py-3.5 px-5 text-right whitespace-nowrap">
                      {loan.status !== 'returned' ? (
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            disabled={busyId === loan.id}
                            onClick={() => handleSendReminder(loan.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-50"
                            title="Kirim notifikasi pengingat ke anggota"
                          >
                            <BellRing className="w-3 h-3" />
                            <span>Ingatkan</span>
                          </button>
                          <button
                            type="button"
                            disabled={busyId === loan.id}
                            onClick={async () => {
                              setBusyId(loan.id);
                              try {
                                await onReturnLoan(loan.id);
                                setNotice({ type: 'success', text: `Pengembalian ${loan.code} berhasil dicatat.` });
                              } catch (err) {
                                setNotice({
                                  type: 'error',
                                  text: err instanceof Error ? err.message : 'Gagal memproses pengembalian.',
                                });
                              } finally {
                                setBusyId(null);
                              }
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-[#0D5C46] rounded-md hover:bg-[#094232] disabled:opacity-50"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Selesaikan</span>
                          </button>
                        </div>
                      ) : (
                        <span className="font-mono text-[11px] text-slate-400">Terverifikasi</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Bottom Grid: Members & Book Requests */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[#0D5C46]" />
              <h3 className="text-sm font-semibold text-slate-900">Direktori Anggota Aktif</h3>
            </div>
            <span className="font-mono text-xs text-slate-500 tabular-nums">
              {data?.members.length ?? 0} anggota
            </span>
          </div>

          <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
            {(data?.members || []).map((m) => (
              <div key={m.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 truncate">{m.name}</p>
                  <p className="text-slate-500 truncate">
                    {m.memberCode} · {m.email}
                  </p>
                </div>
                <div className="text-right font-mono tabular-nums shrink-0">
                  <p className="text-slate-900 font-medium">{m.activeLoansCount} aktif</p>
                  <p className="text-[11px] text-slate-400">{m.totalBorrowedCount} total pinjam</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Usulan Pengadaan Buku Anggota</h3>
            <span className="font-mono text-xs text-slate-500 tabular-nums">
              {(data?.requests || []).filter((r) => r.status === 'pending').length} menunggu
            </span>
          </div>

          {(data?.requests.length ?? 0) === 0 ? (
            <p className="text-xs text-slate-500">Belum ada usulan pengadaan buku dari anggota.</p>
          ) : (
            <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
              {data!.requests.map((reqItem) => (
                <div key={reqItem.id} className="py-3 space-y-2 text-xs">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{reqItem.title}</p>
                      <p className="text-slate-500">
                        {reqItem.author} · {reqItem.category} · Oleh {reqItem.requestedByName}
                      </p>
                    </div>
                    <span
                      className={`font-medium shrink-0 ${
                        reqItem.status === 'approved'
                          ? 'text-[#16A34A]'
                          : reqItem.status === 'rejected'
                            ? 'text-[#DC2626]'
                            : 'text-[#D97706]'
                      }`}
                    >
                      {reqItem.status === 'approved'
                        ? 'Disetujui'
                        : reqItem.status === 'rejected'
                          ? 'Ditolak'
                          : 'Menunggu'}
                    </span>
                  </div>
                  <p className="text-slate-600">{reqItem.reason}</p>
                  {reqItem.status === 'pending' && (
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        disabled={busyId === reqItem.id}
                        onClick={() => handleRequestDecision(reqItem.id, 'approved')}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-[#0D5C46] rounded-md hover:bg-[#094232]"
                      >
                        <Check className="w-3 h-3" />
                        <span>Setujui</span>
                      </button>
                      <button
                        type="button"
                        disabled={busyId === reqItem.id}
                        onClick={() => handleRequestDecision(reqItem.id, 'rejected')}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50"
                      >
                        <X className="w-3 h-3" />
                        <span>Tolak</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
