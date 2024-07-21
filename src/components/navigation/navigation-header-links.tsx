import type { QwikJSX } from "@builder.io/qwik";
import { $, component$, useOnDocument, useOnWindow, useSignal } from "@builder.io/qwik";
import { Link } from "@builder.io/qwik-city";

export const NavigationHeaderLinks = component$((): QwikJSX.Element => {
  const isOpen = useSignal(false);
  const listRef = useSignal<HTMLElement>();
  const hamburgerRef = useSignal<HTMLElement>();

  useOnDocument(
    "click",
    $((clickEvent: MouseEvent): void => {
      if (typeof listRef.value === "undefined") {
        return;
      }

      if (typeof hamburgerRef.value === "undefined") {
        return;
      }

      const { x, y } = clickEvent;
      const listRect = listRef.value.getBoundingClientRect();
      const hamburgerRect = hamburgerRef.value.getBoundingClientRect();

      const isClickOutsideRect = (rect: DOMRect): boolean => {
        if (x < rect.left || x > rect.right) {
          return true;
        }

        if (y < rect.top || y > rect.bottom) {
          return true;
        }

        return false;
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
    $((): void => {
      isOpen.value = false;
    })
  );

  return (
    <nav>
      <div
        ref={hamburgerRef}
        class="hamburger clickable"
        onClick$={(): void => {
          isOpen.value = !isOpen.value;
        }}
      >
        <div></div>
        <div></div>
        <div></div>
      </div>

      <ul ref={listRef} class={isOpen.value ? "is-open" : null}>
        <li>
          <Link
            target="_blank"
            rel="noopener noreferrer"
            href="https://github.com/danielvaijk?tab=repositories"
            onClick$={(): void => {
              isOpen.value = !isOpen.value;
            }}
          >
            Projects
          </Link>
        </li>
        <li>
          <Link
            href="/blog/"
            onClick$={(): void => {
              isOpen.value = !isOpen.value;
            }}
            prefetch
          >
            Blog
          </Link>
        </li>
        <li>
          <Link
            href="/resume/"
            onClick$={(): void => {
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
            onClick$={(): void => {
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
