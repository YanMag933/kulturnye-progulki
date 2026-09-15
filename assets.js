/** Inline visual assets: monument silhouettes + facade crops (object-on-photo style) */
window.KP_ASSETS = {
  /** Standing Griboedov — head, frock coat, scroll in right hand, pedestal */
  contour_griboedov: `
<svg viewBox="0 0 200 340" xmlns="http://www.w3.org/2000/svg" aria-label="Контур памятника Грибоедову">
  <!-- pedestal -->
  <path fill="none" stroke="currentColor" stroke-width="3" d="M48 312 h104 M40 324 h120 M28 336 h144"/>
  <!-- legs / coat hem -->
  <path fill="none" stroke="currentColor" stroke-width="3.2" stroke-linejoin="round"
    d="M78 312
       V210
       c-18 -8 -28 -28 -22 -52
       c-14 -4 -26 2 -34 14
       c-4 8 2 14 10 12
       l18 -8
       M122 312
       V205
       c22 4 40 22 36 48
       c10 6 8 18 -4 22
       h-22"/>
  <!-- torso + shoulders -->
  <path fill="none" stroke="currentColor" stroke-width="3.2" stroke-linejoin="round"
    d="M78 170
       c-6 -28 4 -48 22 -58
       c10 -4 20 -4 30 0
       c18 10 28 30 22 58
       M92 118
       c-8 6 -10 16 -6 24
       M108 118
       c8 6 10 16 6 24"/>
  <!-- head + hair line -->
  <path fill="none" stroke="currentColor" stroke-width="3.2"
    d="M100 42
       c-13 1 -24 14 -22 30
       c2 14 12 24 22 25
       c13 0 24 -12 24 -28
       c0 -15 -11 -28 -24 -27z"/>
  <path fill="none" stroke="currentColor" stroke-width="2.2" opacity="0.85"
    d="M82 58 c8 -14 22 -18 34 -8 M88 70 h24"/>
  <!-- scroll in right hand (viewer's left of figure slightly forward) -->
  <path fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round"
    d="M58 168
       c-2 10 4 18 12 20
       l8 2
       c6 -2 8 -10 4 -16
       l-10 -18
       z
       M70 175 v22"/>
  <!-- left arm along body -->
  <path fill="none" stroke="currentColor" stroke-width="2.8"
    d="M128 130 c16 18 20 40 12 62"/>
</svg>`,

  /** Pushkin silhouette — frock coat, characteristic head tilt */
  contour_pushkin: `
<svg viewBox="0 0 200 320" xmlns="http://www.w3.org/2000/svg" aria-label="Контур памятника Пушкину">
  <path fill="none" stroke="currentColor" stroke-width="3.2" stroke-linejoin="round"
    d="M100 22
       c-14 0 -26 14 -24 30
       c2 12 10 20 22 22
       c14 0 26 -12 26 -28
       c0 -14 -12 -24 -24 -24z
       M78 74
       c-16 10 -22 34 -12 58
       l8 40
       M122 74
       c16 8 26 30 18 56
       l-6 30
       c12 10 20 28 12 46
       h-28
       M90 170
       l-10 78
       h40
       l-8 -78
       M72 260 h56
       M50 278 h100
       M36 298 h128" />
  <path fill="none" stroke="currentColor" stroke-width="2.2" opacity="0.75"
    d="M88 48 c8 -10 20 -8 26 2 M76 100 c-10 4 -18 2 -26 -6" />
</svg>`,

  /** Seated figure (Timiryazev-like / seated scholar) */
  contour_seated: `
<svg viewBox="0 0 220 300" xmlns="http://www.w3.org/2000/svg" aria-label="Контур сидящего памятника">
  <path fill="none" stroke="currentColor" stroke-width="3.2" stroke-linejoin="round"
    d="M110 30
       c-12 0 -22 12 -20 26
       c2 12 12 20 22 20
       s20 -10 20 -22
       c0 -14 -10 -24 -22 -24z
       M88 78
       c-20 16 -28 40 -10 70
       l40 10
       M132 80
       c18 14 24 36 8 64
       M78 150
       c-8 20 -4 40 20 48
       l50 6
       c24 -4 34 -22 28 -44
       M70 200
       l-8 50
       h30
       l6 -36
       M140 205
       l12 48
       h32
       l-10 -52
       M40 268
       h140
       M28 288
       h164" />
</svg>`,

  /** Stone lion mascaron — photo-crop style, no emoji */
  crop_lion_mascaron: `
<svg viewBox="0 0 240 180" xmlns="http://www.w3.org/2000/svg" aria-label="Кроп детали фасада">
  <defs>
    <linearGradient id="stone" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#9a9080"/>
      <stop offset="45%" stop-color="#7a7266"/>
      <stop offset="100%" stop-color="#5c564c"/>
    </linearGradient>
    <filter id="grain">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" result="n"/>
      <feBlend in="SourceGraphic" in2="n" mode="multiply"/>
    </filter>
  </defs>
  <rect width="240" height="180" fill="url(#stone)"/>
  <rect x="0" y="0" width="240" height="180" fill="#000" opacity="0.12"/>
  <!-- carved lion-ish mascaron, cropped tight -->
  <g transform="translate(120 92)" fill="none" stroke="#2a261f" stroke-width="2.4" opacity="0.85">
    <ellipse cx="0" cy="-6" rx="48" ry="42"/>
    <path d="M-28 -20 c8 -16 20 -22 28 -18 c10 -6 24 0 30 16"/>
    <circle cx="-16" cy="-8" r="5" fill="#2a261f"/>
    <circle cx="16" cy="-8" r="5" fill="#2a261f"/>
    <path d="M-8 6 c4 10 12 14 16 0"/>
    <path d="M-22 18 c10 16 34 16 44 0"/>
    <path d="M-40 8 c-10 8 -12 22 -2 28 M40 8 c10 8 12 22 2 28"/>
    <path d="M-6 28 h12" stroke-width="3"/>
  </g>
  <rect x="8" y="8" width="224" height="164" fill="none" stroke="#efe6d4" stroke-width="2" opacity="0.35"/>
  <text x="12" y="170" font-size="9" fill="#efe6d4" opacity="0.55" font-family="sans-serif">фрагмент · увеличьте и найдите на фасаде</text>
</svg>`,

  crop_atlant_hand: `
<svg viewBox="0 0 240 180" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="st2" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#8e877a"/><stop offset="100%" stop-color="#5a544a"/>
    </linearGradient>
  </defs>
  <rect width="240" height="180" fill="url(#st2)"/>
  <g transform="translate(120 100)" fill="none" stroke="#241f18" stroke-width="2.6">
    <path d="M-50 40 v-70 c0 -20 16 -36 40 -36 h20 c24 0 40 16 40 36 v70"/>
    <path d="M-20 -20 c-8 12 -6 28 4 36"/>
    <path d="M10 -10 c12 8 18 24 12 40"/>
    <circle cx="-8" cy="-40" r="16"/>
  </g>
  <text x="12" y="170" font-size="9" fill="#efe6d4" opacity="0.55" font-family="sans-serif">фрагмент скульптуры</text>
</svg>`,

  crop_wrought_leaf: `
<svg viewBox="0 0 240 180" xmlns="http://www.w3.org/2000/svg">
  <rect width="240" height="180" fill="#4a4550"/>
  <g transform="translate(120 90)" fill="none" stroke="#c5b7a0" stroke-width="2.2">
    <path d="M0 50 c-30 -40 -20 -80 0 -100 c20 20 30 60 0 100z"/>
    <path d="M0 50 v-90"/>
    <path d="M-12 10 c-20 -10 -28 8 -10 18 M12 10 c20 -10 28 8 10 18"/>
  </g>
  <text x="12" y="170" font-size="9" fill="#efe6d4" opacity="0.55" font-family="sans-serif">фрагмент решётки / декора</text>
</svg>`,

  /** Soft photo backdrop behind contour */
  photo_plaza: `
<svg viewBox="0 0 300 400" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#6a7a88"/><stop offset="100%" stop-color="#3d454c"/>
    </linearGradient>
  </defs>
  <rect width="300" height="400" fill="url(#sky)"/>
  <rect y="250" width="300" height="150" fill="#3a3530"/>
  <rect x="20" y="120" width="70" height="140" fill="#2f2c28" opacity="0.7"/>
  <rect x="210" y="100" width="70" height="160" fill="#2f2c28" opacity="0.55"/>
  <rect y="300" width="300" height="20" fill="#2a2622"/>
  <circle cx="60" cy="80" r="18" fill="#b8a078" opacity="0.25"/>
</svg>`,
};
