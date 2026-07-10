// Remounts on every route navigation (unlike layout), which replays the
// .page-fade CSS animation so each new page fades in. Motion lives in
// globals.css and is gated on prefers-reduced-motion there.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-fade">{children}</div>;
}
