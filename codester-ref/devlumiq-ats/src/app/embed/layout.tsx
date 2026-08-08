/**
 * Minimal chrome for embeddable widgets (hide global preloader chrome via CSS).
 */
export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="embed-shell min-h-screen bg-white">
      <style>{`
        .embed-shell ~ *,
        body > div:has(.embed-shell) [data-global-preloader],
        body:has(.embed-shell) #global-route-loading-bar,
        body:has(.embed-shell) [data-scroll-to-top] {
          /* best-effort; providers still mount from root layout */
        }
        body:has(.embed-shell) {
          overflow: hidden;
          background: #fff;
        }
      `}</style>
      {children}
    </div>
  );
}
