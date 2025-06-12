// Copyright (c) 2023 Daniel van Dijk (https://daniel.vandijk.sh)
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.

import type { QwikJSX } from "@builder.io/qwik";
import { component$, useStylesScoped$ } from "@builder.io/qwik";

import styles from "src/components/resume/resume-experience-item.scss?inline";

interface ResumeExperienceItemProps {
  achievements?: Array<string>;
  duration?: string;
  location?: string;
  name?: string | null;
  position?: string;
}

export const ResumeExperienceItem = component$<ResumeExperienceItemProps>(
  ({
    achievements = [],
    duration,
    location: experienceLocation,
    name: experienceName,
    position,
  }): QwikJSX.Element => {
    useStylesScoped$(styles);

    const locationOrDuration = experienceLocation ?? duration;

    const hasName = typeof experienceName === "string" && experienceName.length > 0;
    const hasPosition = typeof position === "string" && position.length > 0;

    const renderAchievementsOrNull = (): QwikJSX.Element | null => {
      if (achievements.length > 0) {
        return (
          <ul class="resume-experience-item-achievements">
            {achievements.map((achievement, index): QwikJSX.Element => {
              return <li key={index}>{achievement}</li>;
            })}
          </ul>
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
              {hasName && <strong>{experienceName}</strong>}
              {hasPosition && <p>{position}</p>}
            </div>

            <div>
              {hasName && <strong>{locationOrDuration}</strong>}
              {hasPosition && <i>{duration}</i>}
            </div>
          </div>

          {/* {renderDescriptionOrNull()} */}
          {renderAchievementsOrNull()}
        </div>
      </li>
    );
  }
);
