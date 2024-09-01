// Copyright (c) 2023 Daniel van Dijk (https://daniel.vandijk.sh)
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.

import { $, type QwikJSX, useOnWindow } from "@builder.io/qwik";
import { component$ } from "@builder.io/qwik";
import { RouterOutlet, ServiceWorkerRegister } from "@builder.io/qwik-city";

export const DocumentBody = component$((): QwikJSX.Element => {
  useOnWindow(
    "load",
    $((): void => {
      console.info(
        "Hello there! If you're looking for the source code, you can find it here: https://github.com/danielvaijk/vandijk.sh"
      );
    })
  );

  return (
    <body>
      <RouterOutlet />
      <ServiceWorkerRegister />
    </body>
  );
});
