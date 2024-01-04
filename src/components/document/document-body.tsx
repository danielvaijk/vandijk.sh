import { component$, useVisibleTask$ } from "@builder.io/qwik";
import { RouterOutlet, ServiceWorkerRegister } from "@builder.io/qwik-city";

export const DocumentBody = component$(() => {
  useVisibleTask$(
    () => {
      console.info(
        "Hello there! If you're looking for the source code, you can find it here: https://github.com/danielvaijk/vandijk.sh"
      );
    },
    {
      strategy: "document-ready",
    }
  );

  return (
    <body>
      <RouterOutlet />
      <ServiceWorkerRegister />
    </body>
  );
});
