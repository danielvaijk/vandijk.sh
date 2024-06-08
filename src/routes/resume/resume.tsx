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
            Dynamic and multidisciplinary <strong>Software Engineer</strong> with over a decade of
            hands-on experience across various stacks, domains, and sectors. Known for leading
            high-impact projects, driving technological advancements, and contributing to the
            open-source community.
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
          Java, Rust, Go, SQL, PHP, C#, C++ | <strong>Frameworks:</strong> React.js, Express.js,
          Next.js, Spring, Qwik, jQuery | <strong>Databases:</strong> PostgreSQL, DynamoDB, MongoDB,
          MySQL | <strong>Cloud:</strong> Docker, Kubernetes, Apache Kafka, Cloudflare, AWS |{" "}
          <strong>Testing:</strong> Jest, Vitest, Cypress, Playwright | <strong>Tools:</strong> Git,
          Unity Engine
        </li>
      </ResumeSection>
      <ResumeSection title="Key Projects">
        <li>
          <strong>
            <a href="https://github.com/danielvaijk/breakpoint">Breakpoint (2024)</a>:
          </strong>{" "}
          Created a linting tool that flags breaking changes through static analysis, written in{" "}
          <strong>Rust</strong>.
        </li>
        <li>
          <strong>
            <a href="https://github.com/danielvaijk/synctivity">Synctivity (2024)</a>:
          </strong>{" "}
          Created a tool that syncs contribution activity between Git developer platforms, written
          in <strong>Rust</strong>.
        </li>
        <li>
          <strong>
            <a href="https://github.com/danielvaijk/vandijk.sh">vandijk.sh (2023)</a>:
          </strong>{" "}
          Built an engineering portfolio and blog using <strong>TypeScript</strong>,{" "}
          <strong>Node.js</strong>, <strong>Qwik</strong>, and the <strong>Notion API</strong>. It
          features a static Notion-to-MDX article generator and a static image optimizer, deployed
          on <strong>Cloudflare</strong>.
        </li>
        <li>
          <strong>Photography Portfolio (2022):</strong> Launched a photography portfolio website to
          exhibit photography work, employing <strong>TypeScript</strong>, <strong>Node.js</strong>,{" "}
          <strong>Next.js</strong>, and various other modern web technologies, managed and deployed
          via <strong>Cloudflare</strong>.
        </li>
        <li>
          <strong>Offstage (2018 - 2021):</strong> Developed a multi-app event promotion management
          platform for event organizers to automate and manage online and offline promotion efforts
          and ambassadors. Initially built with <strong>JavaScript</strong>,{" "}
          <strong>Node.js</strong>, <strong>Express.js</strong>, <strong>MongoDB</strong>,{" "}
          <strong>Mongoose</strong>, <strong>jQuery</strong>, <strong>Semantic UI</strong>, and{" "}
          <strong>Pug.js</strong> and later rebuilt with <strong>TypeScript</strong>,{" "}
          <strong>Node.js</strong>, <strong>React.js</strong>, <strong>MobX</strong>,{" "}
          <strong>Tailwind CSS</strong>, and custom frameworks.
        </li>
        <li>
          <strong>
            <a href="https://github.com/danielvaijk/ev3-controller">
              EV3 Mindstorm Controller (2017)
            </a>
            :
          </strong>{" "}
          Created a GUI application in <strong>C#</strong> for remote control of an EV3 Mindstorm
          AGV, featuring manual and automatic navigation modes via bluetooth connectivity.
        </li>
        <li>
          <strong>
            <a href="https://github.com/danielvaijk/wave-survival">
              Wave Survival Multiplayer (2014 - 2016)
            </a>
            :
          </strong>{" "}
          Developed a fully-featured multiplayer first-person shooter game as a commercial template
          project on the <strong>Unity Engine</strong> using <strong>C#</strong>, enabling other
          developers to quickly learn by example or kickstart game ideas.
        </li>
        <li>
          <strong>
            <a href="https://github.com/danielvaijk/verb-tetris">Verb Tetris (2013)</a>:
          </strong>{" "}
          Designed a Tetris-like 2D game for a High School assignment, created using{" "}
          <strong>C#</strong> and the <strong>Unity Engine</strong>, promoting educational
          engagement through gameplay.
        </li>
      </ResumeSection>

      <ResumeSection title="Professional Experience">
        <ResumeExperienceItem
          name="Adidas"
          location="Amsterdam, Netherlands (Hybrid)"
          position="Software Engineer II, Web Frameworks & Tooling"
          duration="2023 - Present"
          description="Responsible for developing libraries and frameworks to streamline developer productivity across 20 engineering teams, building core systems and APIs that provide a foundation to other crucial services, and improving Jenkins CI/CD pipelines and DevOps processes."
          achievements={
            showFull
              ? [
                  "Spearheaded the buy-in of Go as a viable alternative to TypeScript and Node.js for REST APIs.",
                  "Enhanced traffic handling for millions of daily visitor requests by building a Go REST API with PostgreSQL and Apache Kafka.",
                  "Designed a rendering engine that made 1:1 personalized pages scalable, solving longstanding UX issues and unblocking initiatives.",
                ]
              : []
          }
        />

        <ResumeExperienceItem
          name="Adidas"
          location="Amsterdam, Netherlands (Hybrid)"
          position="Software Engineer, 3rd Party Tools"
          duration="2022 - 2023"
          description="Responsible for several vendor integrations on the website spanning a wide array of features such as Search, A/B Testing, Personalization, Recommendations, Reviews, Analytics, and Data Collection;  including the development of full-stack integrations and reusable libraries."
          achievements={
            showFull
              ? [
                  "Secured annual savings of €2.6M by orchestrating a multi-department vendor replacement effort that led to the creation of a back-end prototype with Java, Spring, PostgreSQL, and DynamoDB.",
                  "Boosted development productivity across 20 engineering teams by engineering React frameworks for A/B Testing and Data Collection.",
                  "Increased CTR ratios and conversion rates by pioneering a Node.js REST gateway API for product and category recommendations.",
                ]
              : []
          }
        />

        <ResumeExperienceItem
          name="Adidas"
          location="Amsterdam, Netherlands (Hybrid)"
          position="Software Engineer, Campaign & Storytelling"
          duration="2021 - 2022"
          description="Responsible for mantaining key landing pages like the homepage, including delivering improvements to page rendering performance, personalization, and overall design and UX. Worked with in-house content publishers to automate and streamline content creation, curation, and presentation."
          achievements={
            showFull
              ? [
                  "Released a first-ever POC on the homepage that validated further rollouts of a new internal personalization architecture created by the Data Science team.",
                  "Completely eliminated the manual curation of category recommendations, reducing operational overhead by 100% and increasing content relevancy for users.",
                ]
              : []
          }
        />

        <ResumeExperienceItem
          name="Bunq"
          location="Amsterdam, Netherlands (On-Site)"
          position="Front-end Developer"
          duration="2019 - 2021"
          description="Responsible for maintaining several projects in a diverse front-end stack (jQuery, Backbone.js, Mithril.js, React.js, Semantic UI, etc), developing greenfield projects, carrying out admin duties for bunq.com (main website), together.bunq.com (forum), and maintaining their respective PHP/MySQL back-ends."
          achievements={[
            "Facilitated environmental transparency and engagement by building a dynamic 3D forest visualization widget.",
            "Simplified bill splitting and payment requests by building a receipt splitting web app with AI-powered itemization.",
            "Led comprehensive website overhauls, markedly enhancing both user and developer experience across multiple platforms.",
            "Reduced PR review time by introducing Continuous Integration (CI) across a diverse variety of 18 front-end projects.",
            "Created a website/portal with PHP and jQuery for integration developers, drastically improving DX for integration creation.",
          ]}
        />

        <ResumeExperienceItem
          name="JES Pipelines PTE Ltd."
          location="Rotterdam, Netherlands (Hybrid)"
          position="Software Engineer | IT Technician"
          duration="2016 - 2019"
          description="Responsible for developing PowerShell scripts and C#/C++ GUI applications for Windows to streamline and automate daily field operations and providing IT support when necessary. Provided global versatility by travelling for multiple on-field assignments in the Netherlands, Turkey, Thailand, England, and Spain."
          achievements={[
            "Streamlined operations and report generation by developing a custom GUI application, reducing process time from hours to minutes.",
            "Enhanced field operation setup efficiency with a custom PowerShell script, reducing setup times by 90%.",
            "Ensured seamless IT operations during critical transition periods through effective support and problem resolution.",
            "Contributed to team readiness and operational efficiency by aiding in recruitment and technical assessments.",
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
