import { useEffect, type RefObject } from "react";

interface Options {
  /** Which edge of the trigger the popover lines up with. */
  align?: "left" | "right";
  /** Distance between the trigger and the popover, in pixels. */
  gap?: number;
  /** Used when the popover copies the trigger's width. */
  minWidth?: number;
  maxWidth?: number;
  /** Copy the trigger's width (dropdowns) instead of sizing to the content (menus). */
  matchWidth?: boolean;
}

/**
 * Keep a `position: fixed` popover glued to its trigger.
 *
 * Fixed positioning takes the popover out of every ancestor's clipping and
 * stacking context, so a card with `overflow: hidden` can no longer cut a
 * dropdown in half. The price is that percentages and static offsets resolve
 * against the viewport, so every position and width is measured from the
 * trigger here instead. Runs again on resize and on any scroll, and flips above
 * the trigger when there is more room there than below.
 */
export default function useAnchoredPosition(
  open: boolean,
  anchorRef: RefObject<HTMLElement | null>,
  popoverRef: RefObject<HTMLElement | null>,
  { align = "left", gap = 6, minWidth = 140, maxWidth = 380, matchWidth = false }: Options = {},
): void {
  useEffect(() => {
    if (!open) return;

    const place = (): void => {
      const anchor = anchorRef.current;
      const popover = popoverRef.current;
      if (!anchor || !popover) return;

      const rect = anchor.getBoundingClientRect();
      if (matchWidth) {
        popover.style.width = `${Math.min(Math.max(rect.width, minWidth), maxWidth)}px`;
      }

      const width = popover.offsetWidth;
      const height = popover.offsetHeight;
      const below = window.innerHeight - rect.bottom - gap;
      const above = rect.top - gap;
      const openUp = height > below && above > below;

      popover.style.top = openUp
        ? `${Math.max(8, rect.top - gap - height)}px`
        : `${rect.bottom + gap}px`;

      const left = align === "right" ? rect.right - width : rect.left;
      popover.style.left = `${Math.max(8, Math.min(left, window.innerWidth - width - 8))}px`;
    };

    place();
    window.addEventListener("resize", place);
    // Capture the scroll of every ancestor, not just the window.
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, anchorRef, popoverRef, align, gap, minWidth, maxWidth, matchWidth]);
}
