import { component$, useStylesScoped$ } from "@builder.io/qwik";

import styles from "./resume-experience-item.css?inline";

interface ResumeExperienceItemProps {
  company: string;
  location: string;
  position: string;
  duration: string;
  achievements?: Array<string>;
}

export const ResumeExperienceItem = component$<ResumeExperienceItemProps>(
  ({ company, location, position, duration, achievements = [] }) => {
    useStylesScoped$(styles);

    return (
      <li class="resume-experience-item">
        <div class="resume-experience-item-content">
          <div class="resume-experience-item-company">
            <strong>{company}</strong>
            <p>{location}</p>
          </div>

          <div class="resume-experience-item-position">
            <i>{position}</i>
            <i>{duration}</i>
          </div>

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
