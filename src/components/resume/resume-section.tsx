import { Slot, component$, useStylesScoped$ } from "@builder.io/qwik";

import styles from "./resume-section.css?inline";

interface ResumeSectionProps {
  title: string;
  withoutBulletPoints?: boolean;
  withSplitColumns?: boolean;
}

export const ResumeSection = component$<ResumeSectionProps>(
  ({ title, withoutBulletPoints = false, withSplitColumns = false }) => {
    useStylesScoped$(styles);

    return (
      <div
        class={[
          "resume-section",
          {
            "resume-section-split-columns": withSplitColumns,
            "resume-section-without-bullet-points": withoutBulletPoints,
          },
        ]}
      >
        <h4>{title.toUpperCase()}</h4>
        <hr />
        <ul>
          <Slot />
        </ul>
      </div>
    );
  }
);
