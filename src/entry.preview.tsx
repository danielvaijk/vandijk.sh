import { createQwikCity } from "@builder.io/qwik-city/middleware/node";
// eslint-disable-next-line import/no-unresolved -- Doesn't work well with declared modules.
import qwikCityPlan from "@qwik-city-plan";

import render from "src/entry.ssr";

export default createQwikCity({ qwikCityPlan, render });
