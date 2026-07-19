import {useEffect, useLayoutEffect, useRef, useState} from "react";
import {createPortal} from "react-dom";

// Global tooltip: one portal listens for any element carrying `data-tooltip`.
// Replaces native `title=` (fixed ~500ms delay, unstyleable OS chrome).
const SHOW_DELAY = 300;
const GAP = 8;

type TipState = {
  text: string;
  cx: number; // trigger horizontal center
  top: number; // trigger top edge
  bottom: number; // trigger bottom edge
};

export const Tooltip: React.FC = () => {
  const [tip, setTip] = useState<TipState | null>(null);
  const [pos, setPos] = useState<{
    left: number;
    top: number;
    arrow: number;
    placement: "top" | "bottom";
  } | null>(null);
  const timer = useRef<number>();
  const tipRef = useRef<HTMLDivElement>(null);
  const target = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const show = (el: HTMLElement) => {
      const text = el.getAttribute("data-tooltip");
      if (!text) return;
      // Preserve accessibility for icon-only controls that used to rely on title.
      if (!el.getAttribute("aria-label") && !el.textContent?.trim()) {
        el.setAttribute("aria-label", text);
      }
      const r = el.getBoundingClientRect();
      setPos(null);
      setTip({
        text,
        cx: r.left + r.width / 2,
        top: r.top,
        bottom: r.bottom,
      });
    };

    const hide = () => {
      window.clearTimeout(timer.current);
      target.current = null;
      setTip(null);
      setPos(null);
    };

    const onOver = (e: MouseEvent) => {
      const el = (e.target as HTMLElement)?.closest<HTMLElement>(
        "[data-tooltip]"
      );
      if (!el || el === target.current) return;
      target.current = el;
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => show(el), SHOW_DELAY);
    };

    const onOut = (e: MouseEvent) => {
      if (!target.current) return;
      const to = e.relatedTarget as Node | null;
      if (to && target.current.contains(to)) return;
      hide();
    };

    document.addEventListener("mouseover", onOver);
    document.addEventListener("mouseout", onOut);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("wheel", hide, {passive: true});
    return () => {
      document.removeEventListener("mouseover", onOver);
      document.removeEventListener("mouseout", onOut);
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("wheel", hide);
      window.clearTimeout(timer.current);
    };
  }, []);

  useLayoutEffect(() => {
    if (!tip || !tipRef.current) return;
    const t = tipRef.current.getBoundingClientRect();
    const placement: "top" | "bottom" =
      tip.top - GAP - t.height < 8 ? "bottom" : "top";
    const top =
      placement === "top" ? tip.top - GAP - t.height : tip.bottom + GAP;
    const left = Math.min(
      Math.max(8, tip.cx - t.width / 2),
      window.innerWidth - 8 - t.width
    );
    setPos({left, top, arrow: tip.cx - left, placement});
  }, [tip]);

  if (!tip) return null;

  return createPortal(
    <div
      ref={tipRef}
      role="tooltip"
      className="tooltip-chip"
      data-placement={pos?.placement}
      style={{
        left: pos?.left ?? tip.cx,
        top: pos?.top ?? tip.top,
        visibility: pos ? "visible" : "hidden",
      }}
    >
      {tip.text}
      <span className="tooltip-arrow" style={{left: pos?.arrow}} />
    </div>,
    document.body
  );
};
