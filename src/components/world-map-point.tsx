import { type QwikJSX, component$, useContext } from "@builder.io/qwik";

import { WorldMapContext } from "src/components/world-map-context";

interface WorldMapPointProps {
  delay: number;
  pointX: number;
  pointY: number;
}

export const WorldMapPoint = component$(
  ({ delay, pointX, pointY }: WorldMapPointProps): QwikJSX.Element => {
    const { dotDiameter } = useContext(WorldMapContext);
    const dotRadius = dotDiameter / 2;

    return (
      <g class="world-map__point">
        <circle
          cx={pointX}
          cy={pointY}
          r={dotRadius}
          class="world-map__point-dot"
          style={{ animationDelay: `${delay}s` }}
        />
      </g>
    );
  },
);
