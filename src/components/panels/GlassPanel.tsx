import type { ReactNode } from "react";
import type { AppView } from "../../store/appStore";

const labels: Record<Exclude<AppView, "now-playing">, string> = {
  library: "Library",
  queue: "Queue",
  settings: "Settings",
};

export function GlassPanel({
  view,
  eyebrow,
  children,
}: {
  view: Exclude<AppView, "now-playing">;
  eyebrow: string;
  children: ReactNode;
}) {
  return (
    <section className="view-panel glass-panel" aria-label={labels[view]}>
      <header className="view-panel__header">
        <div>
          <span className="view-panel__eyebrow">{eyebrow}</span>
          <h2 tabIndex={-1}>{labels[view]}</h2>
        </div>
        <span className="view-panel__sparkle" aria-hidden="true">
          ✦
        </span>
      </header>
      <div className="view-panel__body">{children}</div>
    </section>
  );
}
