import { component$, useStylesScoped$ } from "@builder.io/qwik";

import styles from "./resume-skill-item.css?inline";

interface ResumeSkillItemProps {
  type: string;
  examples: Array<string>;
}

export const ResumeSkillItem = component$<ResumeSkillItemProps>(({ type, examples }) => {
  useStylesScoped$(styles);

  return (
    <li class="resume-skill-item">
      <strong>{type}: </strong>
      {examples.join(", ")}
    </li>
  );
});
