import { component$ } from "@builder.io/qwik";
import { RouterOutlet, ServiceWorkerRegister } from "@builder.io/qwik-city";

export const DocumentBody = component$(() => {
  return (
    <body>
      <RouterOutlet />
      <ServiceWorkerRegister />
    </body>
  );
});
