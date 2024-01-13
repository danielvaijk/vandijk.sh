import { component$ } from "@builder.io/qwik";

interface ResumeSkillItemProps {
  type: string;
  examples: Array<string>;
}

export const ResumeSkillItem = component$<ResumeSkillItemProps>(({ type, examples }) => {
  return (
    <li>
      <strong>{type}: </strong>
      {examples.join(", ")}
    </li>
  );
});
