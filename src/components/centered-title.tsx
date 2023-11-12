import { component$, useStylesScoped$ } from "@builder.io/qwik";

import styles from "./centered-title.css?inline";

interface CenteredTitleProps {
  title: string;
  subtitle: string;
}

export const CenteredTitle = component$<CenteredTitleProps>(
  ({ title, subtitle }) => {
    useStylesScoped$(styles);

    return (
      <div class="centered-title">
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
    );
  }
);
