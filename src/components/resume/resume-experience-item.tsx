import { component$, useStylesScoped$ } from "@builder.io/qwik";

import styles from "./resume-experience-item.css?inline";

interface ResumeExperienceItemProps {
  name?: string;
  location?: string;
  position?: string;
  duration?: string;
  description: string;
  achievements?: Array<string>;
}

export const ResumeExperienceItem = component$<ResumeExperienceItemProps>(
  ({ name, location, position, duration, description, achievements = [] }) => {
    useStylesScoped$(styles);

    const isAchievementsOnly = !name;
    const locationOrDuration = location ?? duration;
    const hasAchievements = achievements.length > 0;

    return (
      <li
        class={[
          "resume-experience-item",
          isAchievementsOnly && "resume-experience-item-achievements-only",
        ]}
      >
        <div class="resume-experience-item-content">
          <div class="resume-experience-item-name">
            <strong>{name}</strong>
            <p>{locationOrDuration}</p>
          </div>

          {position && (
            <div class="resume-experience-item-position">
              <strong>{position}</strong>
              <strong>{duration}</strong>
            </div>
          )}

          {description && <p class="resume-experience-item-description">{description}</p>}

          {hasAchievements && (
            <i class="resume-experience-item-key-contributions">Key Contributions:</i>
          )}

          {hasAchievements && (
            <ul class="resume-experience-item-achievements">
              {achievements.map((achievement, index) => {
                return <li key={index}>{achievement}</li>;
              })}
            </ul>
          )}
        </div>
      </li>
    );
  }
);
