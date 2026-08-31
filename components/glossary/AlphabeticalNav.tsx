'use client';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

interface AlphabeticalNavProps {
  activeLetter?: string | null;
  onLetterClick: (letter: string | null) => void;
  availableLetters: string[];
}

export function AlphabeticalNav({
  activeLetter,
  onLetterClick,
  availableLetters,
}: AlphabeticalNavProps) {
  return (
    <div className="bg-white border rounded-[6px] p-4">
      <div className="flex flex-wrap gap-2 justify-center">
        <button
          onClick={() => onLetterClick(null)}
          className={`
            px-3 py-2 rounded-md font-semibold text-sm transition-colors
            ${!activeLetter
              ? 'bg-brand-600 text-white'
              : 'bg-surface-deep hover:bg-border-subtle text-ink-secondary'
            }
          `}
        >
          Todos
        </button>
        {LETTERS.map((letter) => {
          const isAvailable = availableLetters.includes(letter);
          const isActive = activeLetter === letter;

          return (
            <button
              key={letter}
              onClick={() => isAvailable && onLetterClick(letter)}
              disabled={!isAvailable}
              className={`
                w-10 h-10 rounded-md font-semibold transition-colors
                ${isActive
                  ? 'bg-brand-600 text-white'
                  : isAvailable
                    ? 'bg-surface-deep hover:bg-border-subtle text-ink-secondary'
                    : 'bg-surface-raised text-ink-muted cursor-not-allowed'
                }
              `}
            >
              {letter}
            </button>
          );
        })}
      </div>
    </div>
  );
}
