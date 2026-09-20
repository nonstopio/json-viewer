import React, {useCallback, useEffect, useRef, useState} from "react";
import {Share2, X} from "lucide-react";

const STORAGE_KEY = "json-viewer-share-hint-seen";

const seen = (): boolean => {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    // Private mode, or storage blocked. Treating that as "already seen" is the
    // kinder failure: a hint that cannot record its own dismissal would
    // otherwise reappear on every parse, forever.
    return true;
  }
};

const markSeen = (): void => {
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    /* nothing to do — see seen() */
  }
};

interface ShareHintProps {
  /** True once there is something worth sharing. */
  active: boolean;
}

/**
 * A one-time pointer at the Share button.
 *
 * Deliberately not a hover tooltip: sharing is a feature you have to already
 * know about to hover over. It follows the onboarding-tooltip rules — fired by
 * an event rather than on page load (the first successful parse, when there is
 * finally something worth sharing), anchored with an arrow at the thing it
 * describes, short enough to read at a glance, dismissible by button, Escape
 * or clicking away, and shown exactly once.
 *
 * Rendered inside a `relative` wrapper around the Share button. It owns its
 * own "already seen" flag so no caller has to thread that through.
 */
export const ShareHint: React.FC<ShareHintProps> = ({active}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const onDismiss = useCallback(() => {
    markSeen();
    setOpen(false);
  }, []);

  useEffect(() => {
    if (active && !seen()) setOpen(true);
  }, [active]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    const onClickAway = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onDismiss();
    };
    document.addEventListener("keydown", onKey);
    // Deferred: the click that parsed the JSON is still propagating, and
    // would otherwise dismiss the hint in the same tick it appeared.
    const id = setTimeout(
      () => document.addEventListener("mousedown", onClickAway),
      0
    );
    return () => {
      clearTimeout(id);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClickAway);
    };
  }, [open, onDismiss]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      role="dialog"
      aria-labelledby="share-hint-title"
      data-testid="share-hint"
      className="pop-in absolute right-0 top-full z-50 mt-2 w-64 border border-spot-line bg-panel p-3 text-left shadow-lg"
    >
      {/* The arrow, pointing at the button above. Two squares: the fill, and
          a slightly larger one behind it that shows as the border. */}
      <span
        aria-hidden="true"
        className="absolute -top-[5px] right-6 h-2 w-2 rotate-45 border-l border-t border-spot-line bg-panel"
      />

      <div className="flex items-start gap-2">
        <Share2 size={14} className="mt-0.5 shrink-0 text-spot" />
        <div className="min-w-0 flex-1">
          <p id="share-hint-title" className="text-sm font-semibold text-ink">
            Share it as a link
          </p>
          <p className="mt-1 text-xs leading-relaxed text-dim">
            Copy a link that reopens this JSON — and the view you’re on. The
            data travels in the link, never through a server.
          </p>
          <button
            type="button"
            onClick={onDismiss}
            className="btn btn--ghost btn--sm mt-2"
          >
            Got it
          </button>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="btn btn--quiet btn--icon !h-6 !w-6 shrink-0"
        >
          <X size={12} />
        </button>
      </div>
    </div>
  );
};
