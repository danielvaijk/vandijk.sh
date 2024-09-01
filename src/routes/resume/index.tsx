// Copyright (c) 2023 Daniel van Dijk (https://daniel.vandijk.sh)
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.

import type { QwikJSX } from "@builder.io/qwik";
import { component$ } from "@builder.io/qwik";
import type { DocumentHead, DocumentHeadValue } from "@builder.io/qwik-city";

import { createPageMetaTags } from "src/helpers/meta";
import { Resume } from "src/routes/resume/resume";

export default component$((): QwikJSX.Element => {
  return <Resume />;
});

export const head: DocumentHead = (): DocumentHeadValue => {
  const title = "Daniel van Dijk's Resume";
  const description = "Full-stack Software Engineer, Game Developer, and Writer.";

  return { meta: createPageMetaTags({ description, title }), title };
};
