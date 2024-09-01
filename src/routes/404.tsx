// Copyright (c) 2023 Daniel van Dijk (https://daniel.vandijk.sh)
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.

import type { QwikJSX } from "@builder.io/qwik";
import { component$ } from "@builder.io/qwik";
import type { DocumentHead } from "@builder.io/qwik-city";

import { CenteredTitle } from "src/components/centered-title";

export default component$((): QwikJSX.Element => {
  return <CenteredTitle title="404" subtitle="This page doesn't exist." />;
});

export const head: DocumentHead = {
  title: "Daniel van Dijk - Not Found",
};
