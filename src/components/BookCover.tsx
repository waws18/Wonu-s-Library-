import { useState } from 'react';
import type { Book } from '../types/library';

interface BookCoverProps {
  book: Pick<Book, 'title' | 'author' | 'callNumber' | 'coverUrl' | 'accentTone' | 'category'>;
  className?: string;
  compact?: boolean;
}

const TONE_MAP: Record<Book['accentTone'], { bg: string; spine: string; text: string; muted: string; rule: string }> = {
  forest: {
    bg: 'bg-[#12382B]',
    spine: 'bg-[#0A241B]',
    text: 'text-[#F3F6F4]',
    muted: 'text-[#A7C4B8]',
    rule: 'border-[#2B5A48]',
  },
  slate: {
    bg: 'bg-[#26323F]',
    spine: 'bg-[#182029]',
    text: 'text-[#F8FAFC]',
    muted: 'text-[#94A3B8]',
    rule: 'border-[#3E4E60]',
  },
  amber: {
    bg: 'bg-[#5B3A1E]',
    spine: 'bg-[#3F2612]',
    text: 'text-[#FDF8F2]',
    muted: 'text-[#DFC1A3]',
    rule: 'border-[#7C5330]',
  },
  indigo: {
    bg: 'bg-[#1E2B4A]',
    spine: 'bg-[#131C33]',
    text: 'text-[#F1F5F9]',
    muted: 'text-[#A6B7D9]',
    rule: 'border-[#324570]',
  },
  crimson: {
    bg: 'bg-[#521E28]',
    spine: 'bg-[#391219]',
    text: 'text-[#FDF2F4]',
    muted: 'text-[#DCB3BC]',
    rule: 'border-[#75303D]',
  },
};

export function BookCover({ book, className = '', compact = false }: BookCoverProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const tone = TONE_MAP[book.accentTone] || TONE_MAP.forest;

  if (book.coverUrl && !imgFailed) {
    return (
      <div className={`relative overflow-hidden bg-slate-100 border border-slate-200 ${className}`}>
        <img
          src={book.coverUrl}
          alt={`Sampul buku ${book.title}`}
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden flex ${tone.bg} ${tone.text} border border-slate-900/10 select-none ${className}`}
      aria-label={`Sampul arsip ${book.title}`}
    >
      <div className={`w-2.5 shrink-0 ${tone.spine} border-r border-white/10`} />
      <div className={`flex-1 flex flex-col justify-between ${compact ? 'p-2.5' : 'p-4'}`}>
        <div className={`border-b pb-2 ${tone.rule}`}>
          <p className={`font-mono ${compact ? 'text-[9px]' : 'text-[10px]'} tracking-wide ${tone.muted} truncate`}>
            {book.callNumber}
          </p>
        </div>

        <div className="my-auto py-2">
          <h4
            className={`font-serif font-semibold leading-snug ${
              compact ? 'text-xs line-clamp-3' : 'text-sm md:text-base line-clamp-4'
            }`}
          >
            {book.title}
          </h4>
        </div>

        <div className={`border-t pt-2 ${tone.rule}`}>
          <p className={`${compact ? 'text-[10px]' : 'text-xs'} ${tone.muted} truncate`}>{book.author}</p>
        </div>
      </div>
    </div>
  );
}
