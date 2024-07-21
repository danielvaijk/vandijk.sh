import type { QwikJSX } from "@builder.io/qwik";
import { component$, useStylesScoped$ } from "@builder.io/qwik";

import styles from "src/components/centered-title.css?inline";

interface CenteredTitleProps {
  subtitle: string;
  title: string;
}

export const CenteredTitle = component$<CenteredTitleProps>(
  ({ subtitle, title }): QwikJSX.Element => {
    useStylesScoped$(styles);

    return (
      <div class="centered-title">
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
    );
  }
);
