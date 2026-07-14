import { type QwikJSX, component$, useStyles$ } from "@builder.io/qwik";

import styles from "src/components/world-map.css?inline";

interface WorldMapProps {
  label: string;
}

const WORLD_MAP_SOURCE = "/blog/why-and-how-i-built-the-blog-youre-reading/world-map.svg";

export const WorldMap = component$(({ label }: WorldMapProps): QwikJSX.Element => {
  useStyles$(styles);

  return (
    <div class="world-map">
      <img
        alt={label}
        class="world-map__svg"
        decoding="async"
        height={467}
        loading="lazy"
        src={WORLD_MAP_SOURCE}
        width={723}
      />
    </div>
  );
});
