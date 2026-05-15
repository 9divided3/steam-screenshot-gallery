import { useState, useRef, useEffect, useCallback, useId } from 'react';
import { createPortal } from 'react-dom';

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}

export default function CustomSelect({ value, onChange, options, className = '' }: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const popupId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [popupStyle, setPopupStyle] = useState<React.CSSProperties>({});

  const selected = options.find((o) => o.value === value);
  const label = selected?.label ?? value;

  const calcPosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const dropdownWidth = Math.max(rect.width, 160);
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const optionCount = options.length;
    const estimatedHeight = Math.min(optionCount * 40 + 8, 260);

    let left = rect.left;
    // Don't overflow right edge
    if (left + dropdownWidth > vw - 8) {
      left = vw - dropdownWidth - 8;
    }
    // Don't overflow left edge
    if (left < 8) left = 8;

    // Flip above if not enough space below
    const spaceBelow = vh - rect.bottom - 6;
    const spaceAbove = rect.top - 6;
    const availableSpace = Math.max(96, Math.max(spaceBelow, spaceAbove) - 16);
    const top = spaceBelow >= estimatedHeight || spaceBelow >= spaceAbove
      ? rect.bottom + 6
      : Math.max(8, rect.top - Math.min(estimatedHeight, availableSpace) - 6);

    setPopupStyle({
      position: 'fixed',
      top,
      left,
      minWidth: dropdownWidth,
      maxHeight: Math.min(estimatedHeight, availableSpace),
    });
  }, [options.length]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const insideTrigger = triggerRef.current?.contains(e.target as Node);
      const popup = document.getElementById(popupId);
      const insidePopup = popup?.contains(e.target as Node);
      if (!insideTrigger && !insidePopup) {
        setOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    if (open) {
      calcPosition();
      window.addEventListener('resize', calcPosition);
      window.addEventListener('scroll', calcPosition, true);
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
      window.removeEventListener('resize', calcPosition);
      window.removeEventListener('scroll', calcPosition, true);
    };
  }, [open, calcPosition]);

  return (
    <div className={className}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="w-full min-h-11 px-3.5 py-2.5 bg-black/40 border border-white/[0.16] backdrop-blur-xl rounded-xl text-sm text-white
                   hover:border-white/30 focus:outline-none focus:border-cyan-300/70 focus:ring-1 focus:ring-cyan-300/30
                   transition-all duration-200 ease-out cursor-pointer
                   flex items-center justify-between gap-2"
      >
        <span className="truncate">{label}</span>
        <svg
          className={`w-4 h-4 text-white/65 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && createPortal(
        <div
          className="fixed inset-0 z-[9998]"
          onMouseDown={() => setOpen(false)}
        >
          <div className="absolute inset-0 bg-black/[0.14] backdrop-blur-[2px]" />
          <div
            id={popupId}
            style={popupStyle}
            role="listbox"
            onMouseDown={(e) => e.stopPropagation()}
            className="rounded-xl overflow-y-auto flex flex-col
                       bg-black/80 backdrop-blur-2xl border border-white/[0.24]
                       shadow-2xl shadow-black/60 ring-1 ring-white/[0.08]
                       animate-scale-in"
          >
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={opt.value === value}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={`text-left min-h-11 px-3.5 py-2.5 text-sm whitespace-nowrap w-full transition-all duration-150 cursor-pointer
                  ${opt.value === value
                    ? 'bg-white/[0.18] text-white'
                    : 'text-white/85 hover:bg-white/10 hover:text-white'
                  }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
