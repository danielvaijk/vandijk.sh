import { component$ } from "@builder.io/qwik";
import { QwikCityProvider } from "@builder.io/qwik-city";
import { DocumentHead } from "./components/document/document-head";
import { DocumentBody } from "./components/document/document-body";

// Qwik will try to inline this file in production mode if the amount
// of CSS is less than 10KB. If the file is larger than 10KB, it will
// be loaded as a separate file.
import "./global.css";

export default component$(() => {
  return (
    <QwikCityProvider>
      <DocumentHead />
      <DocumentBody />
    </QwikCityProvider>
  );
});
