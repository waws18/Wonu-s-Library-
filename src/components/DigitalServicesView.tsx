import { FormEvent, useState } from 'react';
import { BookOpen, Clock, FilePlus2, ShieldCheck } from 'lucide-react';
import type { Book, BookRequest, UserProfile } from '../types/library';
import { formatDateId } from '../utils/format';
import { BookCover } from './BookCover';

interface DigitalServicesViewProps {
  books: Book[];
  communityRequests: Omit<BookRequest, 'requestedByUserId'>[];
  currentUser: UserProfile | null;
  token: string | null;
  onOpenReader: (book: Book) => void;
  onOpenAuth: (mode: 'member' | 'register' | 'admin') => void;
  onRequestCreated: () => void;
}

export function DigitalServicesView({
  books,
  communityRequests,
  currentUser,
  token,
  onOpenReader,
  onOpenAuth,
  onRequestCreated,
}: DigitalServicesViewProps) {
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [category, setCategory] = useState('Teknologi & Komputer');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const digitalBooks = books.filter((b) => b.hasDigitalEdition);

  async function handleSubmitRequest(e: FormEvent) {
    e.preventDefault();
    if (!currentUser || !token) {
      onOpenAuth('member');
      return;
    }
    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title, author, category, reason }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal mengirim usulan.');
      setTitle('');
      setAuthor('');
      setReason('');
      setFeedback({ type: 'success', text: 'Usulan pengadaan buku berhasil dikirim ke tim pustakawan.' });
      onRequestCreated();
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Gagal mengirim usulan.' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Digital Reading Room */}
      <section className="space-y-4">
        <div>
          <h2 className="font-serif text-xl font-semibold text-slate-900">Ruang Baca E-Book Instan</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Baca cuplikan bab edisi digital secara langsung dari peramban tanpa perlu mengunduh berkas tambahan
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {digitalBooks.slice(0, 8).map((book) => (
            <div key={book.id} className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between gap-4">
              <div className="flex gap-3.5 items-start">
                <div className="w-16 aspect-[3/4] shrink-0 rounded overflow-hidden">
                  <BookCover book={book} className="w-full h-full" compact />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] text-slate-500 truncate">{book.category}</p>
                  <h3 className="font-serif text-sm font-semibold text-slate-900 line-clamp-2 mt-0.5">{book.title}</h3>
                  <p className="text-xs text-slate-600 truncate mt-0.5">{book.author}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onOpenReader(book)}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-[#0D5C46] bg-[#0D5C46]/5 border border-[#0D5C46]/20 rounded-lg hover:bg-[#0D5C46] hover:text-white transition-colors"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Buka E-Reader</span>
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Book Acquisition Request + Policy Guide */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="flex items-center gap-2">
            <FilePlus2 className="w-4 h-4 text-[#0D5C46]" />
            <div>
              <h3 className="text-base font-semibold text-slate-900">Usulan Pengadaan Koleksi Baru</h3>
              <p className="text-xs text-slate-500">Ajukan judul buku yang Anda rekomendasikan untuk diadakan oleh pustakawan</p>
            </div>
          </div>

          {feedback && (
            <div
              className={`p-3 rounded-lg border text-xs ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-red-50 border-red-200 text-red-700'
              }`}
            >
              {feedback.text}
            </div>
          )}

          <form onSubmit={handleSubmitRequest} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Judul Buku Usulan</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Contoh: Desain Sistem Arsip Modern"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-[#0D5C46]"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Penulis</label>
                <input
                  type="text"
                  required
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  placeholder="Nama penulis"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-[#0D5C46]"
                />
              </div>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Kategori Bidang</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-[#0D5C46]"
              >
                <option value="Teknologi & Komputer">Teknologi &amp; Komputer</option>
                <option value="Filsafat & Esai">Filsafat &amp; Esai</option>
                <option value="Arsitektur & Desain">Arsitektur &amp; Desain</option>
                <option value="Sains & Alam">Sains &amp; Alam</option>
                <option value="Sejarah & Budaya">Sejarah &amp; Budaya</option>
                <option value="Ekonomi & Sosial">Ekonomi &amp; Sosial</option>
                <option value="Fiksi & Sastra">Fiksi &amp; Sastra</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Alasan Rekomendasi</label>
              <textarea
                rows={3}
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Jelaskan manfaat buku ini bagi pembaca atau riset..."
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-[#0D5C46]"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 text-xs font-medium text-white bg-[#0D5C46] rounded-lg hover:bg-[#094232] disabled:opacity-60 transition-colors"
            >
              {submitting ? 'Mengirim...' : currentUser ? 'Kirim Usulan Pengadaan' : 'Masuk untuk Mengajukan Usulan'}
            </button>
          </form>

          {communityRequests.length > 0 && (
            <div className="pt-5 border-t border-slate-200 space-y-3">
              <h4 className="text-xs font-semibold text-slate-900">Daftar Usulan Terbaru</h4>
              <div className="divide-y divide-slate-100">
                {communityRequests.slice(0, 5).map((req) => (
                  <div key={req.id} className="py-2.5 flex items-start justify-between gap-3 text-xs">
                    <div>
                      <p className="font-medium text-slate-900">{req.title}</p>
                      <p className="text-slate-500">
                        {req.author} · {req.requestedByName} · {formatDateId(req.createdAt)}
                      </p>
                    </div>
                    <span
                      className={`font-medium shrink-0 ${
                        req.status === 'approved'
                          ? 'text-[#16A34A]'
                          : req.status === 'rejected'
                            ? 'text-[#DC2626]'
                            : 'text-[#D97706]'
                      }`}
                    >
                      {req.status === 'approved'
                        ? 'Disetujui'
                        : req.status === 'rejected'
                          ? 'Ditolak'
                          : 'Ditinjau'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <aside className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#0D5C46]" />
            <h3 className="text-base font-semibold text-slate-900">Tata Tertib &amp; Layanan Sirkulasi</h3>
          </div>

          <div className="space-y-4 text-xs text-slate-600 leading-relaxed">
            <div className="pb-3 border-b border-slate-100">
              <p className="font-semibold text-slate-900 mb-1">1. Kuota &amp; Durasi Peminjaman</p>
              <p>
                Setiap anggota aktif memiliki kuota maksimal 5 judul buku secara bersamaan dengan pilihan durasi
                peminjaman 7 hari atau 14 hari kalender.
              </p>
            </div>
            <div className="pb-3 border-b border-slate-100">
              <p className="font-semibold text-slate-900 mb-1">2. Perpanjangan &amp; Antrean Reservasi</p>
              <p>
                Peminjaman dapat diperpanjang satu kali (+7 hari) sebelum tanggal jatuh tempo selama buku tersebut
                tidak sedang ditunggu oleh anggota lain dalam antrean reservasi.
              </p>
            </div>
            <div className="pb-3 border-b border-slate-100">
              <p className="font-semibold text-slate-900 mb-1">3. Keterlambatan &amp; Denda Otomatis</p>
              <p>
                Sistem menghitung denda keterlambatan secara otomatis sebesar Rp 2.000 per hari per judul setelah
                melewati pukul 17:00 pada tanggal jatuh tempo.
              </p>
            </div>
            <div className="flex items-center gap-2 text-slate-700 pt-1">
              <Clock className="w-4 h-4 text-[#0D5C46] shrink-0" />
              <span>Layanan digital &amp; katalog daring tersedia 24 jam setiap hari.</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
