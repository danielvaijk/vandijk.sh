// Copyright (c) 2023 Daniel van Dijk (https://daniel.vandijk.sh)
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.

import { createQwikCity } from "@builder.io/qwik-city/middleware/node";
// eslint-disable-next-line import/no-unresolved -- Doesn't work well with declared modules.
import qwikCityPlan from "@qwik-city-plan";

import render from "src/entry.ssr";

export default createQwikCity({ qwikCityPlan, render });
