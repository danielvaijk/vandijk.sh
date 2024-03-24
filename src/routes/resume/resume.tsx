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
          Dynamic and self-taught <strong>Full-stack Software Engineer</strong> with over a decade
          of hands-on experience across various sectors including sports apparel, banking, and
          technology. Known for leading high-impact projects, driving technological advancements,
          and contributing to open-source communities. Expertise in full-stack development, cloud
          technologies, and creating tools that enhance productivity and performance.
        </li>
      </ResumeSection>

      <ResumeSection title="Areas of Expertise" withSplitColumns>
        <li>Full-stack Development</li>
        <li>Software Development</li>
        <li>Back-end Development</li>
        <li>Performance Optimization</li>
        <li>Project Management</li>
        <li>Continuous Integration (CI)</li>
        <li>Continuous Deployment (CD)</li>
        <li>Technical Writing</li>
        <li>Technical Presentations</li>
        <li>A/B Testing</li>
        <li>Personalization</li>
        <li>Framework Design</li>
        <li>Developer Tooling</li>
        <li>Solution Architecture</li>
        <li>Automated Testing</li>
        <li>Design Systems</li>
        <li>Databases (Relational & NoSQL)</li>
        <li>UI & UX</li>
        <li>R&D</li>
      </ResumeSection>

      <ResumeSection title="Professional Experience">
        <ResumeExperienceItem
          company="adidas"
          location="Amsterdam, Netherlands"
          position="Software Engineer II"
          duration="Oct. 2023 - Present"
          achievements={
            showFull
              ? [
                  "Initiated and orchestrated a multi-team initiative to replace a vendor, resulting in a Java-based back-end prototype worth €2.6M annually.",
                  "Designed a sophisticated page layout engine, enabling 1:1 personalized pages to be served optimally at low cost, solving page rendering and performance blockers.",
                  "Conceived and open-sourced Breakpoint, a unique Rust-based linting tool that flags breaking changes in npm packages through static analysis.",
                ]
              : []
          }
        />

        <ResumeExperienceItem
          company="adidas"
          location="Amsterdam, Netherlands"
          position="Software Engineer"
          duration="Jul. 2021 - Sep. 2023"
          achievements={
            showFull
              ? [
                  "Transformed homepage category recommendations with a new automated system, eliminating operational overhead by 100% and boosting personalization.",
                  "Pioneered a Node.js REST API to deliver personalized product and category recommendations, resulting in a marked increase in CTR ratios and conversion rates.",
                  "Created React packages to handle A/B Testing and Data Collection, increasing productivity across 20 engineering teams.",
                  "Presented various tech talks to hundreds of engineers  in the community on personal endeavors and educational topics like application security.",
                ]
              : []
          }
        />

        <ResumeExperienceItem
          company="bunq"
          location="Amsterdam, Netherlands"
          position="Front-end Developer"
          duration="Dec. 2019 - Jun. 2021"
          achievements={[
            "Standardized & improved tooling and CI/CD across 18+ front-end projects built with varying frameworks like jQuery, Mithril.js, Backbone.js, and React.js.",
            "Created a developer portal with a PHP back-end and jQuery front-end, allowing developers to create bank accounts, manage their integration API keys, and submit apps for review with ease.",
            "Led and coordinated complete redesigns and upgrades of the website (and its various sub-sites) and the forum website, uplifting DX and UX.",
            "Built a React app for automated bill splitting and payment requests, enhancing user financial management capabilities.",
            "Built a React iframe widget that rendered a dynamic 3D terrain with the planted tree counts, allowing users and businesses to visualize and promote their CO2 offset contributions on various websites.",
          ]}
        />

        <ResumeExperienceItem
          company="Stentorian"
          location="Remote"
          position="Software Engineer"
          duration="Mar. 2018 - Present"
          achievements={[
            "Built a comprehensive multi-app web-based event management platform from the ground up, facilitating seamless event promotion and ambassador engagement.",
            "Created an ORM framework for Redux and then a similar one again for MobX, bringing the DX of Object-Relational Mapping to the front-end.",
            "Created a robust logging TypeScript framework that prevents accidental sensitive information leaks — without the uncertainty of pattern matching.",
            "Created a Spring-like REST API framework for Node.js for OOP TypeScript projects, allowing me to quickly create incredibly robust REST APIs.",
          ]}
        />

        <ResumeExperienceItem
          company="JES Pipelines PTE Ltd."
          location="Remote"
          position="Software Engineer"
          duration="May 2016 - Nov. 2019"
          achievements={[
            "Designed a Windows PowerShell automation script to expedite laptop configurations, cutting field operation setup times by 90%.",
            "Developed a Windows C++ application for generating Excel weld inspection reports from scan data, cutting report delivery times from 1-2 days to a few minutes.",
          ]}
        />

        <ResumeExperienceItem
          company="Dimensional Games"
          location="Remote"
          position="3D Game Developer"
          duration="Apr. 2012 - May 2017"
          achievements={[
            "Created a Tetris-based educational game, enhancing learning through interactive play. Built with C# and the Unity Engine.",
            "Created a richly-featured multiplayer first-person shooter game, sold as an Unity Engine C# template project.",
            "Created and sold multiple smaller C# assets for the Unity Engine, demonstrating early entrepreneurial spirit and technical acumen.",
          ]}
        />
      </ResumeSection>

      <ResumeSection title="Technical Skills" withoutBulletPoints>
        <ResumeSkillItem type="Runtimes" examples={["Node.js"]} />
        <ResumeSkillItem
          type="Languages"
          examples={["JavaScript", "TypeScript", "Java", "Go", "Rust", "C#", "C++", "SQL", "PHP"]}
        />
        <ResumeSkillItem
          type="Frameworks"
          examples={["React.js", "jQuery", "Express.js", "Next.js", "Spring Boot", "Qwik"]}
        />
        <ResumeSkillItem
          type="Databases"
          examples={["MongoDB", "PostgreSQL", "DynamoDB", "MySQL"]}
        />
        <ResumeSkillItem
          type="Cloud"
          examples={["DigitalOcean", "Cloudflare", "Docker", "Kubernetes", "AWS", "Apache Kafka"]}
        />
        <ResumeSkillItem type="Testing" examples={["Jest", "Cypress", "Playwright"]} />
        <ResumeSkillItem type="Data Modeling" examples={["Mongoose", "Redux", "MobX"]} />
        <ResumeSkillItem type="Tools" examples={["Git", "Unity Engine", "CraftCMS", "Flarum"]} />
      </ResumeSection>

      <ResumeSection title="Languages" withoutBulletPoints>
        <ResumeSkillItem type="English" examples={["Native"]} />
        <ResumeSkillItem type="Portuguese" examples={["Native"]} />
        <ResumeSkillItem type="Dutch" examples={["Basic"]} />
      </ResumeSection>

      <ResumeSection title="Education" withoutBulletPoints>
        <li>
          Self-educated in software development, consistently updating skills in alignment with the
          latest industry standards since 2012.
        </li>
      </ResumeSection>
    </div>
  );
});
