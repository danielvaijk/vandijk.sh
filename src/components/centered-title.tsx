// Copyright (c) 2023 Daniel van Dijk (https://daniel.vandijk.sh)
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.

import type { QwikJSX } from "@builder.io/qwik";
import { component$, useStylesScoped$ } from "@builder.io/qwik";

import styles from "src/components/centered-title.scss?inline";

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
