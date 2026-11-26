import { FormEvent, useMemo, useState } from 'react';
import { Download, Edit3, Plus, Search, ShieldAlert, Trash2, X } from 'lucide-react';
import type { Book, UserProfile } from '../types/library';
import { downloadCsv } from '../utils/format';

interface CollectionManagerProps {
  books: Book[];
  currentUser: UserProfile | null;
  token: string | null;
  onOpenAuth: (mode: 'member' | 'register' | 'admin') => void;
  onCatalogMutated: () => void;
}

interface BookFormState {
  title: string;
  author: string;
  category: string;
  isbn: string;
  callNumber: string;
  publisher: string;
  publishYear: number;
  pages: number;
  rackLocation: string;
  totalCopies: number;
  accentTone: Book['accentTone'];
  hasDigitalEdition: boolean;
  synopsis: string;
  digitalSampleText: string;
}

const EMPTY_FORM: BookFormState = {
  title: '',
  author: '',
  category: 'Filsafat & Esai',
  isbn: '',
  callNumber: '',
  publisher: "Pustaka wonu's library",
  publishYear: 2025,
  pages: 240,
  rackLocation: 'Rak A-01',
  totalCopies: 3,
  accentTone: 'forest',
  hasDigitalEdition: true,
  synopsis: '',
  digitalSampleText: '',
};

export function CollectionManager({
  books,
  currentUser,
  token,
  onOpenAuth,
  onCatalogMutated,
}: CollectionManagerProps) {
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [form, setForm] = useState<BookFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const filteredBooks = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return books;
    return books.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q) ||
        b.isbn.toLowerCase().includes(q) ||
        b.callNumber.toLowerCase().includes(q)
    );
  }, [books, search]);

  if (!currentUser || currentUser.role !== 'admin' || !token) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-10 text-center max-w-xl mx-auto my-8 space-y-4">
        <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-5 h-5" />
        </div>
        <h2 className="font-serif text-2xl font-semibold text-slate-900">Manajemen Koleksi Pustaka</h2>
        <p className="text-sm text-slate-600 leading-relaxed">
          Fitur penambahan, penyuntingan stok, dan penghapusan judul buku hanya tersedia untuk akun Pustakawan (Admin).
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

  function openAddModal() {
    setEditingBook(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEditModal(book: Book) {
    setEditingBook(book);
    setForm({
      title: book.title,
      author: book.author,
      category: book.category,
      isbn: book.isbn,
      callNumber: book.callNumber,
      publisher: book.publisher,
      publishYear: book.publishYear,
      pages: book.pages,
      rackLocation: book.rackLocation,
      totalCopies: book.totalCopies,
      accentTone: book.accentTone,
      hasDigitalEdition: book.hasDigitalEdition,
      synopsis: book.synopsis,
      digitalSampleText: book.digitalSample.join('\n\n'),
    });
    setModalOpen(true);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setNotice(null);

    try {
      const url = editingBook ? `/api/books/${editingBook.id}` : '/api/books';
      const method = editingBook ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal menyimpan koleksi.');
      setModalOpen(false);
      setNotice({
        type: 'success',
        text: editingBook ? `Koleksi "${form.title}" diperbarui.` : `Buku baru "${form.title}" ditambahkan ke katalog.`,
      });
      onCatalogMutated();
    } catch (err) {
      setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Gagal menyimpan data buku.' });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(book: Book) {
    setNotice(null);
    try {
      const res = await fetch(`/api/books/${book.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal menghapus buku.');
      setNotice({ type: 'success', text: `Koleksi "${book.title}" telah dihapus.` });
      onCatalogMutated();
    } catch (err) {
      setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Gagal menghapus buku.' });
    }
  }

  function handleExportCatalog() {
    downloadCsv(
      `katalog-wonus-library-${new Date().toISOString().slice(0, 10)}.csv`,
      ['ISBN', 'Nomor Panggil', 'Judul', 'Penulis', 'Kategori', 'Rak', 'Tahun', 'Stok Tersedia', 'Total Eksemplar', 'Total Pinjam'],
      books.map((b) => [
        b.isbn,
        b.callNumber,
        b.title,
        b.author,
        b.category,
        b.rackLocation,
        b.publishYear,
        b.availableCopies,
        b.totalCopies,
        b.borrowCount,
      ])
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="font-serif text-xl font-semibold text-slate-900">Manajemen Koleksi &amp; Inventaris</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Kelola katalog buku fisik dan edisi digital, nomor panggil DDC, rak, serta stok eksemplar
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleExportCatalog}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Ekspor CSV</span>
          </button>
          <button
            type="button"
            onClick={openAddModal}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-[#0D5C46] rounded-lg hover:bg-[#094232] transition-colors whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah Koleksi Baru</span>
          </button>
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

      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter judul, ISBN, nomor panggil..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-[#0D5C46]"
            />
          </div>
          <span className="font-mono text-xs text-slate-500 tabular-nums">
            {filteredBooks.length} judul ditampilkan
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                <th className="py-3 px-5">Judul &amp; Penulis</th>
                <th className="py-3 px-4">Kategori &amp; Rak</th>
                <th className="py-3 px-4">ISBN / Panggil</th>
                <th className="py-3 px-4 text-right">Stok</th>
                <th className="py-3 px-4 text-right">Dipinjam</th>
                <th className="py-3 px-5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredBooks.map((book) => (
                <tr key={book.id} className="hover:bg-slate-50/60">
                  <td className="py-3.5 px-5">
                    <p className="font-semibold text-slate-900">{book.title}</p>
                    <p className="text-slate-500 mt-0.5">
                      {book.author} · {book.publishYear} {book.hasDigitalEdition ? '· E-Book' : ''}
                    </p>
                  </td>
                  <td className="py-3.5 px-4 text-slate-700">
                    <div>{book.category}</div>
                    <div className="text-[11px] font-mono text-slate-400">{book.rackLocation}</div>
                  </td>
                  <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600 tabular-nums">
                    <div>{book.isbn}</div>
                    <div className="text-slate-400">{book.callNumber}</div>
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                    <span className={book.availableCopies > 0 ? 'text-[#16A34A] font-semibold' : 'text-[#DC2626] font-semibold'}>
                      {book.availableCopies}
                    </span>{' '}
                    <span className="text-slate-400">/ {book.totalCopies}</span>
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-700">
                    {book.borrowCount}x
                  </td>
                  <td className="py-3.5 px-5 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openEditModal(book)}
                        className="p-1.5 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-md hover:bg-slate-50"
                        title="Sunting koleksi"
                        aria-label={`Sunting ${book.title}`}
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(book)}
                        className="p-1.5 text-slate-500 hover:text-[#DC2626] bg-white border border-slate-200 rounded-md hover:bg-red-50"
                        title="Hapus koleksi"
                        aria-label={`Hapus ${book.title}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Add / Edit Book Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
          <div className="w-full max-w-2xl max-h-[90vh] bg-white border border-slate-200 rounded-xl shadow-xl flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
              <h3 className="font-serif text-lg font-semibold text-slate-900">
                {editingBook ? 'Sunting Data Koleksi' : 'Tambah Koleksi Buku Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block font-medium text-slate-700 mb-1">Judul Lengkap</label>
                  <input
                    type="text"
                    required
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-[#0D5C46]"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Penulis</label>
                  <input
                    type="text"
                    required
                    value={form.author}
                    onChange={(e) => setForm({ ...form, author: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-[#0D5C46]"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Kategori</label>
                  <input
                    type="text"
                    required
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-[#0D5C46]"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">ISBN</label>
                  <input
                    type="text"
                    required
                    value={form.isbn}
                    onChange={(e) => setForm({ ...form, isbn: e.target.value })}
                    placeholder="978-602-..."
                    className="w-full px-3 py-2 font-mono border border-slate-200 rounded-lg focus:outline-none focus:border-[#0D5C46]"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Nomor Panggil (DDC)</label>
                  <input
                    type="text"
                    required
                    value={form.callNumber}
                    onChange={(e) => setForm({ ...form, callNumber: e.target.value })}
                    placeholder="005.73 HAR s"
                    className="w-full px-3 py-2 font-mono border border-slate-200 rounded-lg focus:outline-none focus:border-[#0D5C46]"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Penerbit</label>
                  <input
                    type="text"
                    value={form.publisher}
                    onChange={(e) => setForm({ ...form, publisher: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-[#0D5C46]"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Lokasi Rak</label>
                  <input
                    type="text"
                    value={form.rackLocation}
                    onChange={(e) => setForm({ ...form, rackLocation: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-[#0D5C46]"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Tahun Terbit</label>
                  <input
                    type="number"
                    required
                    min={1800}
                    max={2100}
                    value={form.publishYear}
                    onChange={(e) => setForm({ ...form, publishYear: Number(e.target.value) })}
                    className="w-full px-3 py-2 font-mono border border-slate-200 rounded-lg focus:outline-none focus:border-[#0D5C46]"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Jumlah Halaman</label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={10000}
                    value={form.pages}
                    onChange={(e) => setForm({ ...form, pages: Number(e.target.value) })}
                    className="w-full px-3 py-2 font-mono border border-slate-200 rounded-lg focus:outline-none focus:border-[#0D5C46]"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Total Eksemplar</label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={500}
                    value={form.totalCopies}
                    onChange={(e) => setForm({ ...form, totalCopies: Number(e.target.value) })}
                    className="w-full px-3 py-2 font-mono border border-slate-200 rounded-lg focus:outline-none focus:border-[#0D5C46]"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Warna Sampul Arsip</label>
                  <select
                    value={form.accentTone}
                    onChange={(e) => setForm({ ...form, accentTone: e.target.value as Book['accentTone'] })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-[#0D5C46]"
                  >
                    <option value="forest">Hijau Hutan</option>
                    <option value="slate">Batu Sabak</option>
                    <option value="amber">Cokelat Hangat</option>
                    <option value="indigo">Biru Tua</option>
                    <option value="crimson">Merah Marun</option>
                  </select>
                </div>
                <div className="md:col-span-2 flex items-center gap-2 pt-1">
                  <input
                    id="has-digital"
                    type="checkbox"
                    checked={form.hasDigitalEdition}
                    onChange={(e) => setForm({ ...form, hasDigitalEdition: e.target.checked })}
                    className="rounded border-slate-300 text-[#0D5C46] focus:ring-[#0D5C46]"
                  />
                  <label htmlFor="has-digital" className="font-medium text-slate-700">
                    Sediakan pratinjau edisi digital (E-Reader)
                  </label>
                </div>
                <div className="md:col-span-2">
                  <label className="block font-medium text-slate-700 mb-1">Sinopsis</label>
                  <textarea
                    rows={3}
                    value={form.synopsis}
                    onChange={(e) => setForm({ ...form, synopsis: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-[#0D5C46]"
                  />
                </div>
                {!editingBook && form.hasDigitalEdition && (
                  <div className="md:col-span-2">
                    <label className="block font-medium text-slate-700 mb-1">Cuplikan Teks Digital (Opsional)</label>
                    <textarea
                      rows={3}
                      value={form.digitalSampleText}
                      onChange={(e) => setForm({ ...form, digitalSampleText: e.target.value })}
                      placeholder="Pisahkan paragraf dengan baris kosong..."
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-[#0D5C46]"
                    />
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 font-medium text-white bg-[#0D5C46] rounded-lg hover:bg-[#094232] disabled:opacity-60"
                >
                  {saving ? 'Menyimpan...' : editingBook ? 'Simpan Perubahan' : 'Tambahkan Buku'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
