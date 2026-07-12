import { createContextId } from "@builder.io/qwik";

export interface WorldMapContext {
  dotDiameter: number;
}

export const WorldMapContext = createContextId<WorldMapContext>("world-map");
