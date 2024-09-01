// Copyright (c) 2023 Daniel van Dijk (https://daniel.vandijk.sh)
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.

import type { QwikJSX } from "@builder.io/qwik";
import { component$ } from "@builder.io/qwik";
import { Link } from "@builder.io/qwik-city";

export const NavigationHeaderName = component$((): QwikJSX.Element => {
  return (
    <Link id="header-name" href="/" prefetch>
      <h2>aniel van Dijk</h2>
    </Link>
  );
});
