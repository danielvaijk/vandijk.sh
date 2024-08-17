import { $, type QwikJSX, useOnWindow } from "@builder.io/qwik";
import { component$ } from "@builder.io/qwik";
import { RouterOutlet, ServiceWorkerRegister } from "@builder.io/qwik-city";

export const DocumentBody = component$((): QwikJSX.Element => {
  useOnWindow(
    "load",
    $((): void => {
      console.info(
        "Hello there! If you're looking for the source code, you can find it here: https://github.com/danielvaijk/vandijk.sh"
      );
    })
  );

  return (
    <body>
      <RouterOutlet />
      <ServiceWorkerRegister />
    </body>
  );
});
