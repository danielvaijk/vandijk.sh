// Copyright (c) 2023 Daniel van Dijk (https://daniel.vandijk.sh)
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.

import type { QwikJSX } from "@builder.io/qwik";
import { component$ } from "@builder.io/qwik";

import { Resume } from "src/routes/resume/resume";

export default component$((): QwikJSX.Element => {
  return <Resume showFull />;
});

export { head } from "../index";
