// Copyright (c) 2023 Daniel van Dijk (https://daniel.vandijk.sh)
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.

import type { JSXOutput, QwikJSX } from "@builder.io/qwik";
import { useStylesScoped$ } from "@builder.io/qwik";
import { component$ } from "@builder.io/qwik";

import { ResumeExperienceItem } from "src/components/resume/resume-experience-item";
import { ResumeSection } from "src/components/resume/resume-section";
import type { ResumeData } from "src/routes/resume";
import styles from "src/routes/resume/resume.scss?inline";

function formatDateForDisplay(isoDate: string): string {
  if (isoDate === "Present" || typeof isoDate === "undefined") {
    return isoDate;
  }

  const [year, month] = isoDate.split("-").map((num): number => parseInt(num, 10));
  const date = new Date(year, month - 1, 1);
  const monthName = date.toLocaleString("en-US", { month: "long" });

  return `${monthName} ${year}`;
}

export const Resume = component$<ResumeData>(
  ({ basics, expertise = [], languages, projects, skills, work }): QwikJSX.Element => {
    useStylesScoped$(styles);

    const headerProfileItems: Array<string> = [];
    const renderedCompanies: Record<string, boolean> = {};

    const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

    if (typeof basics.phone === "string" && basics.phone.length > 0) {
      headerProfileItems.push(basics.phone);
    }

    if (typeof basics.email === "string" && basics.email.length > 0) {
      headerProfileItems.push(basics.email);
    }

    if (
      typeof basics.location.city === "string" &&
      basics.location.city.length > 0 &&
      typeof basics.location.countryCode === "string" &&
      basics.location.countryCode.length > 0
    ) {
      headerProfileItems.push(
        [basics.location.city, regionNames.of(basics.location.countryCode)].join(", ")
      );
    }

    if (typeof basics.url === "string" && basics.url.length > 0) {
      headerProfileItems.push(basics.url);
    }

    for (const profile of basics.profiles) {
      if (typeof profile.url === "string" && profile.url.length > 0) {
        headerProfileItems.push(profile.url);
      }
    }

    const hasResumeHeaderName = basics.name.length > 0 && basics.label.length > 0;
    const hasResumeHeader = hasResumeHeaderName || headerProfileItems.length > 0;

    const renderProfileItem = (item: string): JSXOutput => {
      return <p key={item}>{item}</p>;
    };

    const renderExpertise = (area: string): JSXOutput => {
      return <li key={area}>{area}</li>;
    };

    const renderSkill = (skill: ResumeData["skills"][number]): JSXOutput => {
      return (
        <li key={skill.name}>
          <strong>{skill.name}:</strong> {skill.keywords.join(", ")}
        </li>
      );
    };

    const renderProject = (project: ResumeData["projects"][number]): JSXOutput => {
      return (
        <li key={project.name}>
          <strong>
            <a href={project.url}>
              {project.name} ({project.startDate})
            </a>
            :
          </strong>{" "}
          {project.description}
        </li>
      );
    };

    const renderWorkExperience = (experience: ResumeData["work"][number]): JSXOutput => {
      const startDate = formatDateForDisplay(experience.startDate);
      const endDate = formatDateForDisplay(experience.endDate);
      const shouldRenderName = !renderedCompanies[experience.company];

      if (shouldRenderName) {
        renderedCompanies[experience.company] = true;
      }

      return (
        <ResumeExperienceItem
          name={shouldRenderName ? experience.company : null}
          location={experience.location}
          position={experience.position}
          duration={`${startDate} - ${endDate}`}
          achievements={experience.highlights}
        />
      );
    };

    const renderLanguage = ({ fluency, language }: ResumeData["languages"][number]): JSXOutput => (
      <li key={language}>
        <strong>{language}</strong>: {fluency}
      </li>
    );

    return (
      <div class="resume">
        {hasResumeHeader && (
          <div class="resume-header">
            {hasResumeHeaderName && (
              <>
                <div class="resume-header-name">
                  <h1>{basics.name}</h1>
                  <h2>{basics.label}</h2>
                </div>

                <hr />
              </>
            )}

            {headerProfileItems.length > 0 && (
              <>
                <div class="resume-header-profile">{headerProfileItems.map(renderProfileItem)}</div>

                <hr />
              </>
            )}
          </div>
        )}

        {basics.summary.length > 0 && <p class="resume-intro">{basics.summary}</p>}

        {expertise.length > 0 && (
          <ResumeSection title="Areas of Expertise" withSplitColumns>
            {expertise.map(({ areas }): Array<JSXOutput> => areas.map(renderExpertise))}
          </ResumeSection>
        )}

        {skills.length > 0 && (
          <ResumeSection title="Technical Proficiencies" withoutBulletPoints>
            {skills.map(renderSkill)}
          </ResumeSection>
        )}

        {work.length > 0 && (
          <ResumeSection title="Professional Experience">
            {work.map(renderWorkExperience)}
          </ResumeSection>
        )}

        {projects.length > 0 && (
          <ResumeSection title="Key Projects">{projects.map(renderProject)}</ResumeSection>
        )}

        {languages.length > 0 && (
          <ResumeSection title="Languages" withoutBulletPoints>
            {languages.map(renderLanguage)}
          </ResumeSection>
        )}
      </div>
    );
  }
);
