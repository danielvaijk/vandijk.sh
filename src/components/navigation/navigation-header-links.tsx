import { $, component$, useOnDocument, useOnWindow, useSignal } from "@builder.io/qwik";
import { Link } from "@builder.io/qwik-city";

export const NavigationHeaderLinks = component$(() => {
  const isOpen = useSignal(false);
  const listRef = useSignal<HTMLElement>();
  const hamburgerRef = useSignal<HTMLElement>();

  useOnDocument(
    "click",
    $((clickEvent: MouseEvent) => {
      if (!listRef.value || !hamburgerRef.value) {
        return;
      }

      const { x, y } = clickEvent;
      const listRect = listRef.value.getBoundingClientRect();
      const hamburgerRect = hamburgerRef.value.getBoundingClientRect();

      const isClickOutsideRect = (rect: DOMRect) => {
        const { left, right, top, bottom } = rect;

        if (x < left || x > right) {
          return true;
        } else if (y < top || y > bottom) {
          return true;
        } else {
          return false;
        }
      };

      if (!isClickOutsideRect(hamburgerRect)) {
        return;
      }

      if (isClickOutsideRect(listRect)) {
        isOpen.value = false;
      }
    })
  );

  useOnWindow(
    "resize",
    $(() => {
      isOpen.value = false;
    })
  );

  return (
    <nav>
      <div
        ref={hamburgerRef}
        class="hamburger clickable"
        onClick$={() => {
          isOpen.value = !isOpen.value;
        }}
      >
        <div></div>
        <div></div>
        <div></div>
      </div>

      <ul ref={listRef} class={isOpen.value ? "is-open" : undefined}>
        <li>
          <Link
            target="_blank"
            rel="noopener noreferrer"
            href="https://github.com/danielvaijk?tab=repositories"
            onClick$={() => {
              isOpen.value = !isOpen.value;
            }}
          >
            Projects
          </Link>
        </li>
        <li>
          <Link
            href="/articles/"
            onClick$={() => {
              isOpen.value = !isOpen.value;
            }}
            prefetch
          >
            Articles
          </Link>
        </li>
        <li>
          <Link
            href="/resume/"
            onClick$={() => {
              isOpen.value = !isOpen.value;
            }}
            prefetch
          >
            Resume
          </Link>
        </li>
        <li>
          <Link
            target="_blank"
            rel="noopener noreferrer"
            href="https://www.linkedin.com/in/daniel-vandijk-sh/"
            onClick$={() => {
              isOpen.value = !isOpen.value;
            }}
          >
            Connect
          </Link>
        </li>
      </ul>
    </nav>
  );
});
