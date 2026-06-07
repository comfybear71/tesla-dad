export function TeslaMark({ className = "" }: { className?: string }) {
  // Stylised Tesla "T" mark.
  return (
    <svg viewBox="0 0 342 35" className={className} fill="currentColor" aria-label="Tesla">
      <path d="M0 .1a9.7 9.7 0 0 0 7 7h11l.5.1V34.8h6.8V7.3L26 7h11a9.8 9.8 0 0 0 7-7H0z" />
      <path d="M155 .1h-21a25 25 0 0 0 7 7h7v27.7h7V7.1h7a25 25 0 0 0 7-7h-14z" />
    </svg>
  );
}
