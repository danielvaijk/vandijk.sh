import type { QwikJSX } from "@builder.io/qwik";
import { component$, useStylesScoped$ } from "@builder.io/qwik";

import styles from "src/components/resume/resume-experience-item.css?inline";

interface ResumeExperienceItemProps {
  achievements?: Array<string>;
  description: string;
  duration?: string;
  location?: string;
  name?: string;
  position?: string;
}

export const ResumeExperienceItem = component$<ResumeExperienceItemProps>(
  ({
    achievements = [],
    description,
    duration,
    location: experienceLocation,
    name: experienceName,
    position,
  }): QwikJSX.Element => {
    useStylesScoped$(styles);

    const isAchievementsOnly = typeof name === "undefined";
    const locationOrDuration = experienceLocation ?? duration;

    const renderPositionOrNull = (): QwikJSX.Element | null => {
      if (typeof position === "string" && position.length > 0) {
        return (
          <div class="resume-experience-item-position">
            <strong>{position}</strong>
            <strong>{duration}</strong>
          </div>
        );
      } else {
        return null;
      }
    };

    const renderDescriptionOrNull = (): QwikJSX.Element | null => {
      if (typeof description === "string" && description.length > 0) {
        return <p class="resume-experience-item-description">{description}</p>;
      } else {
        return null;
      }
    };

    const renderAchievementsOrNull = (): QwikJSX.Element | null => {
      if (achievements.length > 0) {
        return (
          <>
            <i class="resume-experience-item-key-contributions">Key Contributions:</i>
            <ul class="resume-experience-item-achievements">
              {achievements.map((achievement, index): QwikJSX.Element => {
                return <li key={index}>{achievement}</li>;
              })}
            </ul>
          </>
        );
      } else {
        return null;
      }
    };

    return (
      <li
        class={[
          "resume-experience-item",
          isAchievementsOnly && "resume-experience-item-achievements-only",
        ]}
      >
        <div class="resume-experience-item-content">
          <div class="resume-experience-item-name">
            <strong>{experienceName}</strong>
            <p>{locationOrDuration}</p>
          </div>

          {renderPositionOrNull()}
          {renderDescriptionOrNull()}
          {renderAchievementsOrNull()}
        </div>
      </li>
    );
  }
);
