// Wraps every /ads/* page in the dark zinc-950 + gold theme, matching the
// CRM, without touching the rest of the (light-themed) app.
export default function AdsLayout({ children }: { children: React.ReactNode }) {
  return <div className="ads-theme">{children}</div>;
}
