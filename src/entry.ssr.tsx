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
  opts.manifest = manifest;

  return renderToStream(<Root />, opts);
}
