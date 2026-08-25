/** @type {import('tailwindcss').Config} */
// Theme mirrors the Kumo tokens declared in src/renderer/styles/globals.css,
// which are the ones applications/global-iq-web-app read off dash.cloudflare.com.
//
// Two families live here on purpose:
//   - `--kumo-*` names, used directly, for new work and the shared primitives.
//   - the app's original semantic names, stored as BARE oklch components so
//     `<alpha-value>` still resolves and every `bg-surface/70` already written
//     in the components keeps working while they are migrated.
const c = (v) => `oklch(var(${v}) / <alpha-value>)`;

module.exports = {
  darkMode: ['class'],
  content: ['./index.html', './src/renderer/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // --- Kumo, verbatim -------------------------------------------------
        base: 'var(--kumo-base)',
        elevated: 'var(--kumo-elevated)',
        recessed: 'var(--kumo-recessed)',
        tint: 'var(--kumo-tint)',
        fill: {
          DEFAULT: 'var(--kumo-fill)',
          hover: 'var(--kumo-fill-hover)',
        },
        hairline: 'var(--kumo-hairline)',
        link: 'var(--kumo-link)',
        info: {
          DEFAULT: 'var(--kumo-info)',
          tint: 'var(--kumo-info-tint)',
          text: 'var(--kumo-info-text)',
        },
        success: {
          DEFAULT: 'var(--kumo-success)',
          tint: 'var(--kumo-success-tint)',
          text: 'var(--kumo-success-text)',
        },
        warning: {
          DEFAULT: 'var(--kumo-warning)',
          tint: 'var(--kumo-warning-tint)',
          text: 'var(--kumo-warning-text)',
        },

        // --- the app's original names, now drawing from the Kumo palette -----
        canvas: c('--canvas'),
        surface: {
          DEFAULT: c('--surface'),
          sidebar: c('--surface-sidebar'),
          subtle: c('--surface-subtle'),
          raised: c('--surface-raised'),
        },
        ink: {
          DEFAULT: c('--ink'),
          secondary: c('--ink-secondary'),
          tertiary: c('--ink-tertiary'),
          // Kumo's own text ramp, for new work
          strong: 'var(--kumo-text-strong)',
          label: 'var(--kumo-text-label)',
          subtle: 'var(--kumo-text-subtle)',
          placeholder: 'var(--kumo-text-placeholder)',
          inverse: 'var(--kumo-text-inverse)',
        },
        line: {
          DEFAULT: c('--line'),
          subtle: c('--line-subtle'),
        },
        brand: {
          DEFAULT: c('--brand'),
          hover: c('--brand-hover'),
          soft: c('--brand-soft'),
          orange: 'var(--kumo-brand-orange)',
        },
        governed: { DEFAULT: c('--governed'), soft: c('--governed-soft') },
        partial: { DEFAULT: c('--partial'), soft: c('--partial-soft') },
        ready: { DEFAULT: c('--ready'), soft: c('--ready-soft') },
        danger: {
          DEFAULT: c('--danger'),
          soft: c('--danger-soft'),
          tint: 'var(--kumo-danger-tint)',
          text: 'var(--kumo-danger-text)',
        },
      },
      fontFamily: {
        sans: ['Inter Variable', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      spacing: {
        4.5: '1.125rem',
        // The standard left gutter for anything drawn at the window's top-left.
        // Resolves to the normal gutter off macOS and clears the traffic lights
        // on it; see --liq-traffic-inset in globals.css. Use as `pl-traffic`.
        traffic: 'var(--liq-traffic-inset)',
      },
      // Kumo's scale: 14px base, 20px line height.
      fontSize: {
        xs: ['12px', { lineHeight: '16px' }],
        sm: ['13px', { lineHeight: '18px' }],
        base: ['14px', { lineHeight: '20px' }],
        lg: ['16px', { lineHeight: '24px' }],
        xl: ['20px', { lineHeight: '28px' }],
        '2xl': ['24px', { lineHeight: '32px' }],
        '3xl': ['30px', { lineHeight: '36px' }],
        '4xl': ['36px', { lineHeight: '44px' }],
        hero: ['44px', { lineHeight: '52px' }],
      },
      borderRadius: {
        sm: '4px',
        DEFAULT: '6px',
        md: '6px',
        lg: '8px',
        xl: '12px',
      },
      // Elevation is a ring, never a soft shadow. `popover`/`toast`/`sticky` are
      // kept as aliases so components written against them do not go flat.
      boxShadow: {
        ring: 'var(--kumo-ring)',
        control: 'var(--kumo-ring-drop)',
        popover: 'var(--kumo-ring-drop)',
        toast: 'var(--kumo-ring-drop)',
        sticky: 'var(--kumo-ring)',
      },
      transitionDuration: {
        DEFAULT: '100ms',
      },
    },
  },
  plugins: [require('@tailwindcss/typography'), require('tailwindcss-animate')],
};
