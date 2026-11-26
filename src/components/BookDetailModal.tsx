import { FormEvent, useEffect, useState } from 'react';
import { Bookmark, BookOpen, CalendarClock, CheckCircle2, Star, X } from 'lucide-react';
import type { Book, BookReview, UserProfile } from '../types/library';
import { formatDateId } from '../utils/format';
import { BookCover } from './BookCover';

interface BookDetailModalProps {
  book: Book | null;
  currentUser: UserProfile | null;
  token: string | null;
  isWishlisted: boolean;
  onClose: () => void;
  onBorrow: (bookId: string, durationDays: 7 | 14) => Promise<void>;
  onReserve: (bookId: string) => Promise<void>;
  onToggleWishlist: (bookId: string) => Promise<void>;
  onOpenReader: (book: Book) => void;
  onRequireAuth: () => void;
  onBookUpdated: (book: Book) => void;
}

export function BookDetailModal({
  book,
  currentUser,
  token,
  isWishlisted,
  onClose,
  onBorrow,
  onReserve,
  onToggleWishlist,
  onOpenReader,
  onRequireAuth,
  onBookUpdated,
}: BookDetailModalProps) {
  const [durationDays, setDurationDays] = useState<7 | 14>(7);
  const [reviews, setReviews] = useState<BookReview[]>([]);
  const [waitingCount, setWaitingCount] = useState(0);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!book) return;
    setFeedback(null);
    fetch(`/api/books/${book.id}`)
      .then((res) => res.json())
      .then((data: { reviews?: BookReview[]; waitingCount?: number }) => {
        setReviews(data.reviews || []);
        setWaitingCount(data.waitingCount || 0);
      })
      .catch(() => {});
  }, [book?.id]);

  if (!book) return null;

  async function handleBorrowClick() {
    if (!currentUser) {
      onRequireAuth();
      return;
    }
    setSubmitting(true);
    setFeedback(null);
    try {
      await onBorrow(book!.id, durationDays);
      setFeedback({ type: 'success', text: `Peminjaman berhasil dicatat untuk durasi ${durationDays} hari.` });
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Gagal meminjam buku.' });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReserveClick() {
    if (!currentUser) {
      onRequireAuth();
      return;
    }
    setSubmitting(true);
    setFeedback(null);
    try {
      await onReserve(book!.id);
      setWaitingCount((c) => c + 1);
      setFeedback({ type: 'success', text: 'Anda telah masuk ke daftar antrean reservasi buku ini.' });
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Gagal melakukan reservasi.' });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReviewSubmit(e: FormEvent) {
    e.preventDefault();
    if (!currentUser || !token) {
      onRequireAuth();
      return;
    }
    setReviewLoading(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/books/${book!.id}/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ rating, comment }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengirim ulasan.');
      setReviews((prev) => [data.review, ...prev]);
      if (data.book) onBookUpdated(data.book);
      setComment('');
      setFeedback({ type: 'success', text: 'Ulasan Anda telah dipublikasikan.' });
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Gagal mengirim ulasan.' });
    } finally {
      setReviewLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-[1px]">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-4xl max-h-[90vh] bg-white border border-slate-200 rounded-xl shadow-xl flex flex-col overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-xs font-mono text-slate-500">
            {book.callNumber} · ISBN {book.isbn}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
            aria-label="Tutup detail buku"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-8 items-start">
            <BookCover book={book} className="w-44 md:w-full aspect-[3/4] rounded-lg mx-auto md:mx-0" />

            <div className="space-y-5">
              <div>
                <p className="text-xs font-medium text-[#0D5C46]">
                  {book.category} · {book.rackLocation} · {book.publishYear}
                </p>
                <h2 className="font-serif text-2xl md:text-3xl font-semibold text-slate-900 mt-1">
                  {book.title}
                </h2>
                <p className="text-sm text-slate-600 mt-1">
                  Ditulis oleh <strong className="font-semibold text-slate-900">{book.author}</strong> · {book.publisher}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 py-3 border-y border-slate-200 text-xs text-slate-600">
                <span className="tabular-nums">
                  Ketersediaan:{' '}
                  <strong className={book.availableCopies > 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'}>
                    {book.availableCopies} / {book.totalCopies} eksemplar
                  </strong>
                </span>
                <span className="tabular-nums">{book.pages} halaman</span>
                <span className="tabular-nums">Dipinjam {book.borrowCount} kali</span>
                <span className="inline-flex items-center gap-1 tabular-nums">
                  <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                  {book.ratingCount > 0 ? `${book.ratingAvg} (${book.ratingCount} ulasan)` : 'Belum ada ulasan'}
                </span>
              </div>

              <p className="text-sm text-slate-700 leading-relaxed">{book.synopsis}</p>

              {feedback && (
                <div
                  className={`p-3 rounded-lg border text-xs flex items-center gap-2 ${
                    feedback.type === 'success'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-red-50 border-red-200 text-red-700'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{feedback.text}</span>
                </div>
              )}

              <div className="space-y-3 pt-1">
                {book.availableCopies > 0 ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="inline-flex items-center p-1 bg-slate-100 rounded-lg">
                      <button
                        type="button"
                        onClick={() => setDurationDays(7)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                          durationDays === 7 ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                        }`}
                      >
                        7 Hari
                      </button>
                      <button
                        type="button"
                        onClick={() => setDurationDays(14)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                          durationDays === 14 ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                        }`}
                      >
                        14 Hari
                      </button>
                    </div>

                    <button
                      type="button"
                      disabled={submitting}
                      onClick={handleBorrowClick}
                      className="px-5 py-2.5 text-xs font-medium text-white bg-[#0D5C46] rounded-lg hover:bg-[#094232] disabled:opacity-60 transition-colors whitespace-nowrap"
                    >
                      {submitting ? 'Memproses...' : `Pinjam Buku (${durationDays} Hari)`}
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={handleReserveClick}
                      className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-60 transition-colors"
                    >
                      <CalendarClock className="w-4 h-4" />
                      <span>{submitting ? 'Memproses...' : `Masuk Antrean Reservasi (${waitingCount} menunggu)`}</span>
                    </button>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-3">
                  {book.hasDigitalEdition && (
                    <button
                      type="button"
                      onClick={() => onOpenReader(book)}
                      className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>Baca Cuplikan Digital</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      if (!currentUser) {
                        onRequireAuth();
                        return;
                      }
                      onToggleWishlist(book.id);
                    }}
                    className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-medium border rounded-lg transition-colors ${
                      isWishlisted
                        ? 'bg-[#0D5C46]/10 border-[#0D5C46]/30 text-[#0D5C46]'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Bookmark className={`w-3.5 h-3.5 ${isWishlisted ? 'fill-[#0D5C46]' : ''}`} />
                    <span>{isWishlisted ? 'Tersimpan di Daftar Baca' : 'Simpan ke Daftar Baca'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-900">Ulasan Pembaca</h3>
              {reviews.length === 0 ? (
                <p className="text-xs text-slate-500">Belum ada ulasan untuk judul ini. Jadilah pembaca pertama yang memberi catatan.</p>
              ) : (
                <div className="space-y-4">
                  {reviews.map((rev) => (
                    <div key={rev.id} className="pb-4 border-b border-slate-100 last:border-b-0">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-900">{rev.userName}</span>
                        <span className="text-slate-400 font-mono tabular-nums">{formatDateId(rev.createdAt)}</span>
                      </div>
                      <div className="flex items-center gap-1 mt-1 text-amber-500">
                        {Array.from({ length: rev.rating }).map((_, idx) => (
                          <Star key={idx} className="w-3 h-3 fill-amber-500" />
                        ))}
                      </div>
                      <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">{rev.comment}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <form onSubmit={handleReviewSubmit} className="space-y-3 bg-slate-50 p-5 rounded-lg border border-slate-200 h-fit">
              <h4 className="text-xs font-semibold text-slate-900">Tulis Ulasan Pembaca</h4>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-600">Penilaian:</span>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((starVal) => (
                    <button
                      key={starVal}
                      type="button"
                      onClick={() => setRating(starVal)}
                      className="p-1 text-amber-500 hover:scale-110 transition-transform"
                      aria-label={`Beri ${starVal} bintang`}
                    >
                      <Star className={`w-4 h-4 ${starVal <= rating ? 'fill-amber-500' : 'text-slate-300'}`} />
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                rows={3}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                required
                placeholder={currentUser ? 'Bagikan ringkasan atau kesan Anda tentang buku ini...' : 'Masuk akun terlebih dahulu untuk menulis ulasan'}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D5C46]/30 focus:border-[#0D5C46]"
              />
              <button
                type="submit"
                disabled={reviewLoading}
                className="px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-60 transition-colors"
              >
                {reviewLoading ? 'Mengirim...' : 'Kirim Ulasan'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
