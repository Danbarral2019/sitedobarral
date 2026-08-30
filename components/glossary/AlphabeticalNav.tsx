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
    <div className="bg-white border rounded-lg p-4">
      <div className="flex flex-wrap gap-2 justify-center">
        <button
          onClick={() => onLetterClick(null)}
          className={`
            px-3 py-2 rounded-md font-semibold text-sm transition-colors
            ${!activeLetter
              ? 'bg-blue-600 text-surface-page'
              : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
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
                  ? 'bg-blue-600 text-surface-page'
                  : isAvailable
                    ? 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    : 'bg-gray-50 text-gray-300 cursor-not-allowed'
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
