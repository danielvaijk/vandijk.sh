import { component$, useStylesScoped$ } from "@builder.io/qwik";

import styles from "./resume-experience-item.css?inline";

interface ResumeExperienceItemProps {
  name?: string;
  link?: string;
  location?: string;
  position?: string;
  duration?: string;
  achievements?: Array<string>;
}

export const ResumeExperienceItem = component$<ResumeExperienceItemProps>(
  ({ name, link, location, position, duration, achievements = [] }) => {
    useStylesScoped$(styles);

    const isAchievementsOnly = !name;
    const locationOrDuration = location ?? duration;

    const title = link ? (
      <a target="_blank" rel="noopener noreferrer" href={link}>
        {name}
      </a>
    ) : (
      name
    );

    return (
      <li
        class={[
          "resume-experience-item",
          isAchievementsOnly && "resume-experience-item-achievements-only",
        ]}
      >
        <div class="resume-experience-item-content">
          <div class="resume-experience-item-name">
            <strong>{title}</strong>
            <p>{locationOrDuration}</p>
          </div>

          {position && (
            <div class="resume-experience-item-position">
              <i>{position}</i>
              <i>{duration}</i>
            </div>
          )}

          {achievements.length > 0 && (
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
