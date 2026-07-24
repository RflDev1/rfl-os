export function Crown({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m3 7 4.5 4L12 4l4.5 7L21 7l-2 11H5L3 7Z" fill="currentColor" />
      <path d="M6 21h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

