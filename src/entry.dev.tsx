// Copyright (c) 2023 Daniel van Dijk (https://daniel.vandijk.sh)
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.

import { render, type RenderOptions, type RenderResult } from "@builder.io/qwik";

import Root from "src/root";

export default async function serve(opts: RenderOptions): Promise<RenderResult> {
  return render(document, <Root />, opts);
}
