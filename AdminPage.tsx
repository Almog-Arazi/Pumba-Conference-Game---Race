import React, { useEffect, useState } from 'react';
import { LeaderboardEntry } from './types';

const HALL_OF_FAME_KEY = 'pumba_hall_of_fame';

const MEDALS = ['🥇', '🥈', '🥉'];

function formatDate(ts: number) {
  return new Date(ts).toLocaleString('he-IL', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

function toCSV(entries: LeaderboardEntry[]): string {
  const header = ['Rank', 'Name', 'Company', 'Contact', 'Parking Spots', 'Score', 'Date'].join(',');
  const rows = entries.map((e, i) =>
    [i + 1, `"${e.name}"`, `"${e.company}"`, `"${e.contact}"`, e.parkingCollected, e.score, `"${formatDate(e.timestamp)}"`].join(',')
  );
  return [header, ...rows].join('\n');
}

function downloadCSV(entries: LeaderboardEntry[]) {
  const csv  = toCSV(entries);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `pumba-players-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const AdminPage: React.FC = () => {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [filter, setFilter]   = useState('');
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(HALL_OF_FAME_KEY);
      setEntries(raw ? JSON.parse(raw) : []);
    } catch {
      setEntries([]);
    }
  }, []);

  const handleClear = () => {
    if (!confirmClear) { setConfirmClear(true); return; }
    localStorage.removeItem(HALL_OF_FAME_KEY);
    setEntries([]);
    setConfirmClear(false);
  };

  const visible = entries.filter(e =>
    e.name.toLowerCase().includes(filter.toLowerCase()) ||
    e.company.toLowerCase().includes(filter.toLowerCase()) ||
    e.contact.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <img src="/logo_2.svg" alt="Pumba" className="h-10 w-auto" />
          <div>
            <h1 className="text-xl font-black tracking-tight">Admin Dashboard</h1>
            <p className="text-gray-400 text-xs">Hall of Fame · {entries.length} players total</p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Search */}
          <input
            type="text"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Search name / company…"
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm
                       placeholder:text-gray-500 focus:outline-none focus:border-cyan-500 w-52"
          />

          {/* Export */}
          <button
            onClick={() => downloadCSV(visible)}
            disabled={visible.length === 0}
            className="flex items-center gap-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40
                       text-white font-bold text-sm px-4 py-2 rounded-lg transition-colors"
          >
            ⬇️ Export CSV
          </button>

          {/* Clear */}
          <button
            onClick={handleClear}
            onBlur={() => setConfirmClear(false)}
            className={`font-bold text-sm px-4 py-2 rounded-lg transition-colors
              ${confirmClear
                ? 'bg-red-600 hover:bg-red-500 animate-pulse'
                : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}`}
          >
            {confirmClear ? '⚠️ Confirm Clear' : '🗑️ Clear All'}
          </button>
        </div>
      </header>

      {/* Table */}
      <main className="p-6 overflow-x-auto">
        {visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-500 gap-3">
            <span className="text-5xl">🏆</span>
            <p className="text-lg font-semibold">
              {entries.length === 0 ? 'No players yet.' : 'No results match your search.'}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-gray-400 text-xs uppercase tracking-wider border-b border-gray-800">
                <th className="pb-3 pr-4 w-12">#</th>
                <th className="pb-3 pr-4">Name</th>
                <th className="pb-3 pr-4">Company</th>
                <th className="pb-3 pr-4">Phone / Email</th>
                <th className="pb-3 pr-4 text-center">🅿️ Spots</th>
                <th className="pb-3 pr-4 text-center">Score</th>
                <th className="pb-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((entry, idx) => {
                // Find original rank in full sorted list
                const rank = entries.findIndex(e => e.id === entry.id);
                const medal = MEDALS[rank] ?? null;

                return (
                  <tr
                    key={entry.id}
                    className="border-b border-gray-800/60 hover:bg-gray-800/40 transition-colors"
                  >
                    {/* Rank */}
                    <td className="py-3 pr-4 font-bold text-gray-400">
                      {medal
                        ? <span className="text-lg">{medal}</span>
                        : <span className="tabular-nums">{rank + 1}</span>
                      }
                    </td>

                    {/* Name */}
                    <td className="py-3 pr-4 font-bold text-white">{entry.name}</td>

                    {/* Company */}
                    <td className="py-3 pr-4 text-gray-300">{entry.company || '—'}</td>

                    {/* Contact */}
                    <td className="py-3 pr-4 text-gray-400">{entry.contact || '—'}</td>

                    {/* Parking */}
                    <td className="py-3 pr-4 text-center">
                      <span className="inline-flex items-center gap-1 font-black text-cyan-400 tabular-nums text-base">
                        {entry.parkingCollected}
                      </span>
                    </td>

                    {/* Score */}
                    <td className="py-3 pr-4 text-center text-gray-300 tabular-nums">
                      {entry.score.toLocaleString()}
                    </td>

                    {/* Date */}
                    <td className="py-3 text-gray-500 text-xs whitespace-nowrap">
                      {formatDate(entry.timestamp)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 px-6 py-2 flex justify-between text-xs text-gray-600">
        <span>Showing {visible.length} of {entries.length} players</span>
        <a href="/" className="hover:text-gray-400 transition-colors">← Back to game</a>
      </footer>
    </div>
  );
};

export default AdminPage;
