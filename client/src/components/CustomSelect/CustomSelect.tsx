import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}

export default function CustomSelect({ value, onChange, options, className = '' }: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [popupStyle, setPopupStyle] = useState<React.CSSProperties>({});

  const selected = options.find((o) => o.value === value);
  const label = selected?.label ?? value;

  const calcPosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPopupStyle({
      position: 'fixed',
      top: rect.bottom + 6,
      left: rect.left,
      zIndex: 9999,
    });
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const insideTrigger = triggerRef.current?.contains(e.target as Node);
      const popup = document.getElementById('custom-select-portal');
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
        className="w-full px-3.5 py-2.5 bg-black/30 border border-white/[0.15] backdrop-blur-xl rounded-xl text-sm text-white
                   hover:border-white/30 focus:outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/30
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
          id="custom-select-portal"
          style={popupStyle}
          className="rounded-xl overflow-hidden w-fit flex flex-col
                     bg-black/50 backdrop-blur-2xl border border-white/20
                     shadow-2xl shadow-black/50"
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={`text-left px-3.5 py-2.5 text-sm whitespace-nowrap w-full transition-all duration-150
                ${opt.value === value
                  ? 'bg-white/15 text-white'
                  : 'text-white/85 hover:bg-white/10 hover:text-white'
                }`}
            >
              {opt.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}
