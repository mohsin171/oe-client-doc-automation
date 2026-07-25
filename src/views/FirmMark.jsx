import React from 'react';

// The firm's mark, not ours. This is a white label product: the people using it
// work at the client firm, and their own identity is what should be on screen.
//
// Rendered from branding data rather than an uploaded image, so nothing
// arbitrary from the database ends up as markup, and so onboarding a firm is
// configuration rather than an asset pipeline.

export function initialsFrom(name = '') {
  const words = String(name)
    .replace(/&/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !/^(the|and|llp|ltd|limited|solicitors|partners|associates|law|firm|group|co)$/i.test(w));
  if (words.length === 0) return 'F';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export default function FirmMark({ branding = {}, name = '', size = 40 }) {
  const initials = branding.initials || initialsFrom(name);
  const from = branding.markFrom || '#4592DC';
  const to = branding.markTo || '#3875AE';
  const accent = branding.accent || 'rgba(255,255,255,0.9)';
  const id = `fm-${from.replace('#', '')}-${to.replace('#', '')}`;

  return (
    <svg
      className="firm-mark"
      width={size}
      height={size}
      viewBox="0 0 40 40"
      role="img"
      aria-label={name ? `${name} logo` : 'Firm logo'}
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={from} />
          <stop offset="1" stopColor={to} />
        </linearGradient>
      </defs>

      <rect x="0" y="0" width="40" height="40" rx="11" fill={`url(#${id})`} />

      {/* A fine rule under the monogram: a small nod to letterhead typography,
          which is the world this product actually lives in. */}
      <rect x="11" y="27.5" width="18" height="1.2" rx="0.6" fill={accent} opacity="0.85" />

      <text
        x="20"
        y="23"
        textAnchor="middle"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="15.5"
        fontWeight="600"
        letterSpacing="0.5"
        fill="#FFFFFF"
      >
        {initials}
      </text>
    </svg>
  );
}
