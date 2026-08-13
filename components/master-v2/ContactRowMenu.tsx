"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface ContactRowMenuProps {
  onEdit: () => void;
  onDelete: () => void;
  deleteLabel?: string;
}

function getMenuPosition(button: HTMLButtonElement) {
  const rect = button.getBoundingClientRect();
  const menuWidth = 144;
  const padding = 8;
  let left = rect.left;
  if (left + menuWidth > window.innerWidth - padding) {
    left = window.innerWidth - menuWidth - padding;
  }
  if (left < padding) left = padding;

  return {
    top: rect.bottom + 4,
    left,
  };
}

export default function ContactRowMenu({
  onEdit,
  onDelete,
  deleteLabel = "מחיקה",
}: ContactRowMenuProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    function updatePosition() {
      if (!buttonRef.current) return;
      setMenuPosition(getMenuPosition(buttonRef.current));
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        buttonRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const menu =
    open && mounted
      ? createPortal(
          <div
            ref={menuRef}
            role="menu"
            className="fixed z-[200] min-w-[9rem] rounded-md border border-forte-border bg-white shadow-lg py-1"
            style={{ top: menuPosition.top, left: menuPosition.left }}
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onEdit();
              }}
              className="block w-full text-right px-3 py-2 text-xs font-medium text-forte-text hover:bg-forte-blue-light/40"
            >
              עריכה
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onDelete();
              }}
              className="block w-full text-right px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50"
            >
              {deleteLabel}
            </button>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="rounded-md border border-forte-border bg-white px-2 py-1 text-sm text-forte-text hover:bg-forte-blue-light/40"
        aria-label="תפריט פעולות"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        ⋮
      </button>
      {menu}
    </>
  );
}
