import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type {
  ActivityEvent,
  Book,
  BookRequest,
  BookReview,
  GeneratedReport,
  LibraryNotification,
  LibrarySummaryStats,
  LoanTransaction,
  ReportSchedule,
  Reservation,
  UserProfile,
} from '../src/types/library.ts';

export interface StoredUser extends UserProfile {
  passwordHash: string;
  passwordSalt: string;
}

export interface LibraryDatabase {
  adminAuth: {
    claimed: boolean;
    passwordHash: string | null;
    passwordSalt: string | null;
    claimedAt: string | null;
  };
  users: StoredUser[];
  books: Book[];
  reviews: BookReview[];
  loans: LoanTransaction[];
  reservations: Reservation[];
  wishlists: Record<string, string[]>;
  requests: BookRequest[];
  notifications: LibraryNotification[];
  activities: ActivityEvent[];
  reportSchedules: ReportSchedule[];
  reports: GeneratedReport[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = path.resolve(DATA_DIR, 'library-db.json');

export const FINE_PER_DAY_IDR = 2000;

export function hashPassword(password: string, existingSalt?: string): { hash: string; salt: string } {
  const salt = existingSalt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash: derived, salt };
}

export function verifyPassword(password: string, salt: string, expectedHash: string): boolean {
  const derived = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHash, 'hex');
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

function isoDaysAgo(days: number, hour = 10): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, 15, 0, 0);
  return d.toISOString();
}

function isoDaysAhead(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(17, 0, 0, 0);
  return d.toISOString();
}

function createInitialData(): LibraryDatabase {
  const now = new Date().toISOString();

  const books: Book[] = [
    {
      id: 'book-filosofi-senja',
      title: 'Filosofi Senja & Ruang Sunyi',
      author: 'Aruna Widjaja',
      category: 'Filsafat & Esai',
      isbn: '978-602-481-901-2',
      callNumber: '181.2 WID f',
      publisher: 'Pustaka Lentera',
      publishYear: 2024,
      pages: 268,
      rackLocation: 'Rak A-04',
      language: 'Indonesia',
      synopsis:
        'Kumpulan esai reflektif tentang bagaimana manusia modern merawat ketenangan batin, keheningan ruang baca, dan etika perhatian di tengah arus informasi cepat.',
      coverUrl: '/src/assets/images/cover_filosofi_senja_1795658248710.jpg',
      accentTone: 'amber',
      totalCopies: 4,
      availableCopies: 2,
      borrowCount: 38,
      ratingAvg: 4.9,
      ratingCount: 14,
      hasDigitalEdition: true,
      digitalSample: [
        'Bab I — Menjaga Hening di Tengah Bising. Ada satu kebiasaan lama di ruang baca kota pelabuhan: para pengunjung meletakkan arloji mereka di balik sampul buku sebelum membuka halaman pertama. Bukan karena waktu tidak penting, melainkan agar ritme pikiran tidak dipaksa berlari oleh jarum detik.',
        'Ketika perpustakaan berubah menjadi ruang digital, keheningan itu tidak lagi diukur dari desibel langkah kaki di lantai kayu, melainkan dari kejernihan perhatian kita sendiri. Membaca secara utuh adalah bentuk perlawanan paling lembut terhadap fragmentasi ingatan.',
        'Di wonu\'s library, setiap catatan pinggir yang ditinggalkan pembaca terdahulu menjadi jembatan sunyi lintas generasi—menghubungkan pertanyaan seorang mahasiswa di pagi hujan dengan renungan seorang peneliti di malam musim kemarau.'
      ],
      createdAt: isoDaysAgo(90),
      updatedAt: now,
    },
    {
      id: 'book-arsitektur-sunyi',
      title: 'Arsitektur Cahaya dan Beton Tropis',
      author: 'Ir. Bagas Pramudya',
      category: 'Arsitektur & Desain',
      isbn: '978-623-712-304-8',
      callNumber: '720.9598 PRA a',
      publisher: 'Balai Grafika Nusantara',
      publishYear: 2023,
      pages: 342,
      rackLocation: 'Rak C-11',
      language: 'Indonesia',
      synopsis:
        'Monograf visual dan teknis yang mengulas bangunan publik tropis, pemanfaatan cahaya alami, ventilasi silang, serta material beton ekspos yang ramah iklim lembap.',
      coverUrl: '/src/assets/images/cover_arsitektur_sunyi_1795658242086.jpg',
      accentTone: 'slate',
      totalCopies: 3,
      availableCopies: 1,
      borrowCount: 29,
      ratingAvg: 4.8,
      ratingCount: 9,
      hasDigitalEdition: true,
      digitalSample: [
        'Pengantar — Cahaya Sebagai Material Struktural. Dalam arsitektur tropis kontemporer, bukaan bukan sekadar lubang pada dinding, melainkan instrumen kalibrasi termal dan psikologis. Bayangan yang jatuh pada pukul sebelas siang membentuk geometri dinamis yang menenangkan mata.',
        'Studi kasus ruang baca publik di Bandung dan Yogyakarta menunjukkan bahwa pencahayaan alami tidak langsung mampu menurunkan kelelahan visual hingga 40 persen dibandingkan pencahayaan fluoresen konvensional.'
      ],
      createdAt: isoDaysAgo(80),
      updatedAt: now,
    },
    {
      id: 'book-algoritma-data',
      title: 'Struktur Data & Sistem Terdistribusi',
      author: 'Dr. Kenji Hartono',
      category: 'Teknologi & Komputer',
      isbn: '978-602-990-118-5',
      callNumber: '005.73 HAR s',
      publisher: 'Penerbit Informatika Terpadu',
      publishYear: 2025,
      pages: 484,
      rackLocation: 'Rak D-02',
      language: 'Indonesia',
      synopsis:
        'Panduan komprehensif merancang sistem perangkat lunak yang tangguh, konsistensi data real-time, arsitektur berbasis event, dan indeks pencarian cepat untuk skala modern.',
      coverUrl: '/src/assets/images/cover_algoritma_data_1795658242832.jpg',
      accentTone: 'indigo',
      totalCopies: 5,
      availableCopies: 0,
      borrowCount: 54,
      ratingAvg: 4.9,
      ratingCount: 21,
      hasDigitalEdition: true,
      digitalSample: [
        'Bab 4 — Konsistensi Event & Replikasi State. Setiap kali dua pengguna memperbarui sumber daya yang sama dalam sistem terdistribusi, server otoritatif harus menjamin urutan deterministik agar tidak terjadi kondisi balapan (race condition) pada stok inventaris.',
        'Pola event-driven dengan Server-Sent Events (SSE) memungkinkan dashboard pemantauan menerima pembaruan instan tanpa polling berlebihan, menjaga efisiensi jaringan sekaligus akurasi tampilan metrik.'
      ],
      createdAt: isoDaysAgo(70),
      updatedAt: now,
    },
    {
      id: 'book-ekologi-nusantara',
      title: 'Atlas Botani & Ekologi Nusantara',
      author: 'Prof. Ratna Sari Dewi',
      category: 'Sains & Alam',
      isbn: '978-602-331-512-9',
      callNumber: '581.9598 DEW a',
      publisher: 'Herbarium Press',
      publishYear: 2024,
      pages: 396,
      rackLocation: 'Rak B-07',
      language: 'Indonesia',
      synopsis:
        'Dokumentasi flora paku-pakuan, anggrek hutan hujan, dan ekosistem pesisir kepulauan Indonesia lengkap dengan catatan taksonomi dan ilustrasi botani klasik.',
      coverUrl: '/src/assets/images/cover_ekologi_nusantara_1795658242255.jpg',
      accentTone: 'forest',
      totalCopies: 3,
      availableCopies: 3,
      borrowCount: 22,
      ratingAvg: 4.7,
      ratingCount: 8,
      hasDigitalEdition: true,
      digitalSample: [
        'Catatan Lapangan Pegunungan Gede — Paku-pakuan epifit tumbuh subur di zona kabut antara ketinggian 1.400 hingga 2.200 meter. Kelembapan konstan menjaga spora tetap viabel sepanjang musim peralihan.',
        'Setiap spesimen yang diarsipkan sejak tahun 1920 memberikan petunjuk berharga mengenai pergeseran mikroklimat regional selama satu abad terakhir.'
      ],
      createdAt: isoDaysAgo(65),
      updatedAt: now,
    },
    {
      id: 'book-laut-bercerita',
      title: 'Catatan Pelabuhan dan Peta Kuno',
      author: 'Surya Dharmawan',
      category: 'Sejarah & Budaya',
      isbn: '978-602-119-745-1',
      callNumber: '959.802 DHA c',
      publisher: 'Cakrawala Arsip',
      publishYear: 2022,
      pages: 318,
      rackLocation: 'Rak E-03',
      language: 'Indonesia',
      synopsis:
        'Penelusuran jalur perdagangan maritim abad ke-16 hingga ke-19 melalui manuskrip syahbandar, peta kartografi tua, dan korespondensi pedagang rempah Nusantara.',
      coverUrl: null,
      accentTone: 'crimson',
      totalCopies: 3,
      availableCopies: 2,
      borrowCount: 31,
      ratingAvg: 4.6,
      ratingCount: 11,
      hasDigitalEdition: true,
      digitalSample: [
        'Syahbandar dan Bahasa Pasar — Di pelabuhan Banten abad ke-17, lebih dari dua belas bahasa digunakan secara bergantian di dermaga. Catatan gudang menunjukkan sistem pembukuan ganda yang sangat terstruktur.'
      ],
      createdAt: isoDaysAgo(60),
      updatedAt: now,
    },
    {
      id: 'book-ekonomi-mikro',
      title: 'Ekonomi Perhatian & Koperasi Digital',
      author: 'Dr. Maya Kartika',
      category: 'Ekonomi & Sosial',
      isbn: '978-623-504-210-3',
      callNumber: '334.09598 KAR e',
      publisher: 'Lingkar Ekonomi Mandiri',
      publishYear: 2025,
      pages: 254,
      rackLocation: 'Rak F-09',
      language: 'Indonesia',
      synopsis:
        'Analisis model tata kelola platform digital berbasis komunitas, distribusi nilai ekonomi yang adil, serta studi kasus transformasi koperasi modern di Asia Tenggara.',
      coverUrl: null,
      accentTone: 'forest',
      totalCopies: 4,
      availableCopies: 4,
      borrowCount: 18,
      ratingAvg: 4.5,
      ratingCount: 6,
      hasDigitalEdition: false,
      digitalSample: [],
      createdAt: isoDaysAgo(50),
      updatedAt: now,
    },
    {
      id: 'book-tipografi-modern',
      title: 'Grid, Ritme, dan Tipografi Editorial',
      author: 'Hana Kusumawati',
      category: 'Arsitektur & Desain',
      isbn: '978-602-884-409-0',
      callNumber: '686.22 KUS g',
      publisher: 'Studio Huruf Jakarta',
      publishYear: 2024,
      pages: 228,
      rackLocation: 'Rak C-05',
      language: 'Indonesia',
      synopsis:
        'Referensi praktis merancang sistem tipografi berhierarki kuat untuk media cetak dan antarmuka digital: proporsi huruf, angka tabular, hingga spasi editorial.',
      coverUrl: null,
      accentTone: 'slate',
      totalCopies: 2,
      availableCopies: 1,
      borrowCount: 25,
      ratingAvg: 4.9,
      ratingCount: 12,
      hasDigitalEdition: true,
      digitalSample: [
        'Prinsip Angka Tabular — Dalam laporan sirkulasi maupun tabel keuangan, angka tidak boleh bergeser secara horizontal antarbaris. Mengaktifkan tabular-nums menjaga keterbacaan kolom secara presisi.'
      ],
      createdAt: isoDaysAgo(45),
      updatedAt: now,
    },
    {
      id: 'book-sastra-hujan',
      title: 'Kumpulan Cerpen Musim Peralihan',
      author: 'Larasati Nirmala',
      category: 'Fiksi & Sastra',
      isbn: '978-602-402-667-4',
      callNumber: '899.221 NIR k',
      publisher: 'Pustaka Lentera',
      publishYear: 2023,
      pages: 198,
      rackLocation: 'Rak A-14',
      language: 'Indonesia',
      synopsis:
        'Dua belas cerita pendek bertema kota kecil, stasiun kereta tua, toko buku bekas, dan percakapan yang tertunda di penghujung musim hujan.',
      coverUrl: null,
      accentTone: 'amber',
      totalCopies: 5,
      availableCopies: 3,
      borrowCount: 42,
      ratingAvg: 4.8,
      ratingCount: 19,
      hasDigitalEdition: true,
      digitalSample: [
        'Stasiun Pukul Lima — Lampu peron menyala satu per satu ketika gerimis mulai reda. Di bangku kayu dekat loket lama, seorang gadis mencatat nomor seri setiap lokomotif yang melintas pada buku saku bersampul kain hijau.'
      ],
      createdAt: isoDaysAgo(40),
      updatedAt: now,
    },
    {
      id: 'book-ai-etika',
      title: 'Etika Komputasi & Literasi Informasi',
      author: 'Prof. Hendra Wijaya',
      category: 'Teknologi & Komputer',
      isbn: '978-623-918-022-7',
      callNumber: '174.9004 WIJ e',
      publisher: 'Penerbit Informatika Terpadu',
      publishYear: 2025,
      pages: 310,
      rackLocation: 'Rak D-10',
      language: 'Indonesia',
      synopsis:
        'Kajian kritis tentang transparansi algoritma, privasi data warga, verifikasi arsip pengetahuan, dan peran perpustakaan sebagai benteng literasi publik.',
      coverUrl: null,
      accentTone: 'indigo',
      totalCopies: 3,
      availableCopies: 2,
      borrowCount: 19,
      ratingAvg: 4.7,
      ratingCount: 7,
      hasDigitalEdition: true,
      digitalSample: [
        'Perpustakaan Sebagai Infrastruktur Kebenaran — Di era sintesis informasi otomatis, kurasi katalog yang terverifikasi dan jejak bibliografi yang jelas menjadi kebutuhan sipil utama.'
      ],
      createdAt: isoDaysAgo(30),
      updatedAt: now,
    },
    {
      id: 'book-sejarah-aksara',
      title: 'Jejak Aksara & Manuskrip Kertas Daluwang',
      author: 'Dr. Citra Lestari',
      category: 'Sejarah & Budaya',
      isbn: '978-602-773-819-6',
      callNumber: '091.09598 LES j',
      publisher: 'Cakrawala Arsip',
      publishYear: 2021,
      pages: 288,
      rackLocation: 'Rak E-08',
      language: 'Indonesia',
      synopsis:
        'Mengungkap teknik pembuatan kertas tradisional daluwang dari kulit pohon saeh serta upaya digitalisasi naskah kuno di berbagai perpustakaan daerah.',
      coverUrl: null,
      accentTone: 'crimson',
      totalCopies: 2,
      availableCopies: 2,
      borrowCount: 15,
      ratingAvg: 4.8,
      ratingCount: 5,
      hasDigitalEdition: false,
      digitalSample: [],
      createdAt: isoDaysAgo(25),
      updatedAt: now,
    },
  ];

  const sampleMember1: StoredUser = {
    id: 'usr-member-raka',
    name: 'Raka Pratama',
    email: 'raka.pratama@wonulibrary.id',
    role: 'member',
    memberCode: 'WONU-MBR-1001',
    joinedAt: isoDaysAgo(120),
    maxLoans: 5,
    passwordHash: '',
    passwordSalt: '',
  };

  const sampleMember2: StoredUser = {
    id: 'usr-member-nadia',
    name: 'Nadia Kusuma',
    email: 'nadia.kusuma@wonulibrary.id',
    role: 'member',
    memberCode: 'WONU-MBR-1002',
    joinedAt: isoDaysAgo(95),
    maxLoans: 5,
    passwordHash: '',
    passwordSalt: '',
  };

  const sampleMember3: StoredUser = {
    id: 'usr-member-dimas',
    name: 'Dimas Mahendra',
    email: 'dimas.mahendra@wonulibrary.id',
    role: 'member',
    memberCode: 'WONU-MBR-1003',
    joinedAt: isoDaysAgo(60),
    maxLoans: 5,
    passwordHash: '',
    passwordSalt: '',
  };

  const loans: LoanTransaction[] = [
    {
      id: 'loan-seed-1',
      code: 'TRX-20261125-0101',
      bookId: 'book-algoritma-data',
      bookTitle: 'Struktur Data & Sistem Terdistribusi',
      bookCallNumber: '005.73 HAR s',
      userId: sampleMember1.id,
      userName: sampleMember1.name,
      memberCode: sampleMember1.memberCode,
      borrowedAt: isoDaysAgo(3, 9),
      dueDate: isoDaysAhead(4),
      returnedAt: null,
      status: 'active',
      renewedCount: 0,
      fineAmount: 0,
      reminderSentAt: null,
    },
    {
      id: 'loan-seed-2',
      code: 'TRX-20261125-0102',
      bookId: 'book-filosofi-senja',
      bookTitle: 'Filosofi Senja & Ruang Sunyi',
      bookCallNumber: '181.2 WID f',
      userId: sampleMember2.id,
      userName: sampleMember2.name,
      memberCode: sampleMember2.memberCode,
      borrowedAt: isoDaysAgo(11, 14),
      dueDate: isoDaysAgo(4, 17),
      returnedAt: null,
      status: 'overdue',
      renewedCount: 0,
      fineAmount: 4 * FINE_PER_DAY_IDR,
      reminderSentAt: isoDaysAgo(1, 9),
    },
    {
      id: 'loan-seed-3',
      code: 'TRX-20261124-0098',
      bookId: 'book-arsitektur-sunyi',
      bookTitle: 'Arsitektur Cahaya dan Beton Tropis',
      bookCallNumber: '720.9598 PRA a',
      userId: sampleMember3.id,
      userName: sampleMember3.name,
      memberCode: sampleMember3.memberCode,
      borrowedAt: isoDaysAgo(1, 11),
      dueDate: isoDaysAhead(6),
      returnedAt: null,
      status: 'active',
      renewedCount: 0,
      fineAmount: 0,
      reminderSentAt: null,
    },
    {
      id: 'loan-seed-4',
      code: 'TRX-20261122-0091',
      bookId: 'book-sastra-hujan',
      bookTitle: 'Kumpulan Cerpen Musim Peralihan',
      bookCallNumber: '899.221 NIR k',
      userId: sampleMember1.id,
      userName: sampleMember1.name,
      memberCode: sampleMember1.memberCode,
      borrowedAt: isoDaysAgo(5, 13),
      dueDate: isoDaysAhead(2),
      returnedAt: isoDaysAgo(1, 16),
      status: 'returned',
      renewedCount: 0,
      fineAmount: 0,
      reminderSentAt: null,
    },
    {
      id: 'loan-seed-5',
      code: 'TRX-20261120-0084',
      bookId: 'book-ekologi-nusantara',
      bookTitle: 'Atlas Botani & Ekologi Nusantara',
      bookCallNumber: '581.9598 DEW a',
      userId: sampleMember2.id,
      userName: sampleMember2.name,
      memberCode: sampleMember2.memberCode,
      borrowedAt: isoDaysAgo(6, 10),
      dueDate: isoDaysAhead(1),
      returnedAt: isoDaysAgo(0, 9),
      status: 'returned',
      renewedCount: 1,
      fineAmount: 0,
      reminderSentAt: null,
    },
    {
      id: 'loan-seed-6',
      code: 'TRX-20261125-0103',
      bookId: 'book-tipografi-modern',
      bookTitle: 'Grid, Ritme, dan Tipografi Editorial',
      bookCallNumber: '686.22 KUS g',
      userId: sampleMember3.id,
      userName: sampleMember3.name,
      memberCode: sampleMember3.memberCode,
      borrowedAt: isoDaysAgo(0, 10),
      dueDate: isoDaysAhead(7),
      returnedAt: null,
      status: 'active',
      renewedCount: 0,
      fineAmount: 0,
      reminderSentAt: null,
    },
  ];

  // Adjust available copies so seed data is consistent with active/overdue loans
  // book-algoritma-data: 5 total, 1 active above + 4 others out -> 0 available (matches waitlist scenario!)
  // Let's keep availableCopies consistent with explicit seed loans or treat seed loans as subset + physical circulation.
  // Even better: let's add 4 seed active loans for book-algoritma-data or adjust totalCopies so math is exact!
  books[0].totalCopies = 4;
  books[0].availableCopies = 3; // 1 overdue loan (loan-seed-2)
  books[1].totalCopies = 3;
  books[1].availableCopies = 2; // 1 active loan (loan-seed-3)
  books[2].totalCopies = 1;
  books[2].availableCopies = 0; // 1 active loan (loan-seed-1) -> stock 0 so reservation queue works immediately!
  books[6].totalCopies = 2;
  books[6].availableCopies = 1; // 1 active loan (loan-seed-6)

  const reservations: Reservation[] = [
    {
      id: 'res-seed-1',
      bookId: 'book-algoritma-data',
      bookTitle: 'Struktur Data & Sistem Terdistribusi',
      userId: sampleMember2.id,
      userName: sampleMember2.name,
      memberCode: sampleMember2.memberCode,
      createdAt: isoDaysAgo(1, 15),
      status: 'waiting',
    },
  ];

  const reviews: BookReview[] = [
    {
      id: 'rev-1',
      bookId: 'book-filosofi-senja',
      userId: sampleMember1.id,
      userName: sampleMember1.name,
      rating: 5,
      comment: 'Prosa yang sangat tenang dan relevan bagi pembaca yang merindukan ruang refleksi.',
      createdAt: isoDaysAgo(12),
    },
    {
      id: 'rev-2',
      bookId: 'book-algoritma-data',
      userId: sampleMember3.id,
      userName: sampleMember3.name,
      rating: 5,
      comment: 'Penjelasan konsistensi data real-time sangat jernih dengan diagram arsitektur yang rapi.',
      createdAt: isoDaysAgo(8),
    },
  ];

  const requests: BookRequest[] = [
    {
      id: 'req-seed-1',
      title: 'Sejarah Perpustakaan Alexandria & Pelestarian Naskah',
      author: 'Dr. Farhan Al-Kindi',
      category: 'Sejarah & Budaya',
      reason: 'Sangat dibutuhkan untuk referensi riset sejarah literasi semester ini.',
      requestedByUserId: sampleMember1.id,
      requestedByName: sampleMember1.name,
      status: 'pending',
      adminNote: null,
      createdAt: isoDaysAgo(2),
      updatedAt: isoDaysAgo(2),
    },
  ];

  const activities: ActivityEvent[] = [
    {
      id: 'act-1',
      type: 'borrow',
      title: 'Peminjaman Buku Baru',
      detail: 'Grid, Ritme, dan Tipografi Editorial (TRX-20261125-0103)',
      actorLabel: 'Dimas Mahendra · WONU-MBR-1003',
      timestamp: isoDaysAgo(0, 10),
    },
    {
      id: 'act-2',
      type: 'return',
      title: 'Pengembalian Tepat Waktu',
      detail: 'Atlas Botani & Ekologi Nusantara (TRX-20261120-0084)',
      actorLabel: 'Nadia Kusuma · WONU-MBR-1002',
      timestamp: isoDaysAgo(0, 9),
    },
    {
      id: 'act-3',
      type: 'reserve',
      title: 'Masuk Antrean Reservasi',
      detail: 'Struktur Data & Sistem Terdistribusi',
      actorLabel: 'Nadia Kusuma · WONU-MBR-1002',
      timestamp: isoDaysAgo(1, 15),
    },
    {
      id: 'act-4',
      type: 'borrow',
      title: 'Peminjaman Buku Baru',
      detail: 'Arsitektur Cahaya dan Beton Tropis (TRX-20261124-0098)',
      actorLabel: 'Dimas Mahendra · WONU-MBR-1003',
      timestamp: isoDaysAgo(1, 11),
    },
  ];

  const reportSchedules: ReportSchedule[] = [
    {
      id: 'sched-daily',
      name: 'Rekap Sirkulasi Harian Otomatis',
      frequency: 'daily',
      reportType: 'circulation',
      enabled: true,
      runHour: 17,
      lastRunAt: isoDaysAgo(1, 17),
      nextRunAt: isoDaysAhead(1),
    },
    {
      id: 'sched-weekly',
      name: 'Audit Keterlambatan & Denda Mingguan',
      frequency: 'weekly',
      reportType: 'overdue',
      enabled: true,
      runHour: 9,
      lastRunAt: isoDaysAgo(6, 9),
      nextRunAt: isoDaysAhead(1),
    },
    {
      id: 'sched-monthly',
      name: 'Laporan Inventaris & Koleksi Bulanan',
      frequency: 'monthly',
      reportType: 'inventory',
      enabled: true,
      runHour: 8,
      lastRunAt: isoDaysAgo(24, 8),
      nextRunAt: isoDaysAhead(6),
    },
  ];

  const db: LibraryDatabase = {
    adminAuth: {
      claimed: false,
      passwordHash: null,
      passwordSalt: null,
      claimedAt: null,
    },
    users: [sampleMember1, sampleMember2, sampleMember3],
    books,
    reviews,
    loans,
    reservations,
    wishlists: {
      [sampleMember1.id]: ['book-filosofi-senja', 'book-ekologi-nusantara'],
    },
    requests,
    notifications: [],
    activities,
    reportSchedules,
    reports: [],
  };

  db.reports.push(buildReportSnapshot(db, 'circulation', 'daily', true, 'Sistem Pelaporan Otomatis'));
  return db;
}

export function recalculateOverdueLoans(db: LibraryDatabase): boolean {
  const nowMs = Date.now();
  let changed = false;
  for (const loan of db.loans) {
    if (loan.status === 'returned') continue;
    const dueMs = new Date(loan.dueDate).getTime();
    if (nowMs > dueMs) {
      const lateDays = Math.max(1, Math.ceil((nowMs - dueMs) / (1000 * 60 * 60 * 24)));
      const fine = lateDays * FINE_PER_DAY_IDR;
      if (loan.status !== 'overdue' || loan.fineAmount !== fine) {
        loan.status = 'overdue';
        loan.fineAmount = fine;
        changed = true;
      }
    }
  }
  return changed;
}

export function buildReportSnapshot(
  db: LibraryDatabase,
  reportType: 'circulation' | 'overdue' | 'inventory',
  frequency: 'daily' | 'weekly' | 'monthly' | 'manual',
  autoGenerated: boolean,
  generatedBy: string
): GeneratedReport {
  recalculateOverdueLoans(db);
  const now = new Date();
  const totalCopies = db.books.reduce((sum, b) => sum + b.totalCopies, 0);
  const availableCopies = db.books.reduce((sum, b) => sum + b.availableCopies, 0);
  const activeLoansList = db.loans.filter((l) => l.status === 'active' || l.status === 'overdue');
  const overdueList = db.loans.filter((l) => l.status === 'overdue');
  const returnedList = db.loans.filter((l) => l.status === 'returned');
  const totalFines = db.loans.reduce((sum, l) => sum + (l.fineAmount || 0), 0);

  const periodDays = frequency === 'daily' ? 1 : frequency === 'weekly' ? 7 : 30;
  const cutoff = Date.now() - periodDays * 24 * 60 * 60 * 1000;
  const loansInPeriod =
    frequency === 'manual' ? db.loans : db.loans.filter((l) => new Date(l.borrowedAt).getTime() >= cutoff);

  const topBooks = [...db.books]
    .sort((a, b) => b.borrowCount - a.borrowCount)
    .slice(0, 5)
    .map((b) => ({
      bookId: b.id,
      title: b.title,
      author: b.author,
      borrowCount: b.borrowCount,
    }));

  const overdueLoans = overdueList.map((l) => {
    const lateDays = Math.max(1, Math.ceil((Date.now() - new Date(l.dueDate).getTime()) / (1000 * 60 * 60 * 24)));
    return {
      code: l.code,
      bookTitle: l.bookTitle,
      memberName: l.userName,
      dueDate: l.dueDate,
      lateDays,
      fineAmount: l.fineAmount,
    };
  });

  const catMap = new Map<string, { titlesCount: number; loansCount: number }>();
  for (const book of db.books) {
    const prev = catMap.get(book.category) || { titlesCount: 0, loansCount: 0 };
    catMap.set(book.category, {
      titlesCount: prev.titlesCount + 1,
      loansCount: prev.loansCount + book.borrowCount,
    });
  }

  const typeTitle =
    reportType === 'circulation'
      ? 'Laporan Sirkulasi Peminjaman'
      : reportType === 'overdue'
        ? 'Laporan Keterlambatan & Denda'
        : 'Laporan Inventaris Koleksi';

  const dateTag = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = crypto.randomBytes(2).toString('hex').toUpperCase();

  return {
    id: `rep-${Date.now()}-${rand}`,
    code: `RPT-${dateTag}-${rand}`,
    title: typeTitle,
    periodLabel:
      frequency === 'daily'
        ? 'Harian (24 Jam Terakhir)'
        : frequency === 'weekly'
          ? 'Mingguan (7 Hari Terakhir)'
          : frequency === 'monthly'
            ? 'Bulanan (30 Hari Terakhir)'
            : 'Snapshot Keseluruhan',
    frequency,
    reportType,
    autoGenerated,
    generatedAt: now.toISOString(),
    generatedBy,
    summary: {
      totalBooks: db.books.length,
      totalCopies,
      availableCopies,
      totalLoansInPeriod: loansInPeriod.length,
      activeLoans: activeLoansList.length,
      returnedInPeriod: returnedList.length,
      overdueCount: overdueList.length,
      totalFines,
    },
    topBooks,
    overdueLoans,
    categoryBreakdown: Array.from(catMap.entries()).map(([category, vals]) => ({
      category,
      titlesCount: vals.titlesCount,
      loansCount: vals.loansCount,
    })),
  };
}

export function computeSummaryStats(db: LibraryDatabase): LibrarySummaryStats {
  recalculateOverdueLoans(db);
  const totalTitles = db.books.length;
  const totalCopies = db.books.reduce((s, b) => s + b.totalCopies, 0);
  const availableCopies = db.books.reduce((s, b) => s + b.availableCopies, 0);
  const activeLoans = db.loans.filter((l) => l.status === 'active' || l.status === 'overdue').length;
  const overdueLoans = db.loans.filter((l) => l.status === 'overdue').length;
  const todayStr = new Date().toISOString().slice(0, 10);
  const totalTransactionsToday = db.loans.filter(
    (l) => l.borrowedAt.slice(0, 10) === todayStr || (l.returnedAt && l.returnedAt.slice(0, 10) === todayStr)
  ).length;
  const totalMembers = db.users.filter((u) => u.role === 'member').length;
  const waitingReservations = db.reservations.filter((r) => r.status === 'waiting').length;

  const dailyTrend: { dateLabel: string; borrowed: number; returned: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
    const borrowed = db.loans.filter((l) => l.borrowedAt.slice(0, 10) === key).length;
    const returned = db.loans.filter((l) => l.returnedAt && l.returnedAt.slice(0, 10) === key).length;
    dailyTrend.push({ dateLabel: label, borrowed, returned });
  }

  const catMap = new Map<string, { titlesCount: number; loansCount: number }>();
  for (const book of db.books) {
    const prev = catMap.get(book.category) || { titlesCount: 0, loansCount: 0 };
    catMap.set(book.category, {
      titlesCount: prev.titlesCount + 1,
      loansCount: prev.loansCount + book.borrowCount,
    });
  }

  return {
    totalTitles,
    totalCopies,
    availableCopies,
    activeLoans,
    overdueLoans,
    totalTransactionsToday,
    totalMembers,
    waitingReservations,
    dailyTrend,
    categoryStats: Array.from(catMap.entries())
      .map(([category, vals]) => ({
        category,
        titlesCount: vals.titlesCount,
        loansCount: vals.loansCount,
      }))
      .sort((a, b) => b.loansCount - a.loansCount),
  };
}

let cachedDb: LibraryDatabase | null = null;

export function getDatabase(): LibraryDatabase {
  if (cachedDb) return cachedDb;
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (fs.existsSync(DB_PATH)) {
    try {
      const raw = fs.readFileSync(DB_PATH, 'utf-8');
      cachedDb = JSON.parse(raw) as LibraryDatabase;
      recalculateOverdueLoans(cachedDb);
      return cachedDb;
    } catch {
      cachedDb = createInitialData();
      saveDatabase(cachedDb);
      return cachedDb;
    }
  }
  cachedDb = createInitialData();
  saveDatabase(cachedDb);
  return cachedDb;
}

export function saveDatabase(db: LibraryDatabase): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const tmpPath = path.resolve(DATA_DIR, `library-db.${process.pid}.tmp`);
  fs.writeFileSync(tmpPath, JSON.stringify(db, null, 2), 'utf-8');
  fs.renameSync(tmpPath, DB_PATH);
  cachedDb = db;
}
