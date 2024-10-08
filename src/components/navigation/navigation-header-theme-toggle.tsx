// Copyright (c) 2023 Daniel van Dijk (https://daniel.vandijk.sh)
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.

import { component$, type QwikJSX } from "@builder.io/qwik";

export const NavigationHeaderThemeToggle = component$((): QwikJSX.Element => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      stroke-width={2}
      stroke="var(--text-color)"
      class="clickable"
      width="24"
      height="24"
      onClick$={(): void => {
        const theme = document.documentElement.className;

        if (theme === "light") {
          document.documentElement.className = "dark";
          localStorage.setItem("theme", "dark");
        } else {
          document.documentElement.className = "light";
          localStorage.setItem("theme", "light");
        }
      }}
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z"
      />
    </svg>
  );
});
