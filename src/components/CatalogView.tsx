import { useMemo, useState } from 'react';
import { BookOpen, Search, Star } from 'lucide-react';
import type { Book, LibrarySummaryStats } from '../types/library';
import { BookCover } from './BookCover';

interface CatalogViewProps {
  books: Book[];
  stats: LibrarySummaryStats | null;
  wishlistIds: string[];
  onSelectBook: (book: Book) => void;
  onQuickBorrow: (book: Book) => void;
  onOpenReader: (book: Book) => void;
}

export function CatalogView({
  books,
  stats,
  wishlistIds,
  onSelectBook,
  onQuickBorrow,
  onOpenReader,
}: CatalogViewProps) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Semua');
  const [availability, setAvailability] = useState<'all' | 'available' | 'digital'>('all');
  const [sortBy, setSortBy] = useState<'popular' | 'newest' | 'title'>('popular');

  const categories = useMemo(() => {
    const unique = Array.from(new Set(books.map((b) => b.category)));
    return ['Semua', ...unique];
  }, [books]);

  const filteredBooks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return books
      .filter((book) => {
        if (category !== 'Semua' && book.category !== category) return false;
        if (availability === 'available' && book.availableCopies <= 0) return false;
        if (availability === 'digital' && !book.hasDigitalEdition) return false;
        if (!q) return true;
        return (
          book.title.toLowerCase().includes(q) ||
          book.author.toLowerCase().includes(q) ||
          book.isbn.toLowerCase().includes(q) ||
          book.callNumber.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (sortBy === 'popular') return b.borrowCount - a.borrowCount;
        if (sortBy === 'newest') return b.publishYear - a.publishYear;
        return a.title.localeCompare(b.title);
      });
  }, [books, search, category, availability, sortBy]);

  return (
    <div className="space-y-8">
      {/* Hero Split Banner */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
          <div className="lg:col-span-6 p-6 md:p-10 flex flex-col justify-between space-y-6">
            <div className="space-y-3">
              <p className="text-xs font-medium text-[#0D5C46]">
                Perpustakaan Digital Terpadu · Koleksi Kurasi &amp; Sirkulasi Real-Time
              </p>
              <h1 className="font-serif text-3xl md:text-4xl font-semibold text-slate-900 leading-tight max-w-xl">
                Ruang baca sunyi untuk menelusuri pengetahuan dan arsip pilihan.
              </h1>
              <p className="text-sm text-slate-600 leading-relaxed max-w-lg">
                Pinjam koleksi cetak dan digital secara instan, pantau ketersediaan rak secara langsung, atau
                ajukan reservasi antrean dari mana saja di <strong className="text-slate-900">wonu&apos;s library</strong>.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <a
                href="#katalog-buku"
                className="px-5 py-2.5 text-xs font-medium text-white bg-[#0D5C46] rounded-lg hover:bg-[#094232] transition-colors whitespace-nowrap"
              >
                Telusuri Koleksi
              </a>
              <span className="text-xs text-slate-500">
                Durasi pinjam standar 7 atau 14 hari · Perpanjangan mandiri tersedia
              </span>
            </div>
          </div>

          <div className="lg:col-span-6 relative min-h-[240px] lg:min-h-[320px] bg-slate-100">
            <img
              src="/src/assets/images/library_hero_reading_1795658242008.jpg"
              alt="Ruang baca utama wonu's library dengan rak kayu dan cahaya alami"
              referrerPolicy="no-referrer"
              className="w-full h-full lg:absolute lg:inset-0 object-cover"
            />
          </div>
        </div>

        {/* 4-Column Live KPI Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 border-t border-slate-200 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 bg-slate-50/50">
          <div className="p-5">
            <p className="text-xs text-slate-500">Total Judul Koleksi</p>
            <p className="font-mono text-2xl font-semibold text-slate-900 tabular-nums mt-1">
              {stats?.totalTitles ?? books.length}
            </p>
          </div>
          <div className="p-5">
            <p className="text-xs text-slate-500">Eksemplar Siap Pinjam</p>
            <p className="font-mono text-2xl font-semibold text-[#16A34A] tabular-nums mt-1">
              {stats?.availableCopies ?? books.reduce((s, b) => s + b.availableCopies, 0)}{' '}
              <span className="text-xs font-normal text-slate-500">
                / {stats?.totalCopies ?? books.reduce((s, b) => s + b.totalCopies, 0)}
              </span>
            </p>
          </div>
          <div className="p-5">
            <p className="text-xs text-slate-500">Sedang Dipinjam</p>
            <p className="font-mono text-2xl font-semibold text-slate-900 tabular-nums mt-1">
              {stats?.activeLoans ?? 0}
            </p>
          </div>
          <div className="p-5">
            <p className="text-xs text-slate-500">Anggota Terdaftar</p>
            <p className="font-mono text-2xl font-semibold text-slate-900 tabular-nums mt-1">
              {stats?.totalMembers ?? 0}
            </p>
          </div>
        </div>
      </section>

      {/* Filter & Search Toolbar */}
      <section id="katalog-buku" className="space-y-5">
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari judul buku, penulis, ISBN, atau nomor panggil..."
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#0D5C46]/25 focus:border-[#0D5C46]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center p-1 bg-slate-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => setAvailability('all')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    availability === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Semua
                </button>
                <button
                  type="button"
                  onClick={() => setAvailability('available')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    availability === 'available' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Tersedia
                </button>
                <button
                  type="button"
                  onClick={() => setAvailability('digital')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    availability === 'digital' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  E-Book
                </button>
              </div>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'popular' | 'newest' | 'title')}
                aria-label="Urutkan katalog"
                className="px-3 py-2 text-xs font-medium bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-[#0D5C46]"
              >
                <option value="popular">Urutkan: Terpopuler</option>
                <option value="newest">Urutkan: Terbitan Terbaru</option>
                <option value="title">Urutkan: Judul A–Z</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  category === cat
                    ? 'bg-[#0D5C46] text-white'
                    : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Book Grid */}
        {filteredBooks.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-3">
            <p className="text-sm font-medium text-slate-900">Tidak ada buku yang sesuai dengan pencarian Anda.</p>
            <p className="text-xs text-slate-500">Coba ubah kata kunci atau setel ulang filter kategori.</p>
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setCategory('Semua');
                setAvailability('all');
              }}
              className="px-4 py-2 text-xs font-medium text-[#0D5C46] border border-[#0D5C46]/30 rounded-lg hover:bg-[#0D5C46]/5"
            >
              Reset Filter
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filteredBooks.map((book) => {
              const isSaved = wishlistIds.includes(book.id);
              return (
                <article
                  key={book.id}
                  className="bg-white border border-slate-200 rounded-xl p-5 flex gap-5 hover:border-slate-300 transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => onSelectBook(book)}
                    className="w-24 sm:w-28 aspect-[3/4] shrink-0 rounded-md overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D5C46]"
                  >
                    <BookCover book={book} className="w-full h-full" compact />
                  </button>

                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div className="space-y-1.5">
                      <p className="text-xs text-slate-500 truncate">
                        {book.category} · {book.rackLocation}
                      </p>
                      <button
                        type="button"
                        onClick={() => onSelectBook(book)}
                        className="text-left block w-full"
                      >
                        <h3 className="font-serif text-base font-semibold text-slate-900 leading-snug line-clamp-2 hover:text-[#0D5C46] transition-colors">
                          {book.title}
                        </h3>
                      </button>
                      <p className="text-xs text-slate-600 truncate">{book.author}</p>

                      <div className="flex items-center gap-3 pt-1 text-xs tabular-nums">
                        <span
                          className={`font-medium ${
                            book.availableCopies > 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'
                          }`}
                        >
                          {book.availableCopies > 0
                            ? `Tersedia ${book.availableCopies}/${book.totalCopies}`
                            : 'Stok Habis (Antrean)'}
                        </span>
                        {book.ratingCount > 0 && (
                          <span className="inline-flex items-center gap-1 text-slate-500">
                            <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                            {book.ratingAvg}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => onQuickBorrow(book)}
                        className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                          book.availableCopies > 0
                            ? 'bg-[#0D5C46] text-white hover:bg-[#094232]'
                            : 'bg-slate-900 text-white hover:bg-slate-800'
                        }`}
                      >
                        {book.availableCopies > 0 ? 'Pinjam' : 'Reservasi'}
                      </button>

                      <div className="flex items-center gap-2">
                        {book.hasDigitalEdition && (
                          <button
                            type="button"
                            onClick={() => onOpenReader(book)}
                            className="p-1.5 text-slate-500 hover:text-[#0D5C46] rounded-md hover:bg-slate-100"
                            title="Baca cuplikan digital"
                            aria-label={`Baca cuplikan ${book.title}`}
                          >
                            <BookOpen className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onSelectBook(book)}
                          className="text-xs font-medium text-slate-600 hover:text-slate-900 whitespace-nowrap"
                        >
                          {isSaved ? 'Tersimpan · Detail' : 'Detail'}
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
