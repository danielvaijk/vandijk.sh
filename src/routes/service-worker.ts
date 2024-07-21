import { setupServiceWorker } from "@builder.io/qwik-city/service-worker";

declare const serviceWorker: ServiceWorkerGlobalScope;

setupServiceWorker();

// eslint-disable-next-line @typescript-eslint/no-misused-promises -- Qwik's design...
addEventListener("install", async (): Promise<void> => serviceWorker.skipWaiting());
// eslint-disable-next-line @typescript-eslint/no-misused-promises -- Qwik's design...
addEventListener("activate", async (): Promise<void> => serviceWorker.clients.claim());
