import crypto from 'crypto';
import dotenv from 'dotenv';
import express, { NextFunction, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import {
  buildReportSnapshot,
  computeSummaryStats,
  FINE_PER_DAY_IDR,
  getDatabase,
  hashPassword,
  recalculateOverdueLoans,
  saveDatabase,
  verifyPassword,
} from './server/store.ts';
import type {
  ActivityEvent,
  Book,
  BookRequest,
  BookReview,
  LibraryNotification,
  LoanTransaction,
  Reservation,
  UserProfile,
  UserRole,
} from './src/types/library.ts';

dotenv.config();

const PORT = 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const TOKEN_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours

interface TokenPayload {
  sub: string;
  role: UserRole;
  name: string;
  email: string;
  memberCode: string;
  exp: number;
}

interface AuthedRequest extends Request {
  authUser?: TokenPayload;
}

function signToken(payload: Omit<TokenPayload, 'exp'>): string {
  const full: TokenPayload = { ...payload, exp: Date.now() + TOKEN_TTL_MS };
  const body = Buffer.from(JSON.stringify(full)).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verifyToken(token: string): TokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf-8')) as TokenPayload;
    if (!parsed.sub || !parsed.role || parsed.exp < Date.now()) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function extractBearer(req: Request): TokenPayload | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return verifyToken(authHeader.slice(7).trim());
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const payload = extractBearer(req);
  if (!payload) {
    res.status(401).json({ error: 'Sesi tidak valid atau telah kedaluwarsa. Silakan masuk terlebih dahulu.' });
    return;
  }
  req.authUser = payload;
  next();
}

function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction): void {
  const payload = extractBearer(req);
  if (!payload) {
    res.status(401).json({ error: 'Autentikasi admin diperlukan.' });
    return;
  }
  if (payload.role !== 'admin') {
    res.status(403).json({ error: 'Akses ditolak. Hanya pustakawan (Admin) yang dapat melakukan tindakan ini.' });
    return;
  }
  req.authUser = payload;
  next();
}

function isNonEmptyString(val: unknown, maxLen = 200): val is string {
  return typeof val === 'string' && val.trim().length > 0 && val.trim().length <= maxLen;
}

function safeInt(val: unknown, min: number, max: number): number | null {
  if (typeof val !== 'number' || !Number.isInteger(val)) return null;
  if (val < min || val > max) return null;
  return val;
}

// SSE Client Registry
const sseClients = new Set<Response>();

function broadcastEvent(eventName: string, data: unknown): void {
  const serialized = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(serialized);
    } catch {
      sseClients.delete(client);
    }
  }
}

function pushActivity(
  type: ActivityEvent['type'],
  title: string,
  detail: string,
  actorLabel: string
): ActivityEvent {
  const db = getDatabase();
  const event: ActivityEvent = {
    id: `act-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
    type,
    title,
    detail,
    actorLabel,
    timestamp: new Date().toISOString(),
  };
  db.activities.unshift(event);
  if (db.activities.length > 60) {
    db.activities.length = 60;
  }
  return event;
}

function runAutomatedSchedules(): void {
  const db = getDatabase();
  let mutated = recalculateOverdueLoans(db);
  const now = new Date();

  for (const schedule of db.reportSchedules) {
    if (!schedule.enabled) continue;
    const nextRun = new Date(schedule.nextRunAt);
    if (now >= nextRun) {
      const report = buildReportSnapshot(
        db,
        schedule.reportType,
        schedule.frequency,
        true,
        `Otomatis (${schedule.name})`
      );
      db.reports.unshift(report);
      if (db.reports.length > 40) {
        db.reports.length = 40;
      }
      schedule.lastRunAt = now.toISOString();
      const next = new Date(now);
      if (schedule.frequency === 'daily') {
        next.setDate(next.getDate() + 1);
      } else if (schedule.frequency === 'weekly') {
        next.setDate(next.getDate() + 7);
      } else {
        next.setMonth(next.getMonth() + 1);
      }
      next.setHours(schedule.runHour, 0, 0, 0);
      schedule.nextRunAt = next.toISOString();

      const activity = pushActivity(
        'report',
        'Laporan Otomatis Dibuat',
        `${report.title} (${report.code})`,
        'Sistem Pelaporan Otomatis'
      );
      mutated = true;
      broadcastEvent('report:generated', { report, activity, stats: computeSummaryStats(db) });
    }
  }

  if (mutated) {
    saveDatabase(db);
  }
}

async function startServer(): Promise<void> {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // Initialize DB & run initial schedule check
  getDatabase();
  runAutomatedSchedules();
  const scheduleTimer = setInterval(runAutomatedSchedules, 60 * 1000);
  scheduleTimer.unref();

  // Real-time SSE stream
  app.get('/api/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const db = getDatabase();
    res.write(
      `event: connected\ndata: ${JSON.stringify({
        serverTime: new Date().toISOString(),
        stats: computeSummaryStats(db),
        activities: db.activities.slice(0, 15),
      })}\n\n`
    );

    sseClients.add(res);

    const keepAlive = setInterval(() => {
      try {
        res.write(': ping\n\n');
      } catch {
        clearInterval(keepAlive);
        sseClients.delete(res);
      }
    }, 25000);

    req.on('close', () => {
      clearInterval(keepAlive);
      sseClients.delete(res);
    });
  });

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', library: "wonu's library", timestamp: new Date().toISOString() });
  });

  // Auth status (check if env passcode is set or first-run admin has been claimed)
  app.get('/api/auth/status', (_req, res) => {
    const db = getDatabase();
    const envPasscodeSet = Boolean(process.env.ADMIN_PASSCODE && process.env.ADMIN_PASSCODE.trim().length > 0);
    res.json({
      envPasscodeSet,
      adminClaimed: db.adminAuth.claimed,
      needsFirstRunAdminClaim: !envPasscodeSet && !db.adminAuth.claimed,
    });
  });

  // One-time first-run admin claim when ADMIN_PASSCODE env is unset
  app.post('/api/auth/admin-claim', (req, res) => {
    const envPasscode = process.env.ADMIN_PASSCODE?.trim();
    if (envPasscode) {
      res.status(403).json({
        error: 'Passcode admin telah dikonfigurasi di server. Gunakan passcode tersebut untuk masuk.',
      });
      return;
    }
    const db = getDatabase();
    if (db.adminAuth.claimed) {
      res.status(409).json({
        error: 'Akun admin awal sudah diklaim sebelumnya. Silakan masuk dengan kata sandi admin Anda.',
      });
      return;
    }

    const { password } = req.body as { password?: unknown };
    if (typeof password !== 'string' || password.length < 6 || password.length > 128) {
      res.status(400).json({ error: 'Kata sandi admin minimal 6 karakter dan maksimal 128 karakter.' });
      return;
    }

    const { hash, salt } = hashPassword(password);
    db.adminAuth = {
      claimed: true,
      passwordHash: hash,
      passwordSalt: salt,
      claimedAt: new Date().toISOString(),
    };
    saveDatabase(db);

    const adminProfile: UserProfile = {
      id: 'usr-admin-primary',
      name: 'Pustakawan Utama',
      email: 'admin@wonulibrary.id',
      role: 'admin',
      memberCode: 'WONU-ADM-001',
      joinedAt: db.adminAuth.claimedAt!,
      maxLoans: 10,
    };

    const token = signToken({
      sub: adminProfile.id,
      role: 'admin',
      name: adminProfile.name,
      email: adminProfile.email,
      memberCode: adminProfile.memberCode,
    });

    res.status(201).json({ token, user: adminProfile });
  });

  // Member registration
  app.post('/api/auth/register', (req, res) => {
    const { name, email, password } = req.body as {
      name?: unknown;
      email?: unknown;
      password?: unknown;
    };

    if (!isNonEmptyString(name, 80)) {
      res.status(400).json({ error: 'Nama lengkap wajib diisi (maksimal 80 karakter).' });
      return;
    }
    if (!isNonEmptyString(email, 120) || !email.includes('@')) {
      res.status(400).json({ error: 'Format alamat email tidak valid.' });
      return;
    }
    if (typeof password !== 'string' || password.length < 6 || password.length > 128) {
      res.status(400).json({ error: 'Kata sandi minimal 6 karakter.' });
      return;
    }

    const db = getDatabase();
    const normalizedEmail = email.trim().toLowerCase();
    const exists = db.users.some((u) => u.email.toLowerCase() === normalizedEmail);
    if (exists) {
      res.status(409).json({ error: 'Email tersebut sudah terdaftar sebagai anggota.' });
      return;
    }

    const { hash, salt } = hashPassword(password);
    const nextNum = 1001 + db.users.length;
    const newUser = {
      id: `usr-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      name: name.trim(),
      email: normalizedEmail,
      role: 'member' as const,
      memberCode: `WONU-MBR-${nextNum}`,
      joinedAt: new Date().toISOString(),
      maxLoans: 5,
      passwordHash: hash,
      passwordSalt: salt,
    };

    db.users.push(newUser);
    db.wishlists[newUser.id] = [];
    db.notifications.unshift({
      id: `notif-${Date.now()}`,
      userId: newUser.id,
      title: "Selamat Datang di wonu's library",
      message: `Kartu anggota digital Anda (${newUser.memberCode}) telah aktif dengan kuota pinjam hingga ${newUser.maxLoans} buku.`,
      type: 'success',
      read: false,
      createdAt: new Date().toISOString(),
    });
    saveDatabase(db);

    const { passwordHash: _ph, passwordSalt: _ps, ...publicProfile } = newUser;
    const token = signToken({
      sub: newUser.id,
      role: 'member',
      name: newUser.name,
      email: newUser.email,
      memberCode: newUser.memberCode,
    });

    broadcastEvent('stats:updated', { stats: computeSummaryStats(db) });
    res.status(201).json({ token, user: publicProfile });
  });

  // Login (Member or Admin)
  app.post('/api/auth/login', (req, res) => {
    const { mode, email, password } = req.body as {
      mode?: unknown;
      email?: unknown;
      password?: unknown;
    };

    if (mode === 'admin') {
      if (typeof password !== 'string' || password.length === 0) {
        res.status(400).json({ error: 'Kata sandi admin wajib diisi.' });
        return;
      }

      const envPasscode = process.env.ADMIN_PASSCODE?.trim();
      const db = getDatabase();
      let valid = false;

      if (envPasscode) {
        const a = Buffer.from(password);
        const b = Buffer.from(envPasscode);
        valid = a.length === b.length && crypto.timingSafeEqual(a, b);
      } else if (db.adminAuth.claimed && db.adminAuth.passwordHash && db.adminAuth.passwordSalt) {
        valid = verifyPassword(password, db.adminAuth.passwordSalt, db.adminAuth.passwordHash);
      } else {
        res.status(400).json({
          error: 'Akun admin belum diklaim. Silakan buat kata sandi admin awal terlebih dahulu.',
        });
        return;
      }

      if (!valid) {
        res.status(401).json({ error: 'Kata sandi pustakawan (Admin) tidak sesuai.' });
        return;
      }

      const adminProfile: UserProfile = {
        id: 'usr-admin-primary',
        name: 'Pustakawan Utama',
        email: 'admin@wonulibrary.id',
        role: 'admin',
        memberCode: 'WONU-ADM-001',
        joinedAt: db.adminAuth.claimedAt || new Date().toISOString(),
        maxLoans: 10,
      };
      const token = signToken({
        sub: adminProfile.id,
        role: 'admin',
        name: adminProfile.name,
        email: adminProfile.email,
        memberCode: adminProfile.memberCode,
      });
      res.json({ token, user: adminProfile });
      return;
    }

    // Member login
    if (!isNonEmptyString(email, 120) || typeof password !== 'string' || password.length === 0) {
      res.status(400).json({ error: 'Email dan kata sandi wajib diisi.' });
      return;
    }

    const db = getDatabase();
    const normalizedEmail = email.trim().toLowerCase();
    const user = db.users.find((u) => u.email.toLowerCase() === normalizedEmail);
    if (!user || !user.passwordHash || !user.passwordSalt) {
      res.status(401).json({ error: 'Email atau kata sandi tidak ditemukan.' });
      return;
    }

    if (!verifyPassword(password, user.passwordSalt, user.passwordHash)) {
      res.status(401).json({ error: 'Email atau kata sandi tidak sesuai.' });
      return;
    }

    const { passwordHash: _ph, passwordSalt: _ps, ...publicProfile } = user;
    const token = signToken({
      sub: user.id,
      role: user.role,
      name: user.name,
      email: user.email,
      memberCode: user.memberCode,
    });
    res.json({ token, user: publicProfile });
  });

  app.get('/api/auth/me', requireAuth, (req: AuthedRequest, res) => {
    const authUser = req.authUser!;
    if (authUser.role === 'admin') {
      res.json({
        user: {
          id: authUser.sub,
          name: authUser.name,
          email: authUser.email,
          role: 'admin',
          memberCode: authUser.memberCode,
          joinedAt: new Date().toISOString(),
          maxLoans: 10,
        },
      });
      return;
    }
    const db = getDatabase();
    const found = db.users.find((u) => u.id === authUser.sub);
    if (!found) {
      res.status(404).json({ error: 'Profil anggota tidak ditemukan.' });
      return;
    }
    const { passwordHash: _ph, passwordSalt: _ps, ...publicProfile } = found;
    res.json({ user: publicProfile });
  });

  // Public Catalog & Library Overview
  app.get('/api/catalog', (_req, res) => {
    const db = getDatabase();
    res.json({
      books: db.books,
      stats: computeSummaryStats(db),
      recentActivities: db.activities.slice(0, 12),
      communityRequests: db.requests.slice(0, 10).map((r) => ({
        id: r.id,
        title: r.title,
        author: r.author,
        category: r.category,
        reason: r.reason,
        requestedByName: r.requestedByName,
        status: r.status,
        adminNote: r.adminNote,
        createdAt: r.createdAt,
      })),
    });
  });

  app.get('/api/books/:id', (req, res) => {
    const db = getDatabase();
    const book = db.books.find((b) => b.id === req.params.id);
    if (!book) {
      res.status(404).json({ error: 'Buku tidak ditemukan dalam katalog.' });
      return;
    }
    const reviews = db.reviews.filter((r) => r.bookId === book.id);
    const waitingCount = db.reservations.filter((r) => r.bookId === book.id && r.status === 'waiting').length;
    res.json({ book, reviews, waitingCount });
  });

  // Borrow a book
  app.post('/api/loans', requireAuth, (req: AuthedRequest, res) => {
    const authUser = req.authUser!;
    const { bookId, durationDays } = req.body as { bookId?: unknown; durationDays?: unknown };
    if (!isNonEmptyString(bookId, 100)) {
      res.status(400).json({ error: 'ID buku tidak valid.' });
      return;
    }
    const days = durationDays === 14 ? 14 : 7;

    const db = getDatabase();
    const book = db.books.find((b) => b.id === bookId);
    if (!book) {
      res.status(404).json({ error: 'Buku tidak ditemukan.' });
      return;
    }
    if (book.availableCopies <= 0) {
      res.status(409).json({ error: 'Stok buku sedang habis. Anda dapat masuk ke antrean reservasi.' });
      return;
    }

    const userActiveLoans = db.loans.filter(
      (l) => l.userId === authUser.sub && (l.status === 'active' || l.status === 'overdue')
    );
    const maxLoans = authUser.role === 'admin' ? 10 : 5;
    if (userActiveLoans.length >= maxLoans) {
      res.status(409).json({
        error: `Kuota peminjaman aktif Anda telah mencapai batas maksimal (${maxLoans} buku).`,
      });
      return;
    }

    const alreadyBorrowingThis = userActiveLoans.some((l) => l.bookId === book.id);
    if (alreadyBorrowingThis) {
      res.status(409).json({ error: 'Anda sedang meminjam judul buku ini.' });
      return;
    }

    const now = new Date();
    const due = new Date(now);
    due.setDate(due.getDate() + days);
    due.setHours(17, 0, 0, 0);

    const dateTag = now.toISOString().slice(0, 10).replace(/-/g, '');
    const seq = String(db.loans.length + 101).padStart(4, '0');
    const code = `TRX-${dateTag}-${seq}`;

    const loan: LoanTransaction = {
      id: `loan-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
      code,
      bookId: book.id,
      bookTitle: book.title,
      bookCallNumber: book.callNumber,
      userId: authUser.sub,
      userName: authUser.name,
      memberCode: authUser.memberCode,
      borrowedAt: now.toISOString(),
      dueDate: due.toISOString(),
      returnedAt: null,
      status: 'active',
      renewedCount: 0,
      fineAmount: 0,
      reminderSentAt: null,
    };

    book.availableCopies -= 1;
    book.borrowCount += 1;
    book.updatedAt = now.toISOString();
    db.loans.unshift(loan);

    // Fulfill any waiting reservation held by this same user
    const existingRes = db.reservations.find(
      (r) => r.bookId === book.id && r.userId === authUser.sub && r.status === 'waiting'
    );
    if (existingRes) {
      existingRes.status = 'fulfilled';
    }

    const activity = pushActivity(
      'borrow',
      'Peminjaman Buku Baru',
      `${book.title} (${loan.code})`,
      `${authUser.name} · ${authUser.memberCode}`
    );

    saveDatabase(db);

    const payload = {
      loan,
      book,
      activity,
      stats: computeSummaryStats(db),
    };
    broadcastEvent('loan:created', payload);
    res.status(201).json(payload);
  });

  // Return a book
  app.post('/api/loans/:id/return', requireAuth, (req: AuthedRequest, res) => {
    const authUser = req.authUser!;
    const db = getDatabase();
    const loan = db.loans.find((l) => l.id === req.params.id);
    if (!loan) {
      res.status(404).json({ error: 'Transaksi peminjaman tidak ditemukan.' });
      return;
    }
    if (authUser.role !== 'admin' && loan.userId !== authUser.sub) {
      res.status(403).json({ error: 'Anda tidak memiliki izin mengembalikan transaksi ini.' });
      return;
    }
    if (loan.status === 'returned') {
      res.status(409).json({ error: 'Buku ini sudah dikembalikan sebelumnya.' });
      return;
    }

    recalculateOverdueLoans(db);
    const now = new Date();
    loan.returnedAt = now.toISOString();
    loan.status = 'returned';

    const book = db.books.find((b) => b.id === loan.bookId);
    let promotedMemberName: string | null = null;

    if (book) {
      book.availableCopies = Math.min(book.totalCopies, book.availableCopies + 1);
      book.updatedAt = now.toISOString();

      // Check waiting reservation queue
      const nextInQueue = db.reservations.find((r) => r.bookId === book.id && r.status === 'waiting');
      if (nextInQueue) {
        nextInQueue.status = 'fulfilled';
        promotedMemberName = nextInQueue.userName;
        db.notifications.unshift({
          id: `notif-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
          userId: nextInQueue.userId,
          title: 'Buku Reservasi Tersedia',
          message: `Buku "${book.title}" telah dikembalikan dan kini tersedia untuk Anda pinjam.`,
          type: 'success',
          read: false,
          createdAt: now.toISOString(),
        });
      }
    }

    const activity = pushActivity(
      'return',
      loan.fineAmount > 0 ? 'Pengembalian (Dengan Denda)' : 'Pengembalian Buku',
      `${loan.bookTitle} (${loan.code})${promotedMemberName ? ` · Antrean diproses untuk ${promotedMemberName}` : ''}`,
      `${loan.userName} · ${loan.memberCode}`
    );

    saveDatabase(db);
    const payload = {
      loan,
      book,
      activity,
      stats: computeSummaryStats(db),
    };
    broadcastEvent('loan:returned', payload);
    res.json(payload);
  });

  // Renew a loan (+7 days)
  app.post('/api/loans/:id/renew', requireAuth, (req: AuthedRequest, res) => {
    const authUser = req.authUser!;
    const db = getDatabase();
    const loan = db.loans.find((l) => l.id === req.params.id);
    if (!loan) {
      res.status(404).json({ error: 'Transaksi tidak ditemukan.' });
      return;
    }
    if (authUser.role !== 'admin' && loan.userId !== authUser.sub) {
      res.status(403).json({ error: 'Akses ditolak.' });
      return;
    }
    if (loan.status === 'returned') {
      res.status(409).json({ error: 'Transaksi sudah selesai.' });
      return;
    }
    if (loan.status === 'overdue') {
      res.status(409).json({ error: 'Buku yang sudah melewati jatuh tempo tidak dapat diperpanjang. Harap kembalikan terlebih dahulu.' });
      return;
    }
    if (loan.renewedCount >= 1) {
      res.status(409).json({ error: 'Perpanjangan hanya dapat dilakukan maksimal 1 kali per transaksi.' });
      return;
    }

    const hasQueue = db.reservations.some((r) => r.bookId === loan.bookId && r.status === 'waiting');
    if (hasQueue) {
      res.status(409).json({ error: 'Buku ini sedang ditunggu oleh anggota lain dalam antrean reservasi.' });
      return;
    }

    const nextDue = new Date(loan.dueDate);
    nextDue.setDate(nextDue.getDate() + 7);
    loan.dueDate = nextDue.toISOString();
    loan.renewedCount += 1;

    const activity = pushActivity(
      'renew',
      'Perpanjangan Masa Pinjam (+7 Hari)',
      `${loan.bookTitle} (${loan.code})`,
      `${loan.userName} · ${loan.memberCode}`
    );

    saveDatabase(db);
    const payload = { loan, activity, stats: computeSummaryStats(db) };
    broadcastEvent('loan:renewed', payload);
    res.json(payload);
  });

  // Reserve a book when out of stock
  app.post('/api/reservations', requireAuth, (req: AuthedRequest, res) => {
    const authUser = req.authUser!;
    const { bookId } = req.body as { bookId?: unknown };
    if (!isNonEmptyString(bookId, 100)) {
      res.status(400).json({ error: 'ID buku tidak valid.' });
      return;
    }

    const db = getDatabase();
    const book = db.books.find((b) => b.id === bookId);
    if (!book) {
      res.status(404).json({ error: 'Buku tidak ditemukan.' });
      return;
    }
    if (book.availableCopies > 0) {
      res.status(409).json({ error: 'Buku masih tersedia, Anda dapat langsung meminjamnya.' });
      return;
    }
    const alreadyQueued = db.reservations.some(
      (r) => r.bookId === book.id && r.userId === authUser.sub && r.status === 'waiting'
    );
    if (alreadyQueued) {
      res.status(409).json({ error: 'Anda sudah berada dalam antrean reservasi untuk buku ini.' });
      return;
    }

    const reservation: Reservation = {
      id: `res-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
      bookId: book.id,
      bookTitle: book.title,
      userId: authUser.sub,
      userName: authUser.name,
      memberCode: authUser.memberCode,
      createdAt: new Date().toISOString(),
      status: 'waiting',
    };

    db.reservations.push(reservation);
    const activity = pushActivity(
      'reserve',
      'Masuk Antrean Reservasi',
      book.title,
      `${authUser.name} · ${authUser.memberCode}`
    );

    saveDatabase(db);
    const payload = { reservation, activity, stats: computeSummaryStats(db) };
    broadcastEvent('reservation:created', payload);
    res.status(201).json(payload);
  });

  app.delete('/api/reservations/:id', requireAuth, (req: AuthedRequest, res) => {
    const authUser = req.authUser!;
    const db = getDatabase();
    const reservation = db.reservations.find((r) => r.id === req.params.id);
    if (!reservation) {
      res.status(404).json({ error: 'Reservasi tidak ditemukan.' });
      return;
    }
    if (authUser.role !== 'admin' && reservation.userId !== authUser.sub) {
      res.status(403).json({ error: 'Akses ditolak.' });
      return;
    }
    reservation.status = 'cancelled';
    saveDatabase(db);
    broadcastEvent('stats:updated', { stats: computeSummaryStats(db) });
    res.json({ reservation });
  });

  // Toggle Wishlist / Reading List
  app.post('/api/wishlist/:bookId', requireAuth, (req: AuthedRequest, res) => {
    const authUser = req.authUser!;
    const db = getDatabase();
    const book = db.books.find((b) => b.id === req.params.bookId);
    if (!book) {
      res.status(404).json({ error: 'Buku tidak ditemukan.' });
      return;
    }

    const current = db.wishlists[authUser.sub] || [];
    const exists = current.includes(book.id);
    const updated = exists ? current.filter((id) => id !== book.id) : [...current, book.id];
    db.wishlists[authUser.sub] = updated;
    saveDatabase(db);
    res.json({ wishlist: updated, saved: !exists });
  });

  // Submit review
  app.post('/api/books/:id/reviews', requireAuth, (req: AuthedRequest, res) => {
    const authUser = req.authUser!;
    const { rating, comment } = req.body as { rating?: unknown; comment?: unknown };
    const safeRating = safeInt(rating, 1, 5);
    if (!safeRating) {
      res.status(400).json({ error: 'Rating harus berupa angka bulat 1 hingga 5.' });
      return;
    }
    if (!isNonEmptyString(comment, 500)) {
      res.status(400).json({ error: 'Ulasan wajib diisi (maksimal 500 karakter).' });
      return;
    }

    const db = getDatabase();
    const book = db.books.find((b) => b.id === req.params.id);
    if (!book) {
      res.status(404).json({ error: 'Buku tidak ditemukan.' });
      return;
    }

    const review: BookReview = {
      id: `rev-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
      bookId: book.id,
      userId: authUser.sub,
      userName: authUser.name,
      rating: safeRating,
      comment: comment.trim(),
      createdAt: new Date().toISOString(),
    };

    db.reviews.unshift(review);
    const bookReviews = db.reviews.filter((r) => r.bookId === book.id);
    const sum = bookReviews.reduce((acc, r) => acc + r.rating, 0);
    book.ratingCount = bookReviews.length;
    book.ratingAvg = Number((sum / bookReviews.length).toFixed(1));
    book.updatedAt = new Date().toISOString();
    saveDatabase(db);

    res.status(201).json({ review, book });
  });

  // Book acquisition request
  app.post('/api/requests', requireAuth, (req: AuthedRequest, res) => {
    const authUser = req.authUser!;
    const { title, author, category, reason } = req.body as {
      title?: unknown;
      author?: unknown;
      category?: unknown;
      reason?: unknown;
    };

    if (!isNonEmptyString(title, 150) || !isNonEmptyString(author, 100) || !isNonEmptyString(category, 60)) {
      res.status(400).json({ error: 'Judul buku, penulis, dan kategori wajib diisi.' });
      return;
    }
    if (!isNonEmptyString(reason, 400)) {
      res.status(400).json({ error: 'Alasan usulan pengadaan wajib diisi.' });
      return;
    }

    const db = getDatabase();
    const now = new Date().toISOString();
    const newReq: BookRequest = {
      id: `req-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
      title: title.trim(),
      author: author.trim(),
      category: category.trim(),
      reason: reason.trim(),
      requestedByUserId: authUser.sub,
      requestedByName: authUser.name,
      status: 'pending',
      adminNote: null,
      createdAt: now,
      updatedAt: now,
    };

    db.requests.unshift(newReq);
    const activity = pushActivity(
      'request',
      'Usulan Pengadaan Buku Baru',
      `${newReq.title} — ${newReq.author}`,
      `${authUser.name} · ${authUser.memberCode}`
    );
    saveDatabase(db);
    broadcastEvent('request:updated', { request: newReq, activity });
    res.status(201).json({ request: newReq });
  });

  // Member Dashboard
  app.get('/api/member/dashboard', requireAuth, (req: AuthedRequest, res) => {
    const authUser = req.authUser!;
    const db = getDatabase();
    recalculateOverdueLoans(db);

    const myLoans = db.loans.filter((l) => l.userId === authUser.sub);
    const myReservations = db.reservations.filter((r) => r.userId === authUser.sub && r.status === 'waiting');
    const wishlistIds = db.wishlists[authUser.sub] || [];
    const wishlistBooks = db.books.filter((b) => wishlistIds.includes(b.id));
    const notifications = db.notifications.filter((n) => n.userId === authUser.sub).slice(0, 20);
    const myRequests = db.requests.filter((r) => r.requestedByUserId === authUser.sub);

    const catCount = new Map<string, number>();
    for (const loan of myLoans) {
      const book = db.books.find((b) => b.id === loan.bookId);
      const cat = book?.category || 'Lainnya';
      catCount.set(cat, (catCount.get(cat) || 0) + 1);
    }

    const totalFines = myLoans.reduce((sum, l) => sum + (l.fineAmount || 0), 0);

    res.json({
      loans: myLoans,
      reservations: myReservations,
      wishlistIds,
      wishlistBooks,
      notifications,
      requests: myRequests,
      personalStats: {
        activeCount: myLoans.filter((l) => l.status === 'active' || l.status === 'overdue').length,
        overdueCount: myLoans.filter((l) => l.status === 'overdue').length,
        completedCount: myLoans.filter((l) => l.status === 'returned').length,
        totalFines,
        categoryBreakdown: Array.from(catCount.entries()).map(([category, count]) => ({ category, count })),
      },
      recentActivities: db.activities.slice(0, 12),
    });
  });

  app.post('/api/member/notifications/read', requireAuth, (req: AuthedRequest, res) => {
    const authUser = req.authUser!;
    const db = getDatabase();
    let changed = false;
    for (const notif of db.notifications) {
      if (notif.userId === authUser.sub && !notif.read) {
        notif.read = true;
        changed = true;
      }
    }
    if (changed) saveDatabase(db);
    res.json({ ok: true });
  });

  // Admin Dashboard
  app.get('/api/admin/dashboard', requireAdmin, (_req: AuthedRequest, res) => {
    const db = getDatabase();
    recalculateOverdueLoans(db);

    const members = db.users.map((u) => {
      const userLoans = db.loans.filter((l) => l.userId === u.id);
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        memberCode: u.memberCode,
        joinedAt: u.joinedAt,
        maxLoans: u.maxLoans,
        activeLoansCount: userLoans.filter((l) => l.status === 'active' || l.status === 'overdue').length,
        totalBorrowedCount: userLoans.length,
      };
    });

    res.json({
      stats: computeSummaryStats(db),
      loans: db.loans,
      reservations: db.reservations.filter((r) => r.status === 'waiting'),
      members,
      requests: db.requests,
      activities: db.activities,
      reportSchedules: db.reportSchedules,
      reports: db.reports,
    });
  });

  // Admin Collection CRUD
  app.post('/api/books', requireAdmin, (req: AuthedRequest, res) => {
    const body = req.body as Record<string, unknown>;
    if (
      !isNonEmptyString(body.title, 160) ||
      !isNonEmptyString(body.author, 100) ||
      !isNonEmptyString(body.category, 60) ||
      !isNonEmptyString(body.isbn, 32) ||
      !isNonEmptyString(body.callNumber, 40)
    ) {
      res.status(400).json({ error: 'Judul, penulis, kategori, ISBN, dan nomor panggil wajib diisi.' });
      return;
    }

    const totalCopies = safeInt(Number(body.totalCopies), 1, 500);
    const publishYear = safeInt(Number(body.publishYear), 1800, 2100);
    const pages = safeInt(Number(body.pages), 1, 10000);
    if (!totalCopies || !publishYear || !pages) {
      res.status(400).json({ error: 'Jumlah eksemplar, tahun terbit, dan jumlah halaman harus berupa angka valid.' });
      return;
    }

    const allowedTones = ['forest', 'slate', 'amber', 'indigo', 'crimson'] as const;
    const tone = allowedTones.includes(body.accentTone as (typeof allowedTones)[number])
      ? (body.accentTone as Book['accentTone'])
      : 'forest';

    const db = getDatabase();
    const now = new Date().toISOString();
    const newBook: Book = {
      id: `book-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
      title: (body.title as string).trim(),
      author: (body.author as string).trim(),
      category: (body.category as string).trim(),
      isbn: (body.isbn as string).trim(),
      callNumber: (body.callNumber as string).trim(),
      publisher: isNonEmptyString(body.publisher, 100) ? body.publisher.trim() : "Pustaka wonu's library",
      publishYear,
      pages,
      rackLocation: isNonEmptyString(body.rackLocation, 40) ? body.rackLocation.trim() : 'Rak A-01',
      language: isNonEmptyString(body.language, 40) ? body.language.trim() : 'Indonesia',
      synopsis: isNonEmptyString(body.synopsis, 1200)
        ? body.synopsis.trim()
        : 'Koleksi terbaru dalam arsip perpustakaan digital.',
      coverUrl: null,
      accentTone: tone,
      totalCopies,
      availableCopies: totalCopies,
      borrowCount: 0,
      ratingAvg: 0,
      ratingCount: 0,
      hasDigitalEdition: Boolean(body.hasDigitalEdition),
      digitalSample: isNonEmptyString(body.digitalSampleText, 4000)
        ? (body.digitalSampleText as string)
            .split('\n\n')
            .map((p) => p.trim())
            .filter(Boolean)
        : [],
      createdAt: now,
      updatedAt: now,
    };

    db.books.unshift(newBook);
    const activity = pushActivity(
      'catalog',
      'Penambahan Koleksi Baru',
      `${newBook.title} (${newBook.totalCopies} eksemplar)`,
      'Pustakawan Utama'
    );
    saveDatabase(db);

    const payload = { book: newBook, activity, stats: computeSummaryStats(db) };
    broadcastEvent('book:created', payload);
    res.status(201).json(payload);
  });

  app.patch('/api/books/:id', requireAdmin, (req: AuthedRequest, res) => {
    const db = getDatabase();
    const book = db.books.find((b) => b.id === req.params.id);
    if (!book) {
      res.status(404).json({ error: 'Buku tidak ditemukan.' });
      return;
    }

    const body = req.body as Record<string, unknown>;
    if (isNonEmptyString(body.title, 160)) book.title = body.title.trim();
    if (isNonEmptyString(body.author, 100)) book.author = body.author.trim();
    if (isNonEmptyString(body.category, 60)) book.category = body.category.trim();
    if (isNonEmptyString(body.isbn, 32)) book.isbn = body.isbn.trim();
    if (isNonEmptyString(body.callNumber, 40)) book.callNumber = body.callNumber.trim();
    if (isNonEmptyString(body.publisher, 100)) book.publisher = body.publisher.trim();
    if (isNonEmptyString(body.rackLocation, 40)) book.rackLocation = body.rackLocation.trim();
    if (isNonEmptyString(body.synopsis, 1200)) book.synopsis = body.synopsis.trim();

    if (body.publishYear !== undefined) {
      const yr = safeInt(Number(body.publishYear), 1800, 2100);
      if (!yr) {
        res.status(400).json({ error: 'Tahun terbit tidak valid.' });
        return;
      }
      book.publishYear = yr;
    }

    if (body.pages !== undefined) {
      const pg = safeInt(Number(body.pages), 1, 10000);
      if (!pg) {
        res.status(400).json({ error: 'Jumlah halaman tidak valid.' });
        return;
      }
      book.pages = pg;
    }

    if (body.totalCopies !== undefined) {
      const nextTotal = safeInt(Number(body.totalCopies), 1, 500);
      if (!nextTotal) {
        res.status(400).json({ error: 'Total eksemplar tidak valid.' });
        return;
      }
      const borrowedOut = book.totalCopies - book.availableCopies;
      if (nextTotal < borrowedOut) {
        res.status(409).json({
          error: `Total eksemplar tidak boleh kurang dari jumlah buku yang sedang dipinjam (${borrowedOut}).`,
        });
        return;
      }
      book.totalCopies = nextTotal;
      book.availableCopies = nextTotal - borrowedOut;
    }

    if (typeof body.hasDigitalEdition === 'boolean') {
      book.hasDigitalEdition = body.hasDigitalEdition;
    }

    book.updatedAt = new Date().toISOString();
    const activity = pushActivity('catalog', 'Pembaruan Data Koleksi', book.title, 'Pustakawan Utama');
    saveDatabase(db);

    const payload = { book, activity, stats: computeSummaryStats(db) };
    broadcastEvent('book:updated', payload);
    res.json(payload);
  });

  app.delete('/api/books/:id', requireAdmin, (req: AuthedRequest, res) => {
    const db = getDatabase();
    const idx = db.books.findIndex((b) => b.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Buku tidak ditemukan.' });
      return;
    }
    const book = db.books[idx];
    const hasActiveLoans = db.loans.some(
      (l) => l.bookId === book.id && (l.status === 'active' || l.status === 'overdue')
    );
    if (hasActiveLoans) {
      res.status(409).json({
        error: 'Buku tidak dapat dihapus karena masih ada eksemplar yang sedang dipinjam anggota.',
      });
      return;
    }

    db.books.splice(idx, 1);
    const activity = pushActivity('catalog', 'Penghapusan Koleksi', book.title, 'Pustakawan Utama');
    saveDatabase(db);
    broadcastEvent('book:deleted', { bookId: book.id, activity, stats: computeSummaryStats(db) });
    res.json({ ok: true, bookId: book.id });
  });

  // Admin: send reminder notification for a loan
  app.post('/api/admin/loans/:id/remind', requireAdmin, (req: AuthedRequest, res) => {
    const db = getDatabase();
    const loan = db.loans.find((l) => l.id === req.params.id);
    if (!loan) {
      res.status(404).json({ error: 'Transaksi tidak ditemukan.' });
      return;
    }
    if (loan.status === 'returned') {
      res.status(409).json({ error: 'Buku ini sudah dikembalikan.' });
      return;
    }

    const now = new Date().toISOString();
    loan.reminderSentAt = now;
    const notif: LibraryNotification = {
      id: `notif-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
      userId: loan.userId,
      title: loan.status === 'overdue' ? 'Pengingat Keterlambatan Pengembalian' : 'Pengingat Jatuh Tempo Peminjaman',
      message:
        loan.status === 'overdue'
          ? `Buku "${loan.bookTitle}" (${loan.code}) telah melewati jatuh tempo. Akumulasi denda saat ini Rp ${loan.fineAmount.toLocaleString('id-ID')}.`
          : `Harap kembalikan "${loan.bookTitle}" (${loan.code}) sebelum ${new Date(loan.dueDate).toLocaleDateString('id-ID')}.`,
      type: 'warning',
      read: false,
      createdAt: now,
    };
    db.notifications.unshift(notif);
    saveDatabase(db);
    res.json({ loan, notification: notif });
  });

  // Admin: update acquisition request status
  app.patch('/api/admin/requests/:id', requireAdmin, (req: AuthedRequest, res) => {
    const { status, adminNote } = req.body as { status?: unknown; adminNote?: unknown };
    if (status !== 'approved' && status !== 'rejected') {
      res.status(400).json({ error: 'Status harus approved atau rejected.' });
      return;
    }
    const db = getDatabase();
    const requestItem = db.requests.find((r) => r.id === req.params.id);
    if (!requestItem) {
      res.status(404).json({ error: 'Usulan pengadaan tidak ditemukan.' });
      return;
    }
    const now = new Date().toISOString();
    requestItem.status = status;
    requestItem.adminNote = isNonEmptyString(adminNote, 300) ? adminNote.trim() : null;
    requestItem.updatedAt = now;

    db.notifications.unshift({
      id: `notif-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
      userId: requestItem.requestedByUserId,
      title: status === 'approved' ? 'Usulan Pengadaan Buku Disetujui' : 'Pembaruan Usulan Pengadaan Buku',
      message:
        status === 'approved'
          ? `Usulan Anda untuk "${requestItem.title}" telah disetujui untuk masuk daftar pengadaan koleksi.`
          : `Usulan Anda untuk "${requestItem.title}" belum dapat disetujui saat ini.`,
      type: status === 'approved' ? 'success' : 'info',
      read: false,
      createdAt: now,
    });

    const activity = pushActivity(
      'request',
      status === 'approved' ? 'Usulan Buku Disetujui' : 'Usulan Buku Ditolak',
      requestItem.title,
      'Pustakawan Utama'
    );
    saveDatabase(db);
    broadcastEvent('request:updated', { request: requestItem, activity });
    res.json({ request: requestItem });
  });

  // Automated Reporting Endpoints
  app.post('/api/reports/generate', requireAdmin, (req: AuthedRequest, res) => {
    const { reportType, frequency } = req.body as {
      reportType?: unknown;
      frequency?: unknown;
    };
    const validType =
      reportType === 'circulation' || reportType === 'overdue' || reportType === 'inventory'
        ? reportType
        : 'circulation';
    const validFreq =
      frequency === 'daily' || frequency === 'weekly' || frequency === 'monthly' || frequency === 'manual'
        ? frequency
        : 'manual';

    const db = getDatabase();
    const report = buildReportSnapshot(db, validType, validFreq, false, req.authUser!.name);
    db.reports.unshift(report);
    if (db.reports.length > 40) db.reports.length = 40;

    const activity = pushActivity(
      'report',
      'Laporan Sirkulasi Dibuat',
      `${report.title} (${report.code})`,
      req.authUser!.name
    );
    saveDatabase(db);

    const payload = { report, activity, stats: computeSummaryStats(db) };
    broadcastEvent('report:generated', payload);
    res.status(201).json(payload);
  });

  app.patch('/api/reports/schedules/:id', requireAdmin, (req: AuthedRequest, res) => {
    const db = getDatabase();
    const schedule = db.reportSchedules.find((s) => s.id === req.params.id);
    if (!schedule) {
      res.status(404).json({ error: 'Jadwal pelaporan tidak ditemukan.' });
      return;
    }

    const { enabled, runHour } = req.body as { enabled?: unknown; runHour?: unknown };
    if (typeof enabled === 'boolean') {
      schedule.enabled = enabled;
    }
    if (runHour !== undefined) {
      const hr = safeInt(Number(runHour), 0, 23);
      if (hr === null) {
        res.status(400).json({ error: 'Jam eksekusi harus antara 0 hingga 23.' });
        return;
      }
      schedule.runHour = hr;
    }
    saveDatabase(db);
    res.json({ schedule });
  });

  // Vite dev middleware or production static assets
  if (process.env.NODE_ENV !== 'production') {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexHtml = path.resolve(distDir, 'index.html');
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send('Build output not found.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`wonu's library server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
