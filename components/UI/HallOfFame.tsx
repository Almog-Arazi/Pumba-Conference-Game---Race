import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LeaderboardEntry } from '../../types';

interface HallOfFameProps {
  entries: LeaderboardEntry[];
  /** Highlight this entry id as the current player's result */
  highlightId?: string;
  /** Max rows to show (default 10) */
  maxRows?: number;
}

const MEDALS = ['🥇', '🥈', '🥉'];

export const HallOfFame: React.FC<HallOfFameProps> = ({
  entries,
  highlightId,
  maxRows = 10,
}) => {
  const rows = entries.slice(0, maxRows);

  if (rows.length === 0) {
    return (
      <div className="text-white/40 text-sm text-center py-4">
        No entries yet — be the first!
      </div>
    );
  }

  return (
    <div className="w-full">
      <h3 className="text-white font-black text-lg text-center mb-3 tracking-wide flex items-center justify-center gap-2">
        🏆 Hall of Fame
      </h3>

      <div className="flex flex-col gap-1.5">
        <AnimatePresence>
          {rows.map((entry, idx) => {
            const isHighlight = entry.id === highlightId;
            const medal = MEDALS[idx] ?? null;

            return (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.04 }}
                className={`flex items-center gap-3 rounded-xl px-4 py-2.5 transition-all
                  ${isHighlight
                    ? 'bg-[#42C8BE]/30 border border-[#42C8BE] shadow-[0_0_12px_rgba(66,200,190,0.4)]'
                    : 'bg-white/10 border border-white/10'
                  }`}
              >
                {/* Rank */}
                <span className="w-6 text-center text-base font-black text-white/70 flex-shrink-0">
                  {medal ?? <span className="text-sm text-white/40">{idx + 1}</span>}
                </span>

                {/* Name + Company */}
                <div className="flex-1 min-w-0">
                  <p className={`font-black text-sm truncate ${isHighlight ? 'text-[#42C8BE]' : 'text-white'}`}>
                    {entry.name}
                    {isHighlight && <span className="text-[#42C8BE] text-xs ml-1.5">← You</span>}
                  </p>
                  {entry.company && (
                    <p className="text-white/45 text-[11px] truncate">{entry.company}</p>
                  )}
                </div>

                {/* Parking spots */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <img src="/pumba_icon.png" className="w-5 h-5 object-contain opacity-80" alt="" />
                  <span className={`font-black text-base tabular-nums ${isHighlight ? 'text-[#42C8BE]' : 'text-white'}`}>
                    {entry.parkingCollected}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
};
