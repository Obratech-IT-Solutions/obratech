import { DayPicker } from "react-day-picker";
import { CalendarDays, ChevronDown } from "lucide-react";
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import "react-day-picker/style.css";

function toISODateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fromISODateLocal(s: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return undefined;
  return dt;
}

type Props = {
  value: string;
  onChange: (isoDate: string) => void;
  id?: string;
  "aria-labelledby"?: string;
};

export function InquiryMeetingDatePicker({ value, onChange, id, "aria-labelledby": ariaLabelledby }: Props) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties>({});

  const selected = value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? fromISODateLocal(value) : undefined;

  const updatePosition = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const minW = 300;
    const width = Math.max(minW, r.width);
    let left = r.left;
    if (left + width > window.innerWidth - 10) left = window.innerWidth - width - 10;
    if (left < 10) left = 10;
    const estHeight = 360;
    let top = r.bottom + 8;
    if (top + estHeight > window.innerHeight - 10) {
      top = Math.max(10, r.top - estHeight - 8);
    }
    setPopoverStyle({
      position: "fixed",
      top,
      left,
      width,
      zIndex: 320,
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (popoverRef.current?.contains(t) || anchorRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        e.stopPropagation();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const displayLabel = selected
    ? selected.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Choose a date";

  const popover = open ? (
    <div
      ref={popoverRef}
      className="inquiry-date-popover"
      style={popoverStyle}
      role="dialog"
      aria-label="Calendar"
    >
      <DayPicker
        mode="single"
        required={false}
        selected={selected}
        onSelect={(d) => {
          onChange(d ? toISODateLocal(d) : "");
          setOpen(false);
        }}
        defaultMonth={selected ?? new Date()}
        className="inquiry-rdp"
      />
      <div className="inquiry-date-popover-footer">
        <button
          type="button"
          className="inquiry-date-foot-btn inquiry-date-foot-btn-muted"
          onClick={() => {
            onChange("");
            setOpen(false);
          }}
        >
          Clear
        </button>
        <button
          type="button"
          className="inquiry-date-foot-btn"
          onClick={() => {
            onChange(toISODateLocal(new Date()));
            setOpen(false);
          }}
        >
          Today
        </button>
        <button type="button" className="inquiry-date-foot-btn inquiry-date-foot-primary" onClick={() => setOpen(false)}>
          Done
        </button>
      </div>
    </div>
  ) : null;

  return (
    <div className="inquiry-date-picker-root">
      <button
        ref={anchorRef}
        type="button"
        id={id}
        className={`inquiry-date-trigger${selected ? " has-value" : ""}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-labelledby={ariaLabelledby}
        onClick={() => setOpen((o) => !o)}
      >
        <CalendarDays size={18} strokeWidth={1.75} className="inquiry-date-trigger-icon" aria-hidden />
        <span className="inquiry-date-trigger-label">{displayLabel}</span>
        <ChevronDown size={18} strokeWidth={2} className="inquiry-date-trigger-chevron" aria-hidden />
      </button>
      {popover ? createPortal(popover, document.body) : null}
    </div>
  );
}
