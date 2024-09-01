// Copyright (c) 2023 Daniel van Dijk (https://daniel.vandijk.sh)
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.

import { setupServiceWorker } from "@builder.io/qwik-city/service-worker";

// eslint-disable-next-line @typescript-eslint/no-shadow -- Qwik's design...
declare const self: ServiceWorkerGlobalScope;

setupServiceWorker();

// eslint-disable-next-line @typescript-eslint/no-misused-promises -- Qwik's design...
addEventListener("install", async (): Promise<void> => self.skipWaiting());
// eslint-disable-next-line @typescript-eslint/no-misused-promises -- Qwik's design...
addEventListener("activate", async (): Promise<void> => self.clients.claim());
