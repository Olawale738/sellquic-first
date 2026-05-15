import { ReactNode } from 'react';

// This layout is minimal and ensures the chat page is not nested within any other UI.
export default function ChatLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {/* ── Global font + animation injection ── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:wght@300;400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; }

        :root {
          --chat-bg:           #0C0C0C;
          --chat-surface:      #141414;
          --chat-border:       rgba(255,255,255,0.06);
          --chat-gold:         #D4A853;
          --chat-gold-dim:     rgba(212,168,83,0.12);
          --chat-text:         #F0EDE8;
          --chat-text-muted:   #666660;
          --font-display:      'Playfair Display', Georgia, serif;
          --font-body:         'DM Sans', system-ui, sans-serif;
        }

        /* Scrollbar */
        ::-webkit-scrollbar              { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track        { background: transparent; }
        ::-webkit-scrollbar-thumb        { background: #2A2A2A; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover  { background: var(--chat-gold); }

        /* Selection */
        ::selection { background: rgba(212,168,83,0.25); color: var(--chat-text); }

        @keyframes chat-drift-1 {
          0%,100% { transform: translate(0px,   0px)   scale(1);    }
          33%      { transform: translate(30px,  -20px) scale(1.08); }
          66%      { transform: translate(-15px,  15px) scale(0.96); }
        }
        @keyframes chat-drift-2 {
          0%,100% { transform: translate(0px,  0px)   scale(1);    }
          40%      { transform: translate(-25px, 18px) scale(1.06); }
          70%      { transform: translate(20px, -12px) scale(0.97); }
        }
        @keyframes chat-drift-3 {
          0%,100% { transform: translate(0px, 0px)  scale(1);    }
          50%      { transform: translate(15px, 22px) scale(1.04); }
        }
        @keyframes chat-fade-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0);   }
        }
        @keyframes accent-slide {
          from { transform: scaleX(0); opacity: 0; }
          to   { transform: scaleX(1); opacity: 1; }
        }
        @keyframes grain-shift {
          0%,100% { transform: translate(0, 0);   }
          20%      { transform: translate(-2%, 2%); }
          40%      { transform: translate(2%, -1%); }
          60%      { transform: translate(-1%, 2%); }
          80%      { transform: translate(1%, -2%); }
        }

        .chat-layout-wrapper {
          position: relative;
          min-height: 100dvh;
          background: var(--chat-bg);
          font-family: var(--font-body);
          color: var(--chat-text);
          overflow: hidden;
          isolation: isolate;
        }

        /* ── Ambient orbs ── */
        .chat-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          pointer-events: none;
          z-index: 0;
        }
        .chat-orb-gold {
          width: 520px; height: 520px;
          top: -160px; left: -120px;
          background: radial-gradient(circle, rgba(212,168,83,0.10) 0%, transparent 70%);
          animation: chat-drift-1 22s ease-in-out infinite;
        }
        .chat-orb-blue {
          width: 440px; height: 440px;
          bottom: -100px; right: -80px;
          background: radial-gradient(circle, rgba(107,140,174,0.09) 0%, transparent 70%);
          animation: chat-drift-2 28s ease-in-out infinite;
        }
        .chat-orb-green {
          width: 300px; height: 300px;
          top: 40%; left: 55%;
          background: radial-gradient(circle, rgba(107,156,117,0.06) 0%, transparent 70%);
          animation: chat-drift-3 34s ease-in-out infinite;
        }

        /* ── Dot grid ── */
        .chat-grid {
          position: absolute;
          inset: 0;
          z-index: 0;
          background-image: radial-gradient(rgba(212,168,83,0.06) 1px, transparent 1px);
          background-size: 36px 36px;
          pointer-events: none;
          mask-image: radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%);
        }

        /* ── Film grain ── */
        .chat-grain {
          position: absolute;
          inset: -50%;
          width: 200%; height: 200%;
          z-index: 1;
          pointer-events: none;
          opacity: 0.022;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
          background-repeat: repeat;
          background-size: 128px 128px;
          animation: grain-shift 0.5s steps(1) infinite;
        }

        /* ── Top accent bar ── */
        .chat-accent-bar {
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 2px;
          background: linear-gradient(90deg,
            transparent 0%,
            rgba(212,168,83,0.4) 20%,
            var(--chat-gold) 50%,
            rgba(212,168,83,0.4) 80%,
            transparent 100%
          );
          transform-origin: left center;
          animation: accent-slide 1s cubic-bezier(0.16,1,0.3,1) 0.2s both;
          z-index: 2;
        }

        /* ── Corner sigils ── */
        .chat-corner {
          position: absolute;
          width: 48px; height: 48px;
          pointer-events: none;
          z-index: 2;
          opacity: 0.18;
        }
        .chat-corner-tl { top: 16px;    left: 16px;    border-top: 1px solid var(--chat-gold); border-left: 1px solid var(--chat-gold); }
        .chat-corner-br { bottom: 16px; right: 16px;   border-bottom: 1px solid var(--chat-gold); border-right: 1px solid var(--chat-gold); }

        /* ── Content layer ── */
        .chat-content {
          position: relative;
          z-index: 3;
          min-height: 100dvh;
          animation: chat-fade-in 0.5s ease both;
          display: flex;
          flex-direction: column;
        }
      `}</style>

      <div className="chat-layout-wrapper">
        {/* Ambient glow orbs */}
        <div className="chat-orb chat-orb-gold" aria-hidden="true" />
        <div className="chat-orb chat-orb-blue"  aria-hidden="true" />
        <div className="chat-orb chat-orb-green" aria-hidden="true" />

        {/* Dot-grid texture */}
        <div className="chat-grid" aria-hidden="true" />

        {/* Film grain overlay */}
        <div className="chat-grain" aria-hidden="true" />

        {/* Top gold accent bar */}
        <div className="chat-accent-bar" aria-hidden="true" />

        {/* Corner filigree */}
        <div className="chat-corner chat-corner-tl" aria-hidden="true" />
        <div className="chat-corner chat-corner-br" aria-hidden="true" />

        {/* ── Chat page content (unchanged) ── */}
        <div className="chat-content">
          {children}
        </div>
      </div>
    </>
  );
}
