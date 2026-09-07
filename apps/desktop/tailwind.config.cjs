/** @type {import('tailwindcss').Config} */
// Full color tokens keep light-dark() valid; relative RGB preserves existing
// Tailwind opacity modifiers in both appearances.
const c = (v) => `rgb(from var(${v}) r g b / <alpha-value>)`;

module.exports = {
  darkMode: ["class"],
  content: ["./index.html", "./src/renderer/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // --- Kumo, verbatim -------------------------------------------------
        base: c("--kumo-base"),
        elevated: c("--kumo-elevated"),
        recessed: c("--kumo-recessed"),
        tint: c("--kumo-tint"),
        fill: {
          DEFAULT: c("--kumo-fill"),
          hover: c("--kumo-fill-hover"),
        },
        hairline: c("--kumo-hairline"),
        link: c("--kumo-link"),
        info: {
          DEFAULT: c("--kumo-info"),
          tint: c("--kumo-info-tint"),
          text: c("--kumo-info-text"),
        },
        success: {
          DEFAULT: c("--kumo-success"),
          tint: c("--kumo-success-tint"),
          text: c("--kumo-success-text"),
        },
        warning: {
          DEFAULT: c("--kumo-warning"),
          tint: c("--kumo-warning-tint"),
          text: c("--kumo-warning-text"),
        },

        // --- the app's original names, now drawing from the Kumo palette -----
        canvas: c("--canvas"),
        surface: {
          DEFAULT: c("--surface"),
          sidebar: c("--surface-sidebar"),
          subtle: c("--surface-subtle"),
          raised: c("--surface-raised"),
        },
        ink: {
          DEFAULT: c("--ink"),
          secondary: c("--ink-secondary"),
          tertiary: c("--ink-tertiary"),
          // Kumo's own text ramp, for new work
          strong: c("--kumo-text-strong"),
          label: c("--kumo-text-label"),
          subtle: c("--kumo-text-subtle"),
          placeholder: c("--kumo-text-placeholder"),
          inverse: c("--kumo-text-inverse"),
        },
        line: {
          DEFAULT: c("--line"),
          subtle: c("--line-subtle"),
        },
        brand: {
          DEFAULT: c("--brand"),
          hover: c("--brand-hover"),
          soft: c("--brand-soft"),
          orange: c("--kumo-brand-orange"),
        },
        governed: { DEFAULT: c("--governed"), soft: c("--governed-soft") },
        partial: { DEFAULT: c("--partial"), soft: c("--partial-soft") },
        ready: { DEFAULT: c("--ready"), soft: c("--ready-soft") },
        danger: {
          DEFAULT: c("--danger"),
          soft: c("--danger-soft"),
          tint: c("--kumo-danger-tint"),
          text: c("--kumo-danger-text"),
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "system-ui",
          "Segoe UI",
          "sans-serif",
        ],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      spacing: {
        4.5: "1.125rem",
        // The standard left gutter for anything drawn at the window's top-left.
        // Resolves to the normal gutter off macOS and clears the traffic lights
        // on it; see --liq-traffic-inset in globals.css. Use as `pl-traffic`.
        traffic: "var(--liq-traffic-inset)",
      },
      // Kumo's scale: 14px base, 20px line height.
      fontSize: {
        xs: ["12px", { lineHeight: "16px" }],
        sm: ["14px", { lineHeight: "20px" }],
        base: ["14px", { lineHeight: "20px" }],
        lg: ["16px", { lineHeight: "24px" }],
        xl: ["20px", { lineHeight: "28px" }],
        "2xl": ["24px", { lineHeight: "32px" }],
        "3xl": ["30px", { lineHeight: "36px" }],
        "4xl": ["36px", { lineHeight: "44px" }],
        hero: ["44px", { lineHeight: "52px" }],
      },
      borderRadius: {
        sm: "4px",
        DEFAULT: "6px",
        md: "6px",
        lg: "8px",
        xl: "12px",
      },
      // Elevation is a ring, never a soft shadow. `popover`/`toast`/`sticky` are
      // kept as aliases so components written against them do not go flat.
      boxShadow: {
        ring: "var(--kumo-ring)",
        control: "var(--kumo-ring-drop)",
        popover: "var(--kumo-ring-drop)",
        toast: "var(--kumo-ring-drop)",
        sticky: "var(--kumo-ring)",
      },
      transitionDuration: {
        DEFAULT: "100ms",
      },
    },
  },
  plugins: [require("@tailwindcss/typography"), require("tailwindcss-animate")],
};
