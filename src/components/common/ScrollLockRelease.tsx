import { useEffect } from "react";

/**
 * Radix UI (shadcn Select/Dialog) uses react-remove-scroll which forcibly disables
 * wheel and touchmove events globally via e.preventDefault().
 * This component intercepts those events during the capture phase so that native
 * background scrolling remains completely fluid and unlocked.
 */
export function ScrollLockRelease() {
  useEffect(() => {
    const handleScrollEvent = (e: Event) => {
      if (document.body.getAttribute("data-scroll-locked") === "1") {
        // Stop react-remove-scroll's document-level listener from canceling the scroll
        e.stopImmediatePropagation();
      }
    };

    window.addEventListener("wheel", handleScrollEvent, { capture: true, passive: true });
    window.addEventListener("touchmove", handleScrollEvent, { capture: true, passive: true });

    return () => {
      window.removeEventListener("wheel", handleScrollEvent, { capture: true });
      window.removeEventListener("touchmove", handleScrollEvent, { capture: true });
    };
  }, []);

  return null;
}
