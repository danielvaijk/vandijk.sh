import { render, type RenderOptions, type RenderResult } from "@builder.io/qwik";

import Root from "src/root";

export default async function serve(opts: RenderOptions): Promise<RenderResult> {
  return render(document, <Root />, opts);
}
