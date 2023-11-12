import { component$ } from "@builder.io/qwik";
import { QwikCityProvider } from "@builder.io/qwik-city";
import { DocumentHead } from "./components/document/document-head";
import { DocumentBody } from "./components/document/document-body";

import "./global.css";

export default component$(() => {
  return (
    <QwikCityProvider>
      <DocumentHead />
      <DocumentBody />
    </QwikCityProvider>
  );
});
