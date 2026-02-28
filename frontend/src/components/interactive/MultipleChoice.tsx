/**
 * MultipleChoice.tsx - Universal multiple-choice quiz component.
 * Props: question, options (string[]), correctIndex, explanation.
 * Shows immediate feedback after selection. Works for any domain.
 */
import { useState } from 'react';
import { CheckCircle2, XCircle, HelpCircle } from 'lucide-react';

interface Props {
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
}

export default function MultipleChoice({ question, options, correctIndex, explanation }: Props) {
  const [selected, setSelected] = useState<number | null>(null);
  const answered = selected !== null;
  const isCorrect = selected === correctIndex;

  return (
    <div className="bg-[#1a1a1a] rounded-lg p-5 border border-[#3c3c3c]">
      <div className="flex items-start gap-2 mb-4">
        <HelpCircle className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" />
        <p className="text-sm font-medium text-gray-200">{question}</p>
      </div>

      <div className="space-y-2">
        {options.map((opt, idx) => {
          let borderColor = 'border-[#3c3c3c] hover:border-blue-500';
          let bgColor = 'bg-[#252526]';
          let textColor = 'text-gray-300';
          let icon = null;

          if (answered) {
            if (idx === correctIndex) {
              borderColor = 'border-green-500';
              bgColor = 'bg-green-900/20';
              textColor = 'text-green-300';
              icon = <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />;
            } else if (idx === selected) {
              borderColor = 'border-red-500';
              bgColor = 'bg-red-900/20';
              textColor = 'text-red-300';
              icon = <XCircle className="w-4 h-4 text-red-400 shrink-0" />;
            }
          }

          return (
            <button
              key={idx}
              onClick={() => !answered && setSelected(idx)}
              disabled={answered}
              className={`w-full text-left p-3 rounded-lg border ${borderColor} ${bgColor} ${textColor} text-sm transition-colors flex items-center gap-2 disabled:cursor-default`}
            >
              {icon}
              <span>{opt}</span>
            </button>
          );
        })}
      </div>

      {answered && explanation && (
        <div className={`mt-4 p-3 rounded-lg text-sm ${isCorrect ? 'bg-green-900/20 border border-green-800 text-green-200' : 'bg-amber-900/20 border border-amber-800 text-amber-200'}`}>
          <p className="font-medium mb-1">{isCorrect ? 'Correct!' : 'Not quite.'}</p>
          <p className="text-xs opacity-90">{explanation}</p>
        </div>
      )}
    </div>
  );
}
