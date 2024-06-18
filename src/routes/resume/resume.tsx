import { component$, useStylesScoped$ } from "@builder.io/qwik";

import { ResumeSection } from "~/components/resume/resume-section";
import { ResumeExperienceItem } from "~/components/resume/resume-experience-item";

import styles from "./index.css?inline";

interface ResumeProps {
  showFull?: boolean;
}

export const Resume = component$<ResumeProps>(({ showFull = false }) => {
  useStylesScoped$(styles);

  return (
    <div id="resume">
      <ResumeSection withoutBulletPoints>
        <li>
          <p>
            Dynamic and multidisciplinary <strong>Senior Software Engineer</strong> with over a
            decade of hands-on experience across various stacks, domains, and sectors. Known for
            leading high-impact projects, driving technological advancements, and contributing to
            the open-source community.
          </p>
        </li>
      </ResumeSection>

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
        <li>Innovative Solutions Development</li>
        <li>Cloud Computing</li>
        <li>Database Management</li>
        <li>System Optimization</li>
        <li>Agile Methodologies</li>
        <li>Team Development</li>
      </ResumeSection>

      <ResumeSection title="Technical Proficiencies" withoutBulletPoints>
        <li>
          <strong>Runtimes:</strong> Node.js | <strong>Languages:</strong> JavaScript, TypeScript,
          Java, Rust, Go, SQL, PHP, C#, C++, Bash | <strong>Frameworks:</strong> React.js,
          Express.js, Next.js, Spring, Qwik, jQuery, C++ Windows SDK, Windows Forms (WinForms) |{" "}
          <strong>Databases:</strong> PostgreSQL, DynamoDB, MongoDB, MySQL | <strong>Cloud:</strong>{" "}
          Docker, Kubernetes, Apache Kafka, Cloudflare, AWS | <strong>Testing:</strong> Jest,
          Vitest, Cypress, Playwright | <strong>Tools:</strong> Git, GitLab, Unity Engine, Jenkins |{" "}
          <strong>Operating Systems:</strong> macOS, Windows, Linux
        </li>
      </ResumeSection>

      <ResumeSection title="Key Projects">
        <li>
          <strong>
            <a href="https://github.com/danielvaijk/breakpoint">Breakpoint (2024)</a>:
          </strong>{" "}
          CLI tool written in <strong>Rust</strong> that flags breaking API changes through static
          analysis.
        </li>
        <li>
          <strong>
            <a href="https://github.com/danielvaijk/synctivity">Synctivity (2024)</a>:
          </strong>{" "}
          CLI tool written in <strong>Rust</strong> that syncs contribution activity between Git
          developer platforms.
        </li>
        <li>
          <strong>
            <a href="https://github.com/danielvaijk/vandijk.sh">vandijk.sh (2023)</a>:
          </strong>{" "}
          Engineering portfolio and blog built with <strong>TypeScript</strong>,{" "}
          <strong>Node.js</strong>, <strong>Qwik</strong>, and the <strong>Notion API</strong>. It
          features a static Notion-to-MDX article generator and a static image optimizer, deployed
          on <strong>Cloudflare</strong>.
        </li>
        <li>
          <strong>danielspectre.com (2022):</strong> Photography portfolio website to exhibit
          photography work, employing <strong>TypeScript</strong>, <strong>Node.js</strong>,{" "}
          <strong>Next.js</strong>, and various other modern web technologies, managed and deployed
          via <strong>Cloudflare</strong>.
        </li>
        <li>
          <strong>
            <a href="https://github.com/danielvaijk/ev3-controller">
              EV3 Mindstorm Controller (2017)
            </a>
            :
          </strong>{" "}
          Program built with <strong>WinForms</strong> and <strong>C#</strong> that could control a
          EV3 Mindstorm AGV remotely via bluetooth, featuring manual and automatic navigation modes.
        </li>
        <li>
          <strong>Arma Key Stealer (2012):</strong> Serial key stealer malware disguised as an
          online cheat for Arma 2: Operation Arrowhead, developed with <strong>WinForms</strong> and{" "}
          <strong>Visual Basic</strong>, to counteract and discourage wannabe cheaters.
        </li>
      </ResumeSection>

      <ResumeSection title="Professional Experience">
        <ResumeExperienceItem
          name="Adidas"
          location="Hybrid (Amsterdam, Netherlands)"
          position="Software Engineer II, Web Frameworks & Tooling"
          duration="2023 - Present"
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
          duration="2022 - 2023"
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
          duration="2021 - 2022"
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
          duration="2019 - 2021"
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
          duration="2018 - Present"
          description="Developed, marketed, and sold multiple digital products and solutions as an independent developer."
          achievements={[
            "Improved and optimized REST API development by creating a Spring-like TypeScript framework for Node.js.",
            "Developed Offstage, an online platform for event organizers to manage their ambassadors and event promotion efforts.",
            "Developed a fully custom Shopify store and landing page for a clothing brand with Liquid and React.",
            "Facilitated client-side state management by developing frameworks for Redux and MobX inspired by ORMs.",
          ]}
        />

        <ResumeExperienceItem
          name="JES Pipelines PTE Ltd."
          location="Remote (Netherlands)"
          position="Software Engineer | IT Technician"
          duration="2016 - 2019"
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
          duration="2012 - 2016"
          description="Developed, marketed, and sold multiple assets written in C# for the Unity Engine as an independent developer."
          achievements={[
            "Facilitated learning Unity's built-in networking frameworks by creating multiple assets, including a multiplayer chat.",
            "Simplified the development of RPG/MMO games by creating an inventory system asset with advanced features like item crafting.",
            "Enabled quick learning & project development by releasing a fully-featured multiplayer first-person shooter template asset.",
            "Promoted educational engagement through gameplay by developing a Tetris-inspired 2D game for a grammar High School project.",
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
