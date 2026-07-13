import {
  type RenderToStreamOptions,
  type RenderToStreamResult,
  renderToStream,
} from "@builder.io/qwik/server";
import { manifest } from "@qwik-client-manifest";

import Root from "src/root";

export default function serve(opts: RenderToStreamOptions): Promise<RenderToStreamResult> {
  const containerAttributes: Record<string, string> = {
    lang: "en-us",
    prefix: "og: https://ogp.me/ns#",
  };
  const sourceContainerAttributes = opts.containerAttributes;

  if (sourceContainerAttributes) {
    for (const [key, value] of Object.entries(sourceContainerAttributes)) {
      if (typeof value === "string") {
        containerAttributes[key] = value;
      }
    }
  }

  opts.containerAttributes = containerAttributes;
  // The SSG document already embeds the GPU/poster first paint. Keep Qwik's
  // Event loader, but let the core and feature chunks load lazily so they do
  // Not compete with the streamed HTML that produces visible content.
  opts.manifest = { ...manifest, core: undefined };
  opts.preloader = false;

  return renderToStream(<Root />, opts);
}
