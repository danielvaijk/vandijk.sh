// Copyright (c) 2023 Daniel van Dijk (https://daniel.vandijk.sh)
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.

import type { QwikJSX } from "@builder.io/qwik";
import { component$ } from "@builder.io/qwik";
import { QwikCityProvider } from "@builder.io/qwik-city";

import { DocumentBody } from "src/components/document/document-body";
import { DocumentHead } from "src/components/document/document-head";

// Qwik will try to inline this file in production mode if the amount
// of CSS is less than 10KB. If the file is larger than 10KB, it will
// be loaded as a separate file.
import "src/global.scss";

export default component$((): QwikJSX.Element => {
  return (
    <QwikCityProvider>
      <DocumentHead />
      <DocumentBody />
    </QwikCityProvider>
  );
});
