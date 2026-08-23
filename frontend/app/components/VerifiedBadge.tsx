/** The blue checkmark shown next to a name wherever identity has been
 * confirmed by an admin (UserVerification.status === "verified"). One
 * component so the mark looks and means the same thing everywhere. */
export default function VerifiedBadge({ size = 14, title = 'Identity verified' }: { size?: number; title?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, display: 'inline-block', verticalAlign: 'middle' }}>
      <title>{title}</title>
      <path d="M12 2l2.4 1.9 3-.6 1 2.9 2.9 1-.6 3L22 12l-1.9 2.4.6 3-2.9 1-1 2.9-3-.6L12 22l-2.4-1.9-3 .6-1-2.9-2.9-1 .6-3L2 12l1.9-2.4-.6-3 2.9-1 1-2.9 3 .6L12 2z" fill="#4F7BF7" />
      <path d="M8.5 12.5l2.3 2.3 4.7-4.9" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  )
}
