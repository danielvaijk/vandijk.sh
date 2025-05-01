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
  ({
    basics,
    education = [],
    expertise = [],
    languages,
    projects,
    skills,
    volunteer = [],
    work,
  }): QwikJSX.Element => {
    useStylesScoped$(styles);

    const renderExpertise = (): Array<JSXOutput> => {
      const results: Array<JSXOutput> = [];

      for (const experience of expertise) {
        for (const area of experience.areas) {
          results.push(<li key={area}>{area}</li>);
        }
      }

      return results;
    };

    const renderSkills = (): Array<JSXOutput> => {
      const results: Array<JSXOutput> = [];

      for (const skill of skills) {
        results.push(
          <li key={skill.name}>
            <strong>{skill.name}:</strong> {skill.keywords.join(", ")}
          </li>
        );
      }

      return results;
    };

    const renderProjects = (): Array<JSXOutput> => {
      const results: Array<JSXOutput> = [];

      for (const project of projects) {
        results.push(
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
      }

      return results;
    };

    const renderWorkExperiences = (): Array<JSXOutput> => {
      const results: Array<JSXOutput> = [];

      for (const experience of work) {
        results.push(
          <ResumeExperienceItem
            name={experience.company}
            location={experience.location}
            position={experience.position}
            duration={`${formatDateForDisplay(experience.startDate)} - ${formatDateForDisplay(experience.endDate)}`}
            description={experience.description ?? ""}
            achievements={experience.highlights}
          />
        );
      }

      return results;
    };

    const renderVolunteeringExperiences = (): Array<JSXOutput> => {
      const results: Array<JSXOutput> = [];

      for (const experience of volunteer) {
        results.push(
          <li>
            <strong>{experience.position}</strong> | {experience.organization},{" "}
            {experience.location}
          </li>
        );
      }

      return results;
    };

    const renderEducation = (): JSXOutput => {
      const results: Array<JSXOutput> = [];

      for (const experience of education) {
        results.push(<li>{experience.description}</li>);
      }
      return results;
    };

    const renderLanguages = (): JSXOutput => {
      return (
        <li>
          <strong>Languages:</strong>{" "}
          {languages.map(({ fluency, language }): string => `${language}, ${fluency}`).join("|")}
        </li>
      );
    };

    return (
      <div class="resume">
        <p class="resume-intro">{basics.summary}</p>

        <ResumeSection title="Areas of Expertise" withSplitColumns>
          {renderExpertise()}
        </ResumeSection>

        <ResumeSection title="Technical Proficiencies" withoutBulletPoints>
          {renderSkills()}
        </ResumeSection>

        <ResumeSection title="Key Projects">{renderProjects()}</ResumeSection>
        <ResumeSection title="Professional Experience">{renderWorkExperiences()}</ResumeSection>

        <ResumeSection title="Volunteer Experience" withoutBulletPoints>
          {renderVolunteeringExperiences()}
        </ResumeSection>

        <ResumeSection title="Education & Credentials" withoutBulletPoints>
          {renderEducation()}
          {renderLanguages()}
        </ResumeSection>
      </div>
    );
  }
);
