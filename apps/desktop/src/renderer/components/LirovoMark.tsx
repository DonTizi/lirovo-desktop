/** Decorative monogram: a soft vertical stem and a quietly chamfered foot. */
export function LirovoMark({ className }: { className?: string }): JSX.Element {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="currentColor"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d="M13 7h5a2 2 0 0 1 2 2v21a3 3 0 0 0 3 3h15a1 1 0 0 1 .8 1.6l-3.6 4.8a4 4 0 0 1-3.2 1.6H17a6 6 0 0 1-6-6V9a2 2 0 0 1 2-2Z" />
    </svg>
  );
}
