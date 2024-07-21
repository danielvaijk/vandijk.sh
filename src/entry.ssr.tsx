import type { RenderToStreamResult } from "@builder.io/qwik/server";
import { renderToStream, type RenderToStreamOptions } from "@builder.io/qwik/server";
// eslint-disable-next-line import/no-unresolved -- Doesn't work well with declared modules.
import { manifest } from "@qwik-client-manifest";

import Root from "src/root";

export default async function serve(opts: RenderToStreamOptions): Promise<RenderToStreamResult> {
  return renderToStream(<Root />, {
    manifest,
    ...opts,
    containerAttributes: {
      lang: "en-us",
      prefix: "og: https://ogp.me/ns#",
      ...opts.containerAttributes,
    },
  });
}
