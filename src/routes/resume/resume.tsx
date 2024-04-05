import { component$, useStylesScoped$ } from "@builder.io/qwik";

import { ResumeSection } from "~/components/resume/resume-section";
import { ResumeExperienceItem } from "~/components/resume/resume-experience-item";

import styles from "./index.css?inline";
import { ResumeSkillItem } from "~/components/resume/resume-skill-item";

interface ResumeProps {
  showFull?: boolean;
}

export const Resume = component$<ResumeProps>(({ showFull = false }) => {
  useStylesScoped$(styles);

  return (
    <div id="resume">
      {showFull && (
        <ResumeSection title="Contact" withoutBulletPoints>
          <ResumeSkillItem type="Email" examples={["daniel@vandijk.sh"]} />
          <ResumeSkillItem type="Phone" examples={["+31 6 4148 7488"]} />
          <ResumeSkillItem type="Location" examples={["Amsterdam, The Netherlands"]} />
        </ResumeSection>
      )}

      <ResumeSection title="Summary" withoutBulletPoints>
        <li>
          Dynamic and multidisciplinary <strong>Senior Full-stack Software Engineer</strong> with
          over a decade of hands-on experience across various stacks, domains, and sectors. Known
          for leading high-impact projects, driving technological advancements, and contributing to
          the open source community.
        </li>
      </ResumeSection>

      <ResumeSection title="Areas of Expertise" withSplitColumns>
        <li>Software Development</li>
        <li>Project Management</li>
        <li>Solution Architecture</li>
        <li>Performance Optimization</li>
        <li>Distributed Systems</li>
        <li>Automated Testing</li>
        <li>Web Applications</li>
        <li>Design Systems</li>
        <li>Object-Oriented Programming</li>
        <li>Relational/NoSQL Databases</li>
        <li>Application Framework Design</li>
        <li>Graphical User Interfaces</li>
        <li>RESTful APIs</li>
        <li>DevOps & CI/CD</li>
        <li>Data Structures & Algorithms</li>
        <li>Dynamic/Static Analysis</li>
        <li>Research & Development</li>
        <li>Technical Writing</li>
        <li>Technical Presentations</li>
        <li>Personalization</li>
        <li>A/B Testing</li>
      </ResumeSection>

      <ResumeSection title="Technical Skills" withoutBulletPoints>
        <ResumeSkillItem type="Runtimes" examples={["Node.js"]} />
        <ResumeSkillItem
          type="Languages"
          examples={["JavaScript", "TypeScript", "Java", "Rust", "Go", "SQL", "PHP", "C#", "C++"]}
        />
        <ResumeSkillItem
          type="Frameworks"
          examples={["React.js", "Express.js", "Next.js", "Spring", "Qwik", "jQuery"]}
        />
        <ResumeSkillItem
          type="Databases"
          examples={["PostgreSQL", "DynamoDB", "MongoDB", "MySQL"]}
        />
        <ResumeSkillItem
          type="Cloud"
          examples={["Docker", "Kubernetes", "AWS", "Apache Kafka", "Cloudflare"]}
        />
        <ResumeSkillItem type="Testing" examples={["Jest", "Vitest", "Cypress", "Playwright"]} />
        <ResumeSkillItem type="Networking" examples={["HTTP", "DNS", "TCP/UDP", "WebSockets"]} />
        <ResumeSkillItem type="Tools" examples={["Git", "Unity Engine"]} />
      </ResumeSection>

      <ResumeSection title="Work Experience">
        <ResumeExperienceItem
          name="adidas"
          location="Amsterdam, Netherlands"
          position="Software Engineer II, Web Frameworks & Tooling"
          duration="Jul. 2021 - Present"
          achievements={
            showFull
              ? [
                  "Built a Go REST API with PostgreSQL and Apache Kafka to manage traffic routing, serving millions of daily website visits and requests.",
                  "Designed a page layout engine that made 1:1 website experiences possible, solving longstanding page rendering and performance blockers related to personalization.",
                ]
              : []
          }
        />

        {showFull && (
          <ResumeExperienceItem
            position="Software Engineer, 3rd Party Tools"
            achievements={[
              "Orchestrated a multi-department effort to replace a vendor, resulting in back-end prototype built with Java, Spring, PostgreSQL, and DynamoDB worth €2.6M annually.",
              "Engineered React frameworks to handle A/B Testing and Data Collection, increasing development productivity across 20 engineering teams.",
              "Pioneered a Node.js REST gateway API to serve product and category recommendations, resulting in a marked increase in CTR ratios and conversion rates.",
            ]}
          />
        )}

        {showFull && (
          <ResumeExperienceItem
            position="Software Engineer, Landing Pages"
            achievements={[
              "Presented various in-person and online tech talks to hundreds of engineers in the community on personal projects and educational topics like application security.",
              "Transformed homepage category recommendations with a new automated system & design, completely eliminating operational overhead while boosting relevancy and UX.",
            ]}
          />
        )}

        <ResumeExperienceItem
          name="bunq"
          location="Amsterdam, Netherlands"
          position="Front-end Developer"
          duration="Dec. 2019 - Jun. 2021"
          achievements={[
            "Built a React iframe widget that rendered a dynamic canvas-drawn 3D terrain with the planted tree counts, allowing users and businesses to visualize and promote their CO2 offset contributions on various websites.",
            "Built a React app that allowed you to upload receipt images, which were automatically itemized by a Machine Learning model, allowing users to easily split bills and send out payment requests to friends and family.",
            "Led and coordinated complete redesigns and upgrades of the CraftCMS website (and its various sub-sites) and the Flarum forum website, uplifting DX and UX.",
            "Standardized & improved tooling and CI/CD across 18+ front-end projects built with varying frameworks like jQuery, Mithril.js, Backbone.js, and React.js, resulting in less mistakes making it past review and hours spent weekly on review reiterations.",
            "Created a developer portal with a PHP back-end and jQuery front-end, allowing developers to create bank accounts and manage their app integrations with ease.",
          ]}
        />

        <ResumeExperienceItem
          name="JES Pipelines PTE Ltd."
          location="Rotterdam, Netherlands"
          position="Software Engineer"
          duration="May 2016 - Nov. 2019"
          achievements={[
            "Flew out to pipeline projects in Turkey and Thailand to gather information daily operations, and to England to collaborate with equipment vendors on software projects.",
            "Developed a GUI Windows C++ application to generate Excel weld inspection reports from ultrasonic scan data, cutting report delivery times from hours down to minutes.",
            "Designed a Windows PowerShell automation script to expedite laptop configurations, cutting field operation setup times by 90%.",
          ]}
        />

        <ResumeExperienceItem
          position="IT Technician"
          achievements={[
            "Assisted with candidate interviews and performed IT support in Spain during transition periods, keeping IT running smoothly.",
            "Solved various technical issues for the IT department, helping unblock initiatives and field operations.",
          ]}
        />
      </ResumeSection>

      <ResumeSection title="Projects">
        <ResumeExperienceItem
          name="Breakpoint"
          link="https://github.com/danielvaijk/breakpoint"
          duration="2024"
          achievements={[
            "A linter that flags breaking changes in npm packages through static analysis, written in Rust.",
          ]}
        />

        <ResumeExperienceItem
          name="Synctivity"
          link="https://github.com/danielvaijk/synctivity"
          duration="2024"
          achievements={[
            "A tool to sync contribution activity between Git developer platforms, written in Rust.",
          ]}
        />

        <ResumeExperienceItem
          name="Engineering Portfolio Website & Blog"
          link="https://github.com/danielvaijk/vandijk.sh"
          duration="2023"
          achievements={[
            "Built with TypeScript, Node.js, Qwik, and the Notion API. Deployed on Cloudflare.",
            "Includes a script that statically generates MDX articles, pulling content from the Notion API.",
            "Includes a script that statically generates optimized AVIF and WebP image variants, including optimal image HTML.",
          ]}
        />

        <ResumeExperienceItem
          name="Photography Portfolio Website (closed source)"
          duration="2022"
          achievements={[
            "A basic portfolio website to showcase photos and information about my photography.",
            "Built with TypeScript, Node.js, Next.js, React, MDX, ImageKit, Formspree, and (initially) DatoCMS.",
            "Domain registration, DNS management, and deployments are done on Cloudflare.",
          ]}
        />

        <ResumeExperienceItem
          name="Node.js Framework (closed source for now)"
          duration="2021"
          achievements={[
            "A Spring-like TypeScript framework for Node.js, allowing developers to quickly create robust REST APIs.",
            "Includes a built-in logging library that makes it impossible to accidentally leak sensitive information.",
            "Includes an intuitive and performant decorator-based (micro) HTTP router.",
          ]}
        />

        <ResumeExperienceItem
          name="Hades"
          link="https://github.com/stentorian-io/hades"
          duration="2020 - 2021"
          achievements={[
            "Create a framework that brings the developer experience of ORMs to front-end state management.",
            "Initially built with JavaScript and Flow for Redux, later rebuilt with TypeScript for MobX.",
          ]}
        />

        <ResumeExperienceItem
          name="Offstage (closed source)"
          duration="2018 - 2021"
          achievements={[
            "A web-based event promotion management platform.",
            "Initially built with JavaScript, Node.js, Express.js, MongoDB, Mongoose, jQuery, Semantic UI, and Pug.",
            "Later rebuilt with TypeScript, Node.js, React, MobX, Tailwind CSS, and custom frameworks and libraries.",
          ]}
        />

        <ResumeExperienceItem
          name="EV3 Mindstorm Controller"
          link="https://github.com/danielvaijk/ev3-controller"
          duration="2017"
          achievements={[
            "A Windows GUI application that remotely controlled an EV3 Mindstorm AGV via bluetooth.",
            "The AGV could be controlled manually, or automatically, where it'd follow a colored path using a light sensor.",
            "Built with C# and Visual Studio's UI XAML designer.",
          ]}
        />

        <ResumeExperienceItem
          name="Wave Survival Multiplayer"
          link="https://github.com/danielvaijk/wave-survival"
          duration="2014 - 2016"
          achievements={[
            "A richly-featured multiplayer first-person shooter (FPS) game sold as a template project.",
            "Built with C# on the Unity Engine.",
          ]}
        />

        <ResumeExperienceItem
          name="Verb Tetris"
          link="https://github.com/danielvaijk/verb-tetris"
          duration="2013"
          achievements={[
            "A Tetris-inspired 2D game created for a Portuguese grammar assignment in High School.",
            "Built with C# on the Unity Engine.",
          ]}
        />
      </ResumeSection>

      <ResumeSection title="Volunteering" withoutBulletPoints>
        <ResumeExperienceItem
          name="Interact Club, Rotary International"
          location="Santa Terezinha de Itaipu, Brazil"
          position="Vice Treasurer"
          duration="Aug. 2014 - Mar. 2016"
          achievements={
            showFull
              ? [
                  "Managed club funds by collecting and submitting dues and reporting on financial statuses.",
                  "Became elected as Vice Treasurer alongside the club's newly elected administration board.",
                ]
              : []
          }
        />

        <ResumeExperienceItem
          position="Club Member"
          achievements={[
            "Helped organize and run a large multi-day event, bringing hundreds of members from clubs within the state of Paraná.",
            "Participated in various social activities and projects, helping local communities and those in need.",
          ]}
        />
      </ResumeSection>

      <ResumeSection title="Languages" withoutBulletPoints>
        <ResumeSkillItem type="English" examples={["Native"]} />
        <ResumeSkillItem type="Portuguese" examples={["Native"]} />
        <ResumeSkillItem type="Dutch" examples={["Basic"]} />
      </ResumeSection>

      <ResumeSection title="Education" withoutBulletPoints>
        <li>Self-educated in alignment with the latest industry standards since 2012.</li>
      </ResumeSection>
    </div>
  );
});
