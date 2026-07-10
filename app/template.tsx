// A template (unlike layout) remounts on every navigation, so wrapping the page
// here gives every route a gentle, consistent entrance — a small thing that
// makes moving through the app feel smooth rather than snappy-hard.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
