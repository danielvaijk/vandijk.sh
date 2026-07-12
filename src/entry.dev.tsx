import { type RenderOptions, type RenderResult, render } from "@builder.io/qwik";

import Root from "src/root";

export default function serve(opts: RenderOptions): Promise<RenderResult> {
  return render(document, <Root />, opts);
}
