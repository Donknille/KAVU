import { useCallback, useEffect, useReducer, useRef } from "react";
import { createPortal } from "react-dom";

// ---------------------------------------------------------------------------
// Tour step definitions
// ---------------------------------------------------------------------------

type TourStep = {
  selector: string | null; // null = centered modal (no spotlight)
  title: string;
  description: string;
  placement?: "auto" | "top" | "bottom" | "left" | "right";
};

const TOUR_STEPS: TourStep[] = [
  {
    selector: null,
    title: "Willkommen bei Meisterplaner!",
    description:
      "Lass uns die Planungsansicht kennenlernen. Wir zeigen dir die wichtigsten Bereiche in wenigen Schritten.",
  },
  {
    selector: '[data-sidebar="sidebar"]',
    title: "Navigation",
    description:
      "Hier findest du alle Bereiche: Einsatzplan, Auftraege, Mitarbeiter und Archiv.",
    placement: "right",
  },
  {
    selector: '[data-panel-id="planning-backlog"]',
    title: "Backlog",
    description:
      "Im Backlog sammelst du alle ungeplanten Auftraege. Von hier ziehst du sie per Drag & Drop in den Kalender.",
    placement: "right",
  },
  {
    selector: '[data-tour="create-job"]',
    title: "Auftrag erstellen",
    description: "Klicke hier um einen neuen Auftrag zu erstellen.",
    placement: "bottom",
  },
  {
    selector: '[data-panel-id="planning-board"]',
    title: "Kalender",
    description:
      "Der Kalender zeigt deine Mitarbeiter und ihre Einsaetze. Ziehe Auftraege aus dem Backlog direkt auf eine Mitarbeiter-Zeile.",
    placement: "left",
  },
  {
    selector: '[data-tour="employee-filter"]',
    title: "Mitarbeiter-Filter",
    description:
      "Filtere nach einzelnen Mitarbeitern oder zeige nur die freien an.",
    placement: "bottom",
  },
  {
    selector: null,
    title: "Alles klar!",
    description:
      "Du kannst jetzt loslegen. Erstelle deinen ersten Auftrag oder plane bestehende Auftraege ein.",
  },
];

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = "meisterplaner_tour_completed";
const SPOTLIGHT_PAD = 8;
const TOOLTIP_GAP = 12;
const TOOLTIP_W = 320;
const TOOLTIP_H_EST = 200;
const MIN_DESKTOP_WIDTH = 1280;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

type TooltipPos = { top: number; left: number; placement: string };

type State = {
  active: boolean;
  step: number;
  rect: DOMRect | null;
  pos: TooltipPos | null;
};

type Action =
  | { type: "START" }
  | { type: "NEXT" }
  | { type: "DISMISS" }
  | { type: "RECT"; rect: DOMRect | null; pos: TooltipPos | null };

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "START":
      return { ...s, active: true, step: 0, rect: null, pos: null };
    case "NEXT":
      if (s.step >= TOUR_STEPS.length - 1) {
        window.localStorage.setItem(STORAGE_KEY, "1");
        return { ...s, active: false };
      }
      return { ...s, step: s.step + 1, rect: null, pos: null };
    case "DISMISS":
      window.localStorage.setItem(STORAGE_KEY, "1");
      return { ...s, active: false };
    case "RECT":
      return { ...s, rect: a.rect, pos: a.pos };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function calcPos(
  rect: DOMRect,
  pref: string = "auto",
): TooltipPos {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const pr = {
    top: rect.top - SPOTLIGHT_PAD,
    bottom: rect.bottom + SPOTLIGHT_PAD,
    left: rect.left - SPOTLIGHT_PAD,
    right: rect.right + SPOTLIGHT_PAD,
    w: rect.width + SPOTLIGHT_PAD * 2,
    h: rect.height + SPOTLIGHT_PAD * 2,
  };

  let placement = pref;
  if (placement === "auto") {
    if (vh - pr.bottom - TOOLTIP_GAP >= TOOLTIP_H_EST) placement = "bottom";
    else if (pr.top - TOOLTIP_GAP >= TOOLTIP_H_EST) placement = "top";
    else if (vw - pr.right - TOOLTIP_GAP >= TOOLTIP_W) placement = "right";
    else placement = "left";
  }

  const cx = pr.left + pr.w / 2 - TOOLTIP_W / 2;
  const cy = pr.top + pr.h / 2 - TOOLTIP_H_EST / 2;
  let top: number, left: number;

  switch (placement) {
    case "bottom":
      top = pr.bottom + TOOLTIP_GAP;
      left = clamp(cx, 16, vw - TOOLTIP_W - 16);
      break;
    case "top":
      top = pr.top - TOOLTIP_GAP - TOOLTIP_H_EST;
      left = clamp(cx, 16, vw - TOOLTIP_W - 16);
      break;
    case "right":
      top = clamp(cy, 16, vh - TOOLTIP_H_EST - 16);
      left = pr.right + TOOLTIP_GAP;
      break;
    default: // left
      top = clamp(cy, 16, vh - TOOLTIP_H_EST - 16);
      left = pr.left - TOOLTIP_GAP - TOOLTIP_W;
      break;
  }

  return { top, left, placement };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function OnboardingTour() {
  const [s, dispatch] = useReducer(reducer, {
    active: false,
    step: 0,
    rect: null,
    pos: null,
  });

  // Init: start tour if not completed and on desktop
  useEffect(() => {
    if (window.localStorage.getItem(STORAGE_KEY) === "1") return;
    if (window.innerWidth < MIN_DESKTOP_WIDTH) return;
    // Small delay to let the page render
    const id = setTimeout(() => dispatch({ type: "START" }), 800);
    return () => clearTimeout(id);
  }, []);

  // Track target element for current step
  useEffect(() => {
    if (!s.active) return;
    const step = TOUR_STEPS[s.step];
    if (!step.selector) {
      dispatch({ type: "RECT", rect: null, pos: null });
      return;
    }

    // Wait a tick for DOM to settle
    const timer = setTimeout(() => {
      const el = document.querySelector(step.selector!);
      if (!el) {
        // Element not in DOM — skip step
        dispatch({ type: "NEXT" });
        return;
      }

      el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });

      function update() {
        const r = el!.getBoundingClientRect();
        dispatch({ type: "RECT", rect: r, pos: calcPos(r, step.placement ?? "auto") });
      }

      // Measure after scroll settles
      setTimeout(update, 350);

      const ro = new ResizeObserver(update);
      ro.observe(el);
      window.addEventListener("resize", update, { passive: true });

      return () => {
        ro.disconnect();
        window.removeEventListener("resize", update);
      };
    }, 100);

    return () => clearTimeout(timer);
  }, [s.active, s.step]);

  // ESC key
  useEffect(() => {
    if (!s.active) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") dispatch({ type: "DISMISS" });
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [s.active]);

  const handleNext = useCallback(() => dispatch({ type: "NEXT" }), []);
  const handleSkip = useCallback(() => dispatch({ type: "DISMISS" }), []);

  if (!s.active) return null;

  const step = TOUR_STEPS[s.step];
  const isModal = step.selector === null;
  const isLast = s.step === TOUR_STEPS.length - 1;

  // Spotlight hole coordinates (with padding + rounded corners)
  const hx = s.rect ? s.rect.left - SPOTLIGHT_PAD : 0;
  const hy = s.rect ? s.rect.top - SPOTLIGHT_PAD : 0;
  const hw = s.rect ? s.rect.width + SPOTLIGHT_PAD * 2 : 0;
  const hh = s.rect ? s.rect.height + SPOTLIGHT_PAD * 2 : 0;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999]"
      style={{ animation: "tour-fade-in 300ms ease-out" }}
    >
      {/* SVG overlay with spotlight mask */}
      <svg
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        <defs>
          <mask id="tour-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {s.rect && (
              <rect
                x={hx}
                y={hy}
                width={hw}
                height={hh}
                rx="12"
                ry="12"
                fill="black"
                style={{ transition: "all 300ms ease-in-out" }}
              />
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.6)"
          mask="url(#tour-mask)"
        />
      </svg>

      {/* Click blocker on overlay (skip on click) */}
      <div className="absolute inset-0" onClick={handleSkip} />

      {/* Tooltip card */}
      <TourTooltip
        step={step}
        stepIndex={s.step}
        totalSteps={TOUR_STEPS.length}
        isModal={isModal}
        isLast={isLast}
        position={s.pos}
        onNext={handleNext}
        onSkip={handleSkip}
      />

      {/* Inline keyframes */}
      <style>{`
        @keyframes tour-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------------------
// Tooltip
// ---------------------------------------------------------------------------

function TourTooltip({
  step,
  stepIndex,
  totalSteps,
  isModal,
  isLast,
  position,
  onNext,
  onSkip,
}: {
  step: TourStep;
  stepIndex: number;
  totalSteps: number;
  isModal: boolean;
  isLast: boolean;
  position: TooltipPos | null;
  onNext: () => void;
  onSkip: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Auto-focus Next button on step change
  useEffect(() => {
    const btn = ref.current?.querySelector<HTMLButtonElement>("[data-tour-next]");
    btn?.focus();
  }, [stepIndex]);

  const style: React.CSSProperties = isModal
    ? { top: "50%", left: "50%", transform: "translate(-50%, -50%)" }
    : position
      ? {
          top: `${position.top}px`,
          left: `${position.left}px`,
          transition: "top 300ms ease-in-out, left 300ms ease-in-out",
        }
      : { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };

  return (
    <div
      ref={ref}
      role="dialog"
      aria-live="assertive"
      aria-label={step.title}
      className="fixed z-[10000] w-80 rounded-2xl border border-[#e2e8f0] bg-white p-5 shadow-xl"
      style={style}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === "Escape") onSkip();
        if (e.key === "Tab") {
          const nodes = ref.current?.querySelectorAll<HTMLElement>(
            "button, [tabindex]:not([tabindex='-1'])",
          );
          if (nodes && nodes.length > 0) {
            const first = nodes[0];
            const last = nodes[nodes.length - 1];
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first.focus();
            }
          }
        }
      }}
    >
      <p className="text-xs text-[#173d66]/40">
        {stepIndex + 1} / {totalSteps}
      </p>
      <h3 className="mt-1 text-base font-semibold text-[#173d66]">
        {step.title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-[#173d66]/70">
        {step.description}
      </p>
      <div className="mt-4 flex items-center justify-between">
        {!isLast ? (
          <button
            type="button"
            className="text-sm text-[#173d66]/50 underline"
            onClick={onSkip}
          >
            Tour ueberspringen
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          data-tour-next
          className="rounded-xl bg-[#68d5c8] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#5cc4b7]"
          onClick={onNext}
        >
          {isLast ? "Loslegen" : "Weiter →"}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dev utility
// ---------------------------------------------------------------------------

export function resetTour(): void {
  window.localStorage.removeItem(STORAGE_KEY);
  window.location.reload();
}

if (import.meta.env.DEV) {
  (window as any).__resetTour = resetTour;
}
