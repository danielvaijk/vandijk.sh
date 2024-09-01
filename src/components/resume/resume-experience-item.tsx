// Copyright (c) 2023 Daniel van Dijk (https://daniel.vandijk.sh)
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.

import type { QwikJSX } from "@builder.io/qwik";
import { component$, useStylesScoped$ } from "@builder.io/qwik";

import styles from "src/components/resume/resume-experience-item.scss?inline";

interface ResumeExperienceItemProps {
  achievements?: Array<string>;
  description: string;
  duration?: string;
  location?: string;
  name: string;
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

    const locationOrDuration = experienceLocation ?? duration;
    const hasPosition = typeof position === "string" && position.length > 0;

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
      <li class="resume-experience-item">
        <div class="resume-experience-item-content">
          <div class="resume-experience-item-header">
            <div>
              <i>{experienceName}</i>
              {hasPosition && <strong>{position}</strong>}
            </div>
            <div>
              <i>{locationOrDuration}</i>
              {hasPosition && <strong>{duration}</strong>}
            </div>
          </div>

          {renderDescriptionOrNull()}
          {renderAchievementsOrNull()}
        </div>
      </li>
    );
  }
);
