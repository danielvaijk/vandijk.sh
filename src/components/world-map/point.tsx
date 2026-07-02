import type { QwikJSX } from "@builder.io/qwik";
import { component$, useContext } from "@builder.io/qwik";

import { WorldMapContext } from "src/components/world-map/context";

interface WorldMapPointProps {
  delay: number;
  x: number;
  y: number;
}

export const WorldMapPoint = component$(({ delay, x, y }: WorldMapPointProps): QwikJSX.Element => {
  const { dotDiameter } = useContext(WorldMapContext);
  const dotRadius = dotDiameter / 2;

  return (
    <g class="world-map__point">
      <circle
        cx={x}
        cy={y}
        r={dotRadius}
        class="world-map__point-dot"
        style={{ animationDelay: `${delay}s` }}
      />
    </g>
  );
});
