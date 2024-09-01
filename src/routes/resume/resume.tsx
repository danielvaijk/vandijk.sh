// Copyright (c) 2023 Daniel van Dijk (https://daniel.vandijk.sh)
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.

import type { QwikJSX } from "@builder.io/qwik";
import { useStylesScoped$ } from "@builder.io/qwik";
import { component$ } from "@builder.io/qwik";

import { ResumeExperienceItem } from "src/components/resume/resume-experience-item";
import { ResumeSection } from "src/components/resume/resume-section";
import styles from "src/routes/resume/resume.scss?inline";

interface ResumeProps {
  showFull?: boolean;
}

export const Resume = component$<ResumeProps>(({ showFull = false }): QwikJSX.Element => {
  useStylesScoped$(styles);

  return (
    <div class="resume">
      <p class="resume-intro">
        Dynamic and multidisciplinary <strong>Senior Software Engineer</strong> with over a decade
        of hands-on experience in Game, Software, and Web development; across a diverse variety of
        tech stacks, business domains, and industrial sectors. Known for leading high-impact
        initiatives, driving technological advancements, and making open-source contributions.
      </p>

      <ResumeSection title="Areas of Expertise" withSplitColumns>
        <li>Software Architecture Design</li>
        <li>API Development & Management</li>
        <li>DevOps Practices</li>
        <li>Technical Project Leadership</li>
        <li>Performance Engineering</li>
        <li>Software Development Lifecycle</li>
        <li>Data Structures & Algorithms</li>
        <li>Full-Stack Development</li>
        <li>Testing & Quality Assurance</li>
        <li>Research & Development</li>
        <li>Cloud Computing</li>
        <li>Database Management</li>
        <li>System Optimization</li>
        <li>Agile Methodologies</li>
        <li>Team Development</li>
      </ResumeSection>

      <ResumeSection title="Technical Proficiencies" withoutBulletPoints>
        <li>
          <strong>Runtimes:</strong> Node.js | <strong>Languages:</strong> JavaScript, TypeScript,
          Java, Rust, Go, SQL, PHP, C#, C++, Bash, Liquid | <strong>Frameworks:</strong> React.js,
          Express.js, Next.js, Spring, Qwik, jQuery, Windows SDK, Windows Forms (WinForms) |{" "}
          <strong>Databases:</strong> PostgreSQL, DynamoDB, MongoDB, MySQL | <strong>Cloud:</strong>{" "}
          Docker, Kubernetes, Apache Kafka, Cloudflare, AWS | <strong>Testing:</strong> Jest,
          Vitest, Cypress, Playwright | <strong>Tools:</strong> Git, GitHub, GitLab, Unity Engine,
          Jenkins | <strong>Operating Systems:</strong> macOS, Windows, Linux
        </li>
      </ResumeSection>

      <ResumeSection title="Key Projects">
        <li>
          <strong>
            <a href="https://github.com/danielvaijk/breakpoint">Breakpoint (2024)</a>:
          </strong>{" "}
          A linter that statically analyzes public APIs to catch breaking changes, written in{" "}
          <strong>Rust</strong>.
        </li>
        <li>
          <strong>
            <a href="https://github.com/danielvaijk/synctivity">Synctivity (2024)</a>:
          </strong>{" "}
          A tool that aggregates Git contribution activity across devices and repositories, written
          in <strong>Rust</strong>.
        </li>
        <li>
          <strong>
            <a href="https://github.com/danielvaijk/vandijk.sh">vandijk.sh (2023)</a>:
          </strong>{" "}
          A static portfolio website and blog built with <strong>TypeScript</strong>,{" "}
          <strong>Node.js</strong>, <strong>Qwik</strong>, and the <strong>Notion API</strong>.
        </li>
        <li>
          <strong>
            <a href="https://github.com/danielvaijk/ev3-controller">EV3 Controller (2017)</a>:
          </strong>{" "}
          A GUI Windows program to remotely control a EV3 Mindstorm AGV via bluetooth, built with{" "}
          <strong>C#</strong> and <strong>WinForms</strong>.
        </li>
        <li>
          <strong>
            <a href="https://github.com/danielvaijk/verb-tetris">Verb Tetris (2013)</a>:
          </strong>{" "}
          A Tetris-inspired 2D game for a grammar High School project, written in{" "}
          <strong>C#</strong> powered by the <strong>Unity Engine</strong>.
        </li>
      </ResumeSection>

      <ResumeSection title="Professional Experience">
        <ResumeExperienceItem
          name="Adidas"
          location="Hybrid (Amsterdam, Netherlands)"
          position="Software Engineer II, Web Frameworks & Tooling"
          duration="Aug. 2023 - Present"
          description="Responsible for developing libraries and frameworks to streamline developer productivity across 20 engineering teams, building core systems and APIs that provide a foundation to other crucial services, and improving Jenkins CI/CD pipelines and DevOps processes."
          achievements={
            showFull
              ? [
                  "Spearheaded the buy-in of Go as a viable alternative to TypeScript and Node.js for REST APIs.",
                  "Optimized billions of daily requests by building a Go REST API with PostgreSQL and Apache Kafka for traffic routing.",
                  "Invented and open-sourced a CLI tool; enabling library developers to catch breaking changes to public APIs, called Breakpoint.",
                ]
              : []
          }
        />

        <ResumeExperienceItem
          name="Adidas"
          location="Hybrid (Amsterdam, Netherlands)"
          position="Software Engineer, 3rd Party Tools"
          duration="Dec. 2022 - Jul. 2023"
          description="Responsible for vendor integrations on the website spanning a wide array of critical capabilities such as Search, A/B Testing, Personalization, Recommendations, Reviews, Analytics, and Data Collection;  including the development of full-stack integrations and reusable libraries."
          achievements={
            showFull
              ? [
                  "Solved longstanding personalization performance challenges by designing a page rendering engine that made 1:1 pages scalable.",
                  "Created, and proved the feasibility of, a €2.6M annual savings opportunity by driving a multi-department vendor replacement effort that led to the creation of a fully-featured back-end prototype built with Java, Spring, PostgreSQL, and DynamoDB.",
                  "Boosted engineering productivity across 20 teams by developing React-based frameworks for A/B Testing and Data Collection.",
                ]
              : []
          }
        />

        <ResumeExperienceItem
          name="Adidas"
          location="Hybrid (Amsterdam, Netherlands)"
          position="Software Engineer, Campaign & Storytelling"
          duration="Jul. 2021 - Nov. 2022"
          description="Responsible for mantaining key landing pages, like the homepage, including delivering improvements to page rendering performance, personalization, and overall design and UX. Worked on automating and streamlining content creation, curation, and presentation."
          achievements={
            showFull
              ? [
                  "Increased homepage-to-product CTR ratios and conversion rates by pioneering a Node.js recommendation enrichment gateway REST API.",
                  "Automated the curation of category recommendations, reducing operational overhead by 100% and increasing homepage content relevancy.",
                ]
              : []
          }
        />

        <ResumeExperienceItem
          name="Bunq"
          location="Amsterdam, Netherlands"
          position="Front-end Developer"
          duration="Dec. 2019 - Jun. 2021"
          description="Responsible for maintaining several projects in a diverse front-end stack (jQuery, Backbone.js, Mithril.js, React.js, Semantic UI, etc), developing greenfield projects, carrying out admin duties for bunq.com (main website), together.bunq.com (forum), and maintaining their respective PHP/MySQL back-ends."
          achievements={[
            "Facilitated environmental transparency and engagement by building a dynamic 3D forest visualization React iframe widget.",
            "Simplified bill splitting and payment requests by building a receipt splitting React web app, powered by Machine Learning itemization.",
            "Reduced PR review times by 30% and improved code quality by standardizing Continuous Integration (CI) across 18 front-end projects.",
            "Drastically improved integration management for bunq API developers by building a developer portal with PHP and jQuery.",
          ]}
        />

        <ResumeExperienceItem
          name="Stentorian"
          location="Remote (Netherlands)"
          position="Full-Stack Software Engineer"
          duration="Mar. 2018 - Present"
          description="Developed, marketed, and sold multiple digital products and solutions as an independent developer."
          achievements={[
            "Created Offstage, a multi-app platform for event organizers to manage their ambassadors and event promotion efforts.",
            "Designed, developed, and deployed several static websites, dynamic web applications, and robust back-end solutions for clients.",
            "Streamlined development by designing proprietary front-end and back-end frameworks and libraries.",
          ]}
        />

        <ResumeExperienceItem
          name="JES Pipelines PTE Ltd."
          location="Remote (Netherlands)"
          position="Software Engineer | IT Technician"
          duration="May 2016 - Nov. 2019"
          description="Responsible for developing PowerShell scripts and C#/C++ Windows applications to streamline and automate daily field operations and provide IT support when necessary. Travelled for on-site assignments in the Netherlands, Turkey, Thailand, England, and Spain."
          achievements={[
            "Streamlined weld scan reporting by developing a C++ report generator, reducing task time from hours to minutes.",
            "Automated laptop setup/onboarding with a custom PowerShell script, reducing laptop turnover times by 90%.",
            "Ensured seamless IT operations during critical transition periods through effective support and problem resolution.",
            "Contributed to team readiness and operational efficiency by aiding in recruitment and technical assessments.",
          ]}
        />

        <ResumeExperienceItem
          name="Dimensional Games"
          location="Remote (Santa Terezinha de Itaipu, Brazil)"
          position="Game Developer"
          duration="Feb. 2012 - Apr. 2016"
          description="Developed, marketed, and sold multiple assets written in C# for the Unity Engine as an independent developer."
          achievements={[
            "Facilitated learning Unity's built-in networking frameworks by creating multiple assets, including a multiplayer chat.",
            "Simplified the development of RPG/MMO games by creating an inventory system asset with advanced features like item crafting.",
            "Enabled quick learning & project development by releasing a fully-featured multiplayer first-person shooter template asset.",
          ]}
        />
      </ResumeSection>

      <ResumeSection title="Volunteer Experience" withoutBulletPoints>
        <li>
          <strong>Vice Treasurer</strong> | Interact Club, Rotary International, Santa Terezinha de
          Itaipu, Brazil
        </li>
        <li>
          <strong>Club Member</strong> | Interact Club, Rotary International, Santa Terezinha de
          Itaipu, Brazil
        </li>
      </ResumeSection>

      <ResumeSection title="Education & Credentials" withoutBulletPoints>
        <li>
          <strong>Self-educated</strong> in alignment with the latest industry standards since 2012.
        </li>
        <li>
          <strong>Languages:</strong> English, Native | Portuguese, Native | Dutch, Basic
        </li>
      </ResumeSection>
    </div>
  );
});
