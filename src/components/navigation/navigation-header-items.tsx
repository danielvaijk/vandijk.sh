// Copyright (c) 2023 Daniel van Dijk (https://daniel.vandijk.sh)
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.

import type { QwikJSX } from "@builder.io/qwik";
import { $, component$, useOnDocument, useOnWindow, useSignal } from "@builder.io/qwik";
import { Link } from "@builder.io/qwik-city";

import { NavigationHeaderThemeToggle } from "src/components/navigation/navigation-header-theme-toggle";

function isClickOutsideRect(clickEvent: MouseEvent, rect: DOMRect): boolean {
  const { x, y } = clickEvent;

  const isHorizontallyOutside = x < rect.left || x > rect.right;
  const isVerticallyOutside = y < rect.top || y > rect.bottom;

  return isHorizontallyOutside || isVerticallyOutside;
}

export const NavigationHeaderItems = component$((): QwikJSX.Element => {
  const isOpen = useSignal(false);
  const listRef = useSignal<HTMLElement>();
  const hamburgerRef = useSignal<HTMLElement>();

  useOnDocument(
    "click",
    $((clickEvent: MouseEvent): void => {
      const listRefValue = listRef.value;
      const hamburgerRefValue = hamburgerRef.value;

      if (typeof listRefValue === "undefined") {
        return;
      }

      if (typeof hamburgerRefValue === "undefined") {
        return;
      }

      if (!isClickOutsideRect(clickEvent, hamburgerRefValue.getBoundingClientRect())) {
        return;
      }

      if (isClickOutsideRect(clickEvent, listRefValue.getBoundingClientRect())) {
        isOpen.value = false;
      }
    })
  );

  useOnWindow(
    "resize",
    $((): void => {
      if (isOpen.value) {
        isOpen.value = false;
      }
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
        <li class="hide-on-print">
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
        <li class="theme-toggle js-only hide-on-print">
          <NavigationHeaderThemeToggle />
        </li>
      </ul>
    </nav>
  );
});
