import { setupServiceWorker } from "@builder.io/qwik-city/service-worker";

// eslint-disable-next-line @typescript-eslint/no-shadow -- Qwik's design...
declare const self: ServiceWorkerGlobalScope;

setupServiceWorker();

// eslint-disable-next-line @typescript-eslint/no-misused-promises -- Qwik's design...
addEventListener("install", async (): Promise<void> => self.skipWaiting());
// eslint-disable-next-line @typescript-eslint/no-misused-promises -- Qwik's design...
addEventListener("activate", async (): Promise<void> => self.clients.claim());
