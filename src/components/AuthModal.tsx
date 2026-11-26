import { FormEvent, useEffect, useState } from 'react';
import { Lock, ShieldCheck, UserPlus, X } from 'lucide-react';
import type { UserProfile } from '../types/library';

interface AuthModalProps {
  isOpen: boolean;
  initialMode?: 'member' | 'register' | 'admin';
  onClose: () => void;
  onAuthenticated: (token: string, user: UserProfile) => void;
}

export function AuthModal({ isOpen, initialMode = 'member', onClose, onAuthenticated }: AuthModalProps) {
  const [mode, setMode] = useState<'member' | 'register' | 'admin'>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [needsAdminClaim, setNeedsAdminClaim] = useState(false);
  const [envPasscodeSet, setEnvPasscodeSet] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMode(initialMode);
    setError(null);
  }, [initialMode, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    fetch('/api/auth/status')
      .then((res) => res.json())
      .then((data: { needsFirstRunAdminClaim?: boolean; envPasscodeSet?: boolean }) => {
        setNeedsAdminClaim(Boolean(data.needsFirstRunAdminClaim));
        setEnvPasscodeSet(Boolean(data.envPasscodeSet));
      })
      .catch(() => {});
  }, [isOpen]);

  if (!isOpen) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'register') {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal mendaftar.');
        onAuthenticated(data.token, data.user);
        onClose();
        return;
      }

      if (mode === 'admin') {
        const endpoint = needsAdminClaim ? '/api/auth/admin-claim' : '/api/auth/login';
        const payload = needsAdminClaim
          ? { password: adminPassword }
          : { mode: 'admin', password: adminPassword };
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Autentikasi admin gagal.');
        onAuthenticated(data.token, data.user);
        onClose();
        return;
      }

      // Member login
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'member', email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal masuk.');
      onAuthenticated(data.token, data.user);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-[1px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-dialog-title"
        className="w-full max-w-md bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden"
      >
        <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 id="auth-dialog-title" className="font-serif text-xl font-semibold text-slate-900">
              Akses wonu&apos;s library
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Pilih jenis akun untuk melanjutkan layanan</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
            aria-label="Tutup dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 pt-4">
          <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => {
                setMode('member');
                setError(null);
              }}
              className={`py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                mode === 'member' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Masuk Anggota
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError(null);
              }}
              className={`py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                mode === 'register' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Daftar Baru
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('admin');
                setError(null);
              }}
              className={`py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                mode === 'admin' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Pustakawan
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              {error}
            </div>
          )}

          {mode === 'register' && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5" htmlFor="reg-name">
                Nama Lengkap
              </label>
              <input
                id="reg-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: Kirania Putri"
                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D5C46]/30 focus:border-[#0D5C46]"
              />
            </div>
          )}

          {mode !== 'admin' ? (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5" htmlFor="auth-email">
                  Alamat Email
                </label>
                <input
                  id="auth-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@email.com"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D5C46]/30 focus:border-[#0D5C46]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5" htmlFor="auth-password">
                  Kata Sandi
                </label>
                <input
                  id="auth-password"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D5C46]/30 focus:border-[#0D5C46]"
                />
              </div>

              {mode === 'member' && (
                <p className="text-xs text-slate-500">
                  Belum memiliki kartu anggota? Pilih tab <strong className="text-slate-700">Daftar Baru</strong> untuk
                  langsung mendapatkan nomor anggota aktif.
                </p>
              )}
            </>
          ) : (
            <div className="space-y-3">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
                  <ShieldCheck className="w-4 h-4 text-[#0D5C46]" />
                  <span>
                    {needsAdminClaim
                      ? 'Pengaturan Kata Sandi Admin Pertama Kali'
                      : 'Verifikasi Akses Pustakawan (Admin)'}
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {needsAdminClaim
                    ? 'Belum ada kata sandi admin yang ditetapkan. Buat kata sandi admin awal Anda sekarang untuk mengamankan konsol manajemen.'
                    : envPasscodeSet
                      ? 'Masukkan passcode admin yang dikonfigurasi pada variabel lingkungan server.'
                      : 'Masukkan kata sandi admin yang telah Anda klaim sebelumnya.'}
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5" htmlFor="admin-pass">
                  {needsAdminClaim ? 'Buat Kata Sandi Admin (min. 6 karakter)' : 'Kata Sandi / Passcode Admin'}
                </label>
                <input
                  id="admin-pass"
                  type="password"
                  required
                  minLength={needsAdminClaim ? 6 : 1}
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder={needsAdminClaim ? 'Minimal 6 karakter' : 'Masukkan kata sandi admin'}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D5C46]/30 focus:border-[#0D5C46]"
                />
              </div>
            </div>
          )}

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-medium text-white bg-[#0D5C46] rounded-lg hover:bg-[#094232] disabled:opacity-60 transition-colors"
            >
              {mode === 'register' ? (
                <UserPlus className="w-3.5 h-3.5" />
              ) : (
                <Lock className="w-3.5 h-3.5" />
              )}
              <span>
                {loading
                  ? 'Memproses...'
                  : mode === 'register'
                    ? 'Daftar & Masuk'
                    : mode === 'admin'
                      ? needsAdminClaim
                        ? 'Klaim & Masuk Admin'
                        : 'Masuk Konsol Admin'
                      : 'Masuk Anggota'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
