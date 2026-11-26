import { useEffect, useState } from 'react';
import { CalendarClock, Download, FileText, Play, Printer, ShieldAlert } from 'lucide-react';
import type { GeneratedReport, ReportSchedule, UserProfile } from '../types/library';
import { downloadCsv, formatDateId, formatDateTimeId, formatRupiah } from '../utils/format';

interface AutomatedReportsViewProps {
  currentUser: UserProfile | null;
  token: string | null;
  refreshKey: number;
  onOpenAuth: (mode: 'member' | 'register' | 'admin') => void;
  onReportGenerated: () => void;
}

export function AutomatedReportsView({
  currentUser,
  token,
  refreshKey,
  onOpenAuth,
  onReportGenerated,
}: AutomatedReportsViewProps) {
  const [schedules, setSchedules] = useState<ReportSchedule[]>([]);
  const [reports, setReports] = useState<GeneratedReport[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!currentUser || currentUser.role !== 'admin' || !token) return;
    fetch('/api/admin/dashboard', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data: { reportSchedules?: ReportSchedule[]; reports?: GeneratedReport[] }) => {
        setSchedules(data.reportSchedules || []);
        const list = data.reports || [];
        setReports(list);
        if (list.length > 0 && !selectedReportId) {
          setSelectedReportId(list[0].id);
        }
      })
      .catch(() => {});
  }, [currentUser, token, refreshKey]);

  if (!currentUser || currentUser.role !== 'admin' || !token) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-10 text-center max-w-xl mx-auto my-8 space-y-4">
        <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-5 h-5" />
        </div>
        <h2 className="font-serif text-2xl font-semibold text-slate-900">Sistem Pelaporan Otomatis</h2>
        <p className="text-sm text-slate-600 leading-relaxed">
          Masuk sebagai Pustakawan (Admin) untuk mengatur jadwal laporan otomatis harian/mingguan/bulanan,
          membuat laporan sirkulasi instan, serta mencetak atau mengekspor arsip resmi.
        </p>
        <button
          type="button"
          onClick={() => onOpenAuth('admin')}
          className="px-5 py-2.5 text-xs font-medium text-white bg-[#0D5C46] rounded-lg hover:bg-[#094232] transition-colors"
        >
          Masuk sebagai Pustakawan
        </button>
      </div>
    );
  }

  const activeReport = reports.find((r) => r.id === selectedReportId) || reports[0] || null;

  async function handleGenerateNow(
    reportType: 'circulation' | 'overdue' | 'inventory',
    frequency: 'daily' | 'weekly' | 'monthly' | 'manual'
  ) {
    setGenerating(true);
    setNotice(null);
    try {
      const res = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reportType, frequency }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal membuat laporan.');
      setReports((prev) => [json.report, ...prev]);
      setSelectedReportId(json.report.id);
      setNotice({ type: 'success', text: `Laporan ${json.report.code} berhasil dibuat.` });
      onReportGenerated();
    } catch (err) {
      setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Gagal membuat laporan.' });
    } finally {
      setGenerating(false);
    }
  }

  async function toggleSchedule(schedule: ReportSchedule) {
    try {
      const res = await fetch(`/api/reports/schedules/${schedule.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ enabled: !schedule.enabled }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal memperbarui jadwal.');
      setSchedules((prev) => prev.map((s) => (s.id === schedule.id ? json.schedule : s)));
    } catch (err) {
      setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Gagal mengubah jadwal.' });
    }
  }

  function handleExportReportCsv(report: GeneratedReport) {
    const rows: (string | number)[][] = [
      ['Ringkasan', 'Kode Laporan', report.code],
      ['Ringkasan', 'Judul', report.title],
      ['Ringkasan', 'Periode', report.periodLabel],
      ['Ringkasan', 'Total Judul', report.summary.totalBooks],
      ['Ringkasan', 'Total Eksemplar', report.summary.totalCopies],
      ['Ringkasan', 'Eksemplar Tersedia', report.summary.availableCopies],
      ['Ringkasan', 'Transaksi Periode', report.summary.totalLoansInPeriod],
      ['Ringkasan', 'Sedang Dipinjam', report.summary.activeLoans],
      ['Ringkasan', 'Terlambat', report.summary.overdueCount],
      ['Ringkasan', 'Akumulasi Denda (IDR)', report.summary.totalFines],
      ...report.topBooks.map((b) => ['Buku Populer', b.title, `${b.author} (${b.borrowCount} pinjam)`]),
      ...report.overdueLoans.map((o) => [
        'Keterlambatan',
        `${o.code} - ${o.bookTitle}`,
        `${o.memberName} (${o.lateDays} hari, Rp ${o.fineAmount})`,
      ]),
    ];
    downloadCsv(`${report.code}.csv`, ['Bagian', 'Item', 'Nilai / Keterangan'], rows);
  }

  return (
    <div className="space-y-6">
      {/* Header & Instant Triggers */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 no-print">
        <div>
          <h2 className="font-serif text-xl font-semibold text-slate-900">Sistem Pelaporan Otomatis</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Mesin pelaporan berkala menyusun audit sirkulasi, keterlambatan, dan inventaris secara otomatis
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={generating}
            onClick={() => handleGenerateNow('circulation', 'manual')}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#0D5C46] rounded-lg hover:bg-[#094232] disabled:opacity-60 whitespace-nowrap"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Buat Laporan Sirkulasi</span>
          </button>
          <button
            type="button"
            disabled={generating}
            onClick={() => handleGenerateNow('overdue', 'weekly')}
            className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-60 whitespace-nowrap"
          >
            Audit Keterlambatan
          </button>
          <button
            type="button"
            disabled={generating}
            onClick={() => handleGenerateNow('inventory', 'monthly')}
            className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-60 whitespace-nowrap"
          >
            Laporan Inventaris
          </button>
        </div>
      </section>

      {notice && (
        <div
          className={`px-4 py-3 rounded-lg border text-xs no-print ${
            notice.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          {notice.text}
        </div>
      )}

      {/* Automated Schedules */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 no-print">
        {schedules.map((sched) => (
          <div key={sched.id} className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#0D5C46]">
                  <CalendarClock className="w-3.5 h-3.5" />
                  {sched.frequency === 'daily'
                    ? 'Otomatis Harian'
                    : sched.frequency === 'weekly'
                      ? 'Otomatis Mingguan'
                      : 'Otomatis Bulanan'}
                </span>
                <button
                  type="button"
                  onClick={() => toggleSchedule(sched)}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-md border transition-colors ${
                    sched.enabled
                      ? 'bg-[#0D5C46] text-white border-[#0D5C46]'
                      : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}
                >
                  {sched.enabled ? 'Aktif' : 'Nonaktif'}
                </button>
              </div>
              <h3 className="text-sm font-semibold text-slate-900">{sched.name}</h3>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-500">
              <span>Berikutnya: {formatDateId(sched.nextRunAt)}</span>
              <button
                type="button"
                disabled={generating}
                onClick={() => handleGenerateNow(sched.reportType, sched.frequency)}
                className="font-sans font-medium text-[#0D5C46] hover:underline"
              >
                Jalankan
              </button>
            </div>
          </div>
        ))}
      </section>

      {/* Archive + Official Report Viewer */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <aside className="xl:col-span-4 bg-white border border-slate-200 rounded-xl overflow-hidden no-print">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Arsip Laporan Tersimpan</h3>
            <span className="font-mono text-xs text-slate-500 tabular-nums">{reports.length}</span>
          </div>
          <div className="divide-y divide-slate-100 max-h-[540px] overflow-y-auto">
            {reports.map((rep) => {
              const isSelected = activeReport?.id === rep.id;
              return (
                <button
                  key={rep.id}
                  type="button"
                  onClick={() => setSelectedReportId(rep.id)}
                  className={`w-full text-left px-5 py-3.5 transition-colors ${
                    isSelected ? 'bg-slate-100' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-mono font-semibold text-[#0D5C46]">{rep.code}</span>
                    <span className="text-[11px] text-slate-400">
                      {rep.autoGenerated ? 'Otomatis' : 'Manual'}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-slate-900 mt-1">{rep.title}</p>
                  <p className="text-[11px] font-mono text-slate-500 mt-0.5 tabular-nums">
                    {formatDateTimeId(rep.generatedAt)}
                  </p>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="xl:col-span-8 bg-white border border-slate-200 rounded-xl p-6 md:p-8 print-sheet">
          {!activeReport ? (
            <div className="p-12 text-center text-xs text-slate-500">
              Pilih laporan di sebelah kiri atau buat laporan baru untuk meninjau rincian.
            </div>
          ) : (
            <div className="space-y-8">
              <header className="pb-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="space-y-1">
                  <p className="font-mono text-xs text-[#0D5C46] font-semibold">
                    wonu&apos;s library · {activeReport.code}
                  </p>
                  <h3 className="font-serif text-2xl font-semibold text-slate-900">{activeReport.title}</h3>
                  <p className="text-xs text-slate-500">
                    Periode: {activeReport.periodLabel} · Dibuat pada {formatDateTimeId(activeReport.generatedAt)} oleh{' '}
                    {activeReport.generatedBy}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0 no-print">
                  <button
                    type="button"
                    onClick={() => handleExportReportCsv(activeReport)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>CSV</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Cetak / PDF</span>
                  </button>
                </div>
              </header>

              {/* Summary Strip */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                  <p className="text-xs text-slate-500">Total Judul / Eksemplar</p>
                  <p className="font-mono text-lg font-semibold text-slate-900 tabular-nums mt-1">
                    {activeReport.summary.totalBooks} / {activeReport.summary.totalCopies}
                  </p>
                </div>
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                  <p className="text-xs text-slate-500">Sirkulasi Periode</p>
                  <p className="font-mono text-lg font-semibold text-slate-900 tabular-nums mt-1">
                    {activeReport.summary.totalLoansInPeriod} transaksi
                  </p>
                </div>
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                  <p className="text-xs text-slate-500">Keterlambatan Aktif</p>
                  <p className="font-mono text-lg font-semibold text-[#DC2626] tabular-nums mt-1">
                    {activeReport.summary.overdueCount} buku
                  </p>
                </div>
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                  <p className="text-xs text-slate-500">Total Denda</p>
                  <p className="font-mono text-lg font-semibold text-slate-900 tabular-nums mt-1">
                    {formatRupiah(activeReport.summary.totalFines)}
                  </p>
                </div>
              </div>

              {/* Top Books */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#0D5C46]" />
                  <h4 className="text-sm font-semibold text-slate-900">5 Judul Koleksi Paling Sering Dipinjam</h4>
                </div>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-medium">
                        <th className="py-2.5 px-4">Judul Buku</th>
                        <th className="py-2.5 px-4">Penulis</th>
                        <th className="py-2.5 px-4 text-right">Total Pinjam</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {activeReport.topBooks.map((item) => (
                        <tr key={item.bookId}>
                          <td className="py-2.5 px-4 font-medium text-slate-900">{item.title}</td>
                          <td className="py-2.5 px-4 text-slate-600">{item.author}</td>
                          <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                            {item.borrowCount}x
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Overdue List */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-slate-900">Daftar Pinjaman Melewati Jatuh Tempo</h4>
                {activeReport.overdueLoans.length === 0 ? (
                  <p className="text-xs text-slate-500">Tidak ada peminjaman yang terlambat pada periode laporan ini.</p>
                ) : (
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-medium">
                          <th className="py-2.5 px-4">Kode</th>
                          <th className="py-2.5 px-4">Judul Buku</th>
                          <th className="py-2.5 px-4">Peminjam</th>
                          <th className="py-2.5 px-4 text-right">Terlambat</th>
                          <th className="py-2.5 px-4 text-right">Denda</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {activeReport.overdueLoans.map((ov) => (
                          <tr key={ov.code}>
                            <td className="py-2.5 px-4 font-mono text-slate-600">{ov.code}</td>
                            <td className="py-2.5 px-4 font-medium text-slate-900">{ov.bookTitle}</td>
                            <td className="py-2.5 px-4 text-slate-700">{ov.memberName}</td>
                            <td className="py-2.5 px-4 text-right font-mono tabular-nums text-[#DC2626]">
                              {ov.lateDays} hari
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                              {formatRupiah(ov.fineAmount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
