import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { QRCodeSVG } from 'qrcode.react';
import { composeShareCard, uploadToImgBB } from '../System/photoCapture';

type Phase = 'composing' | 'uploading' | 'ready' | 'error';

interface ShareCardProps {
  playerPhoto:  string | null;
  name:         string;
  company:      string;
  parkingCount: number;
}

export const ShareCard: React.FC<ShareCardProps> = ({
  playerPhoto, name, company, parkingCount,
}) => {
  const [phase,       setPhase]       = useState<Phase>('composing');
  const [cardDataUrl, setCardDataUrl] = useState<string | null>(null);
  const [shareUrl,    setShareUrl]    = useState<string | null>(null);
  const [errorMsg,    setErrorMsg]    = useState('');

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        setPhase('composing');
        const dataUrl = await composeShareCard({ playerPhotoUrl: playerPhoto, name, company, parkingCount });
        if (cancelled) return;
        setCardDataUrl(dataUrl);

        setPhase('uploading');
        const url = await uploadToImgBB(dataUrl);
        if (cancelled) return;
        setShareUrl(url);
        setPhase('ready');
      } catch (err: any) {
        if (cancelled) return;
        console.error('[ShareCard]', err);
        setErrorMsg(err?.message ?? 'Upload failed');
        // Still show the card even if upload failed
        setPhase('error');
      }
    };
    run();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Loading ──────────────────────────────────────────────────────────────────
  if ((phase === 'composing' || phase === 'uploading') && !cardDataUrl) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="flex flex-col items-center gap-3 py-10"
      >
        <div className="w-10 h-10 border-4 border-[#42C8BE]/30 border-t-[#42C8BE] rounded-full animate-spin" />
        <p className="text-white/55 text-sm font-semibold">
          {phase === 'composing' ? '✨ Creating your card…' : '☁️ Uploading…'}
        </p>
      </motion.div>
    );
  }

  // ── Ready (or error — show card anyway if we have it) ────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 24 }}
      className="w-full flex flex-col items-center gap-3"
    >
      {/* Card image + QR overlay */}
      {cardDataUrl && (
        <div className="relative w-full rounded-2xl overflow-hidden
                        shadow-[0_8px_48px_rgba(66,200,190,0.45)]
                        border border-[#42C8BE]/40">
          <img
            src={cardDataUrl}
            alt="Your share card"
            className="w-full object-contain block"
          />

          {/* QR overlaid bottom-right */}
          {shareUrl && (
            <div className="absolute bottom-3 right-3 bg-white rounded-xl p-2.5
                            shadow-[0_4px_16px_rgba(0,0,0,0.5)]">
              <QRCodeSVG value={shareUrl} size={120} level="M" />
              <p className="text-[9px] text-center text-gray-500 font-semibold mt-1 tracking-wide">
                Scan to save
              </p>
            </div>
          )}

          {/* Uploading spinner overlay */}
          {phase === 'uploading' && (
            <div className="absolute bottom-3 right-3 bg-black/60 rounded-xl p-4
                            flex items-center justify-center w-28 h-28">
              <div className="w-8 h-8 border-3 border-white/30 border-t-white rounded-full animate-spin" />
            </div>
          )}
        </div>
      )}

      {/* Download + error row */}
      <div className="flex items-center justify-between w-full px-1">
        {cardDataUrl && (
          <a
            href={cardDataUrl}
            download={`pumba-${name.replace(/\s+/g, '-')}.jpg`}
            className="text-[#42C8BE] font-bold text-xs hover:underline"
          >
            ⬇ Download card
          </a>
        )}
        {phase === 'error' && (
          <p className="text-red-400/80 text-xs">{errorMsg}</p>
        )}
      </div>
    </motion.div>
  );
};
