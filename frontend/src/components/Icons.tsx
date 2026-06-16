type SvgProps = { className?: string; size?: number };

const svg = (path: string, viewBox = "0 0 24 24") =>
  ({ className, size = 16 }: SvgProps) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={viewBox}
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {path.split("||").map((d, i) => <path key={i} d={d} />)}
    </svg>
  );

export const CheckIcon    = svg("M20 6L9 17l-5-5");
export const XIcon        = svg("M18 6L6 18||M6 6l12 12");
export const InfoIcon     = svg("M12 16v-4||M12 8h.01");
export const ChevronDown  = svg("M6 9l6 6 6-6");
export const ArrowRight   = svg("M5 12h14||M12 5l7 7-7 7");
export const ArrowLeft    = svg("M19 12H5||M12 19l-7-7 7-7");

// Spinner — no stroke path, uses a circle arc instead
export function SpinnerIcon({ className, size = 16 }: SvgProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 2a10 10 0 0 1 10 10" opacity=".3" />
      <path d="M12 2a10 10 0 0 1 10 10" strokeDasharray="16 48" />
    </svg>
  );
}

// Circle outline for pending state
export function CircleIcon({ className, size = 16 }: SvgProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
    </svg>
  );
}

// Feature icons for Landing page
export function BoltIcon({ className, size = 24 }: SvgProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size}
      fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      className={className} aria-hidden="true">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}

export function DocumentIcon({ className, size = 24 }: SvgProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size}
      fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      className={className} aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6||M16 13H8||M16 17H8||M10 9H8" />
    </svg>
  );
}

export function DiagramIcon({ className, size = 24 }: SvgProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size}
      fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      className={className} aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M17.5 14v-4h-4||M10 6.5H14" />
    </svg>
  );
}

export function ExportIcon({ className, size = 24 }: SvgProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size}
      fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      className={className} aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M7 10l5 5 5-5||M12 15V3" />
    </svg>
  );
}
