import { useCallback, useEffect, useState } from 'react';
import { AuthModal } from './components/AuthModal';
import { AutomatedReportsView } from './components/AutomatedReportsView';
import { AdminDashboard } from './components/AdminDashboard';
import { BookDetailModal } from './components/BookDetailModal';
import { CatalogView } from './components/CatalogView';
import { CollectionManager } from './components/CollectionManager';
import { DigitalReaderModal } from './components/DigitalReaderModal';
import { DigitalServicesView } from './components/DigitalServicesView';
import { MemberDashboard } from './components/MemberDashboard';
import { NavTab, Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import type {
  ActivityEvent,
  Book,
  BookRequest,
  LibrarySummaryStats,
  UserProfile,
} from './types/library';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('catalog');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // In-memory session state (never stored in localStorage/sessionStorage)
  const [token, setToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'member' | 'register' | 'admin'>('member');

  // Shared Library State
  const [books, setBooks] = useState<Book[]>([]);
  const [stats, setStats] = useState<LibrarySummaryStats | null>(null);
  const [liveActivities, setLiveActivities] = useState<ActivityEvent[]>([]);
  const [communityRequests, setCommunityRequests] = useState<Omit<BookRequest, 'requestedByUserId'>[]>([]);
  const [wishlistIds, setWishlistIds] = useState<string[]>([]);
  const [sseConnected, setSseConnected] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Active Modals
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [readerBook, setReaderBook] = useState<Book | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = useCallback((type: 'success' | 'error', text: string) => {
    setToast({ type, text });
    window.setTimeout(() => {
      setToast((prev) => (prev?.text === text ? null : prev));
    }, 4500);
  }, []);

  const loadCatalog = useCallback(async () => {
    try {
      const res = await fetch('/api/catalog');
      if (!res.ok) return;
      const data = (await res.json()) as {
        books: Book[];
        stats: LibrarySummaryStats;
        recentActivities: ActivityEvent[];
        communityRequests: Omit<BookRequest, 'requestedByUserId'>[];
      };
      setBooks(data.books);
      setStats(data.stats);
      setLiveActivities(data.recentActivities);
      setCommunityRequests(data.communityRequests);
    } catch {
      // Ignore transient load error
    }
  }, []);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  // Sync wishlist when user logs in
  useEffect(() => {
    if (!token || !currentUser) {
      setWishlistIds([]);
      return;
    }
    fetch('/api/member/dashboard', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { wishlistIds?: string[] } | null) => {
        if (data?.wishlistIds) setWishlistIds(data.wishlistIds);
      })
      .catch(() => {});
  }, [token, currentUser, refreshKey]);

  // Real-time SSE connection for instant transaction & catalog sync
  useEffect(() => {
    const es = new EventSource('/api/events');

    es.addEventListener('connected', (evt) => {
      setSseConnected(true);
      try {
        const parsed = JSON.parse((evt as MessageEvent).data) as {
          stats?: LibrarySummaryStats;
          activities?: ActivityEvent[];
        };
        if (parsed.stats) setStats(parsed.stats);
        if (parsed.activities) setLiveActivities(parsed.activities);
      } catch {
        // ignore
      }
    });

    const handleRealtimeEvent = (evt: MessageEvent) => {
      try {
        const payload = JSON.parse(evt.data) as {
          book?: Book;
          bookId?: string;
          activity?: ActivityEvent;
          stats?: LibrarySummaryStats;
        };
        if (payload.stats) setStats(payload.stats);
        if (payload.activity) {
          setLiveActivities((prev) => {
            if (prev.some((a) => a.id === payload.activity!.id)) return prev;
            return [payload.activity!, ...prev].slice(0, 30);
          });
        }
        if (payload.book) {
          setBooks((prev) => {
            const exists = prev.some((b) => b.id === payload.book!.id);
            if (exists) {
              return prev.map((b) => (b.id === payload.book!.id ? payload.book! : b));
            }
            return [payload.book!, ...prev];
          });
          setSelectedBook((prev) => (prev && prev.id === payload.book!.id ? payload.book! : prev));
        }
        if (payload.bookId) {
          setBooks((prev) => prev.filter((b) => b.id !== payload.bookId));
        }
        setRefreshKey((k) => k + 1);
      } catch {
        // ignore
      }
    };

    const eventNames = [
      'loan:created',
      'loan:returned',
      'loan:renewed',
      'book:created',
      'book:updated',
      'book:deleted',
      'reservation:created',
      'report:generated',
      'request:updated',
      'stats:updated',
    ];
    for (const name of eventNames) {
      es.addEventListener(name, handleRealtimeEvent as EventListener);
    }

    es.onerror = () => {
      setSseConnected(false);
    };

    return () => {
      es.close();
    };
  }, []);

  function openAuth(mode: 'member' | 'register' | 'admin' = 'member') {
    setAuthMode(mode);
    setAuthModalOpen(true);
  }

  function handleAuthenticated(newToken: string, user: UserProfile) {
    setToken(newToken);
    setCurrentUser(user);
    setRefreshKey((k) => k + 1);
    showToast('success', `Selamat datang, ${user.name}.`);
    if (user.role === 'admin' && activeTab === 'catalog') {
      setActiveTab('admin-dashboard');
    }
  }

  function handleLogout() {
    setToken(null);
    setCurrentUser(null);
    setWishlistIds([]);
    showToast('success', 'Sesi akun telah ditutup.');
  }

  async function handleBorrow(bookId: string, durationDays: 7 | 14) {
    if (!token) {
      openAuth('member');
      return;
    }
    const res = await fetch('/api/loans', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ bookId, durationDays }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal meminjam buku.');
    if (data.book) {
      setBooks((prev) => prev.map((b) => (b.id === data.book.id ? data.book : b)));
      setSelectedBook((prev) => (prev && prev.id === data.book.id ? data.book : prev));
    }
    setRefreshKey((k) => k + 1);
    showToast('success', `Berhasil meminjam "${data.loan.bookTitle}" (${data.loan.code}).`);
  }

  async function handleReserve(bookId: string) {
    if (!token) {
      openAuth('member');
      return;
    }
    const res = await fetch('/api/reservations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ bookId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal melakukan reservasi.');
    setRefreshKey((k) => k + 1);
    showToast('success', `Masuk antrean reservasi untuk "${data.reservation.bookTitle}".`);
  }

  async function handleReturnLoan(loanId: string) {
    if (!token) return;
    const res = await fetch(`/api/loans/${loanId}/return`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal memproses pengembalian.');
    setRefreshKey((k) => k + 1);
    loadCatalog();
    showToast('success', `Pengembalian ${data.loan.code} berhasil dicatat.`);
  }

  async function handleRenewLoan(loanId: string) {
    if (!token) return;
    const res = await fetch(`/api/loans/${loanId}/renew`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal memperpanjang peminjaman.');
    setRefreshKey((k) => k + 1);
    showToast('success', `Peminjaman ${data.loan.code} diperpanjang 7 hari.`);
  }

  async function handleCancelReservation(resId: string) {
    if (!token) return;
    const res = await fetch(`/api/reservations/${resId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal membatalkan reservasi.');
    setRefreshKey((k) => k + 1);
    showToast('success', 'Antrean reservasi dibatalkan.');
  }

  async function handleToggleWishlist(bookId: string) {
    if (!token) {
      openAuth('member');
      return;
    }
    const res = await fetch(`/api/wishlist/${bookId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) return;
    setWishlistIds(data.wishlist || []);
    setRefreshKey((k) => k + 1);
    showToast('success', data.saved ? 'Buku disimpan ke Daftar Baca.' : 'Buku dihapus dari Daftar Baca.');
  }

  function handleQuickBorrow(book: Book) {
    if (!currentUser) {
      setSelectedBook(book);
      openAuth('member');
      return;
    }
    setSelectedBook(book);
  }

  return (
    <div className="min-h-screen flex bg-[#F8F9FA] text-slate-900">
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        currentUser={currentUser}
        onOpenAuth={openAuth}
        onLogout={handleLogout}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          activeTab={activeTab}
          sseConnected={sseConnected}
          currentUser={currentUser}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onOpenAuth={openAuth}
        />

        {toast && (
          <div className="px-4 lg:px-8 pt-4 no-print">
            <div
              role="status"
              className={`px-4 py-3 rounded-lg border text-xs font-medium flex items-center justify-between ${
                toast.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-red-50 border-red-200 text-red-700'
              }`}
            >
              <span>{toast.text}</span>
              <button
                type="button"
                onClick={() => setToast(null)}
                className="ml-4 text-xs underline opacity-80 hover:opacity-100"
              >
                Tutup
              </button>
            </div>
          </div>
        )}

        <main className="flex-1 px-4 lg:px-8 py-6 max-w-[1440px] w-full mx-auto">
          {activeTab === 'catalog' && (
            <CatalogView
              books={books}
              stats={stats}
              wishlistIds={wishlistIds}
              onSelectBook={setSelectedBook}
              onQuickBorrow={handleQuickBorrow}
              onOpenReader={setReaderBook}
            />
          )}

          {activeTab === 'member-dashboard' && (
            <MemberDashboard
              currentUser={currentUser}
              token={token}
              refreshKey={refreshKey}
              liveActivities={liveActivities}
              onOpenAuth={openAuth}
              onSelectBook={setSelectedBook}
              onReturnLoan={handleReturnLoan}
              onRenewLoan={handleRenewLoan}
              onCancelReservation={handleCancelReservation}
              onRemoveWishlist={handleToggleWishlist}
            />
          )}

          {activeTab === 'admin-dashboard' && (
            <AdminDashboard
              currentUser={currentUser}
              token={token}
              refreshKey={refreshKey}
              liveActivities={liveActivities}
              liveStats={stats}
              onOpenAuth={openAuth}
              onReturnLoan={handleReturnLoan}
              onRefreshTrigger={() => setRefreshKey((k) => k + 1)}
            />
          )}

          {activeTab === 'collection-manager' && (
            <CollectionManager
              books={books}
              currentUser={currentUser}
              token={token}
              onOpenAuth={openAuth}
              onCatalogMutated={() => {
                loadCatalog();
                setRefreshKey((k) => k + 1);
              }}
            />
          )}

          {activeTab === 'automated-reports' && (
            <AutomatedReportsView
              currentUser={currentUser}
              token={token}
              refreshKey={refreshKey}
              onOpenAuth={openAuth}
              onReportGenerated={() => setRefreshKey((k) => k + 1)}
            />
          )}

          {activeTab === 'digital-services' && (
            <DigitalServicesView
              books={books}
              communityRequests={communityRequests}
              currentUser={currentUser}
              token={token}
              onOpenReader={setReaderBook}
              onOpenAuth={openAuth}
              onRequestCreated={() => {
                loadCatalog();
                setRefreshKey((k) => k + 1);
              }}
            />
          )}
        </main>

        <footer className="px-4 lg:px-8 py-5 border-t border-slate-200 bg-white text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2 no-print">
          <span>wonu&apos;s library · Layanan Perpustakaan Digital &amp; Manajemen Sirkulasi</span>
          <span>Denda keterlambatan Rp 2.000/hari · Maksimal 5 pinjaman aktif</span>
        </footer>
      </div>

      <BookDetailModal
        book={selectedBook}
        currentUser={currentUser}
        token={token}
        isWishlisted={selectedBook ? wishlistIds.includes(selectedBook.id) : false}
        onClose={() => setSelectedBook(null)}
        onBorrow={handleBorrow}
        onReserve={handleReserve}
        onToggleWishlist={handleToggleWishlist}
        onOpenReader={(b) => {
          setSelectedBook(null);
          setReaderBook(b);
        }}
        onRequireAuth={() => openAuth('member')}
        onBookUpdated={(updated) => {
          setBooks((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
          setSelectedBook(updated);
        }}
      />

      <DigitalReaderModal book={readerBook} onClose={() => setReaderBook(null)} />

      <AuthModal
        isOpen={authModalOpen}
        initialMode={authMode}
        onClose={() => setAuthModalOpen(false)}
        onAuthenticated={handleAuthenticated}
      />
    </div>
  );
}
