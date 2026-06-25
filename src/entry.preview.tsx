import { createQwikCity } from "@builder.io/qwik-city/middleware/node";
import qwikCityPlan from "@qwik-city-plan";

import render from "src/entry.ssr";

export default createQwikCity({ qwikCityPlan, render });
