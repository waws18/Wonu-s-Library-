import { useState } from 'react';
import { BookOpen, Minus, Plus, X } from 'lucide-react';
import type { Book } from '../types/library';

interface DigitalReaderModalProps {
  book: Book | null;
  onClose: () => void;
}

export function DigitalReaderModal({ book, onClose }: DigitalReaderModalProps) {
  const [fontSize, setFontSize] = useState<'sm' | 'md' | 'lg'>('md');

  if (!book) return null;

  const textSizeClass =
    fontSize === 'sm' ? 'text-sm leading-relaxed' : fontSize === 'lg' ? 'text-lg leading-loose' : 'text-base leading-relaxed';

  const paragraphs =
    book.digitalSample && book.digitalSample.length > 0
      ? book.digitalSample
      : [
          `Pratinjau edisi digital untuk "${book.title}" oleh ${book.author}.`,
          book.synopsis,
          'Untuk membaca keseluruhan naskah secara luring maupun daring penuh, silakan lakukan peminjaman eksemplar melalui katalog utama.',
        ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-[1px]">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-3xl max-h-[88vh] bg-[#FCFAF5] border border-slate-200 rounded-xl shadow-2xl flex flex-col overflow-hidden"
      >
        <div className="px-6 py-4 bg-white border-b border-slate-200 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <BookOpen className="w-4 h-4 text-[#0D5C46] shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">{book.title}</p>
              <p className="text-xs text-slate-500 truncate">
                {book.author} · Pratinjau Edisi Digital
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center border border-slate-200 rounded-lg bg-slate-50">
              <button
                type="button"
                onClick={() => setFontSize((prev) => (prev === 'lg' ? 'md' : 'sm'))}
                className="p-2 text-slate-600 hover:text-slate-900"
                title="Perkecil huruf"
                aria-label="Perkecil ukuran teks"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="px-2 text-xs font-mono text-slate-600 select-none">Aa</span>
              <button
                type="button"
                onClick={() => setFontSize((prev) => (prev === 'sm' ? 'md' : 'lg'))}
                className="p-2 text-slate-600 hover:text-slate-900"
                title="Perbesar huruf"
                aria-label="Perbesar ukuran teks"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100"
              aria-label="Tutup pembaca digital"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-8 md:px-14 md:py-10">
          <div className="max-w-prose mx-auto space-y-6">
            <header className="pb-6 border-b border-slate-200/80 space-y-2">
              <p className="text-xs font-mono text-slate-500">{book.callNumber} · ISBN {book.isbn}</p>
              <h2 className="font-serif text-2xl md:text-3xl font-semibold text-slate-900">{book.title}</h2>
              <p className="text-sm text-slate-600">Oleh {book.author}</p>
            </header>

            <div className={`font-serif text-slate-800 space-y-5 ${textSizeClass}`}>
              {paragraphs.map((para, idx) => (
                <p key={idx}>{para}</p>
              ))}
            </div>

            <footer className="pt-8 border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-500">
              <span>Akhir cuplikan bab sampel</span>
              <span className="font-mono tabular-nums">{book.pages} halaman edisi lengkap</span>
            </footer>
          </div>
        </div>
      </div>
    </div>
  );
}
