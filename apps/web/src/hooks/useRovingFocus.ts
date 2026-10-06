import { useRef, useState, type KeyboardEvent } from "react";

/**
 * Roving tabindex for a group of buttons: one Tab stop for the whole group, arrow keys
 * (plus Home/End) move between the enabled items. Mark each item with `itemProps(index)`.
 */
export function useRovingFocus<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [active, setActive] = useState(0);

  const onKeyDown = (e: KeyboardEvent<T>) => {
    const items = [...(ref.current?.querySelectorAll<HTMLElement>("[data-roving]:not([disabled])") ?? [])];
    const index = items.indexOf(document.activeElement as HTMLElement);
    if (index === -1 || items.length === 0) return;

    let next: number;
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        next = (index + 1) % items.length;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        next = (index - 1 + items.length) % items.length;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = items.length - 1;
        break;
      default:
        return;
    }
    e.preventDefault();
    items[next]!.focus();
  };

  const itemProps = (index: number) => ({
    "data-roving": "",
    tabIndex: index === active ? 0 : -1,
    onFocus: () => setActive(index),
  });

  return { ref, onKeyDown, itemProps };
}
