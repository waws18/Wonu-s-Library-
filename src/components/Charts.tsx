import type { LibrarySummaryStats } from '../types/library';

interface TrendChartProps {
  data: LibrarySummaryStats['dailyTrend'];
}

export function CirculationTrendChart({ data }: TrendChartProps) {
  const maxVal = Math.max(
    4,
    ...data.map((d) => Math.max(d.borrowed, d.returned))
  );

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Tren Sirkulasi 7 Hari Terakhir</h3>
          <p className="text-xs text-slate-500 mt-0.5">Perbandingan transaksi peminjaman dan pengembalian harian</p>
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-600">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-[#0D5C46]" />
            Peminjaman
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-slate-400" />
            Pengembalian
          </span>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-3 items-end h-44 pt-4 border-b border-slate-200 pb-2">
        {data.map((item) => {
          const borrowPct = Math.round((item.borrowed / maxVal) * 100);
          const returnPct = Math.round((item.returned / maxVal) * 100);
          return (
            <div key={item.dateLabel} className="flex flex-col items-center h-full justify-end group">
              <div className="flex items-end justify-center gap-1.5 w-full flex-1 px-1">
                <div className="relative flex flex-col items-center justify-end h-full w-4">
                  <span className="text-[10px] font-mono tabular-nums text-slate-500 mb-1">
                    {item.borrowed}
                  </span>
                  <div
                    className="w-full bg-[#0D5C46] rounded-t-xs transition-all duration-200 group-hover:bg-[#094232]"
                    style={{ height: `${Math.max(4, borrowPct)}%` }}
                    title={`Dipinjam: ${item.borrowed}`}
                  />
                </div>
                <div className="relative flex flex-col items-center justify-end h-full w-4">
                  <span className="text-[10px] font-mono tabular-nums text-slate-400 mb-1">
                    {item.returned}
                  </span>
                  <div
                    className="w-full bg-slate-300 rounded-t-xs transition-all duration-200 group-hover:bg-slate-400"
                    style={{ height: `${Math.max(4, returnPct)}%` }}
                    title={`Dikembalikan: ${item.returned}`}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-7 gap-3 pt-2">
        {data.map((item) => (
          <div key={item.dateLabel} className="text-center text-[11px] font-mono tabular-nums text-slate-500">
            {item.dateLabel}
          </div>
        ))}
      </div>
    </div>
  );
}

interface CategoryChartProps {
  data: LibrarySummaryStats['categoryStats'];
}

export function CategoryBreakdownChart({ data }: CategoryChartProps) {
  const maxLoans = Math.max(1, ...data.map((d) => d.loansCount));

  return (
    <div className="w-full">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-900">Minat Baca per Kategori</h3>
        <p className="text-xs text-slate-500 mt-0.5">Akumulasi peminjaman dan jumlah judul tersedia</p>
      </div>

      <div className="space-y-3">
        {data.map((row) => {
          const widthPct = Math.max(6, Math.round((row.loansCount / maxLoans) * 100));
          return (
            <div key={row.category} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-800 truncate pr-2">{row.category}</span>
                <span className="font-mono tabular-nums text-slate-500 shrink-0">
                  {row.loansCount} pinjam · {row.titlesCount} judul
                </span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-xs overflow-hidden">
                <div
                  className="h-full bg-[#0D5C46] rounded-xs transition-all duration-200"
                  style={{ width: `${widthPct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
