// Copyright (c) 2023 Daniel van Dijk (https://daniel.vandijk.sh)
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.

import type { QwikJSX } from "@builder.io/qwik";
import { component$ } from "@builder.io/qwik";

import { NavigationHeaderItems } from "src/components/navigation/navigation-header-items";
import { NavigationHeaderName } from "src/components/navigation/navigation-header-name";

export const NavigationHeader = component$((): QwikJSX.Element => {
  return (
    <header>
      <NavigationHeaderName />
      <NavigationHeaderItems />
    </header>
  );
});
