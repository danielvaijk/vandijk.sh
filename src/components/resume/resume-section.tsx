import type { QwikJSX } from "@builder.io/qwik";
import { Slot, component$, useStyles$ } from "@builder.io/qwik";

import styles from "src/components/resume/resume-section.scss?inline";

interface ResumeSectionProps {
  title?: string;
  withSplitColumns?: boolean;
  withoutBulletPoints?: boolean;
}

export const ResumeSection = component$<ResumeSectionProps>(
  ({ title, withSplitColumns = false, withoutBulletPoints = false }): QwikJSX.Element => {
    useStyles$(styles);

    const renderTitleOrNull = (): QwikJSX.Element | null => {
      if (typeof title === "string" && title.length > 0) {
        return (
          <>
            <h4>{title.toUpperCase()}</h4>
            <hr />
          </>
        );
      } else {
        return null;
      }
    };

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
        {renderTitleOrNull()}
        <ul>
          <Slot />
        </ul>
      </div>
    );
  }
);
