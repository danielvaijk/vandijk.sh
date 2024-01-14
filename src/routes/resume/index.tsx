import { component$, useStylesScoped$ } from "@builder.io/qwik";
import type { DocumentHead } from "@builder.io/qwik-city";

import { ResumeSection } from "~/components/resume/resume-section";
import { ResumeExperienceItem } from "~/components/resume/resume-experience-item";
import { createPageMetaTags } from "~/helpers/meta";

import styles from "./index.css?inline";
import { ResumeSkillItem } from "~/components/resume/resume-skill-item";

export default component$(() => {
  useStylesScoped$(styles);

  return (
    <div id="resume">
      <ResumeSection title="education" withoutBulletPoints>
        <p>Completely self-taught since 2012.</p>
      </ResumeSection>

      <ResumeSection title="experience">
        <ResumeExperienceItem
          company="adidas"
          location="Amsterdam, Netherlands"
          position="Software Engineer II"
          duration="Oct. 2023 - Present"
        />

        <ResumeExperienceItem
          company="adidas"
          location="Amsterdam, Netherlands"
          position="Software Engineer"
          duration="Jul. 2021 - Sep. 2023"
        />

        <ResumeExperienceItem
          company="bunq"
          location="Amsterdam, Netherlands"
          position="Front-end Developer"
          duration="Dec. 2019 - Jun. 2021"
          achievements={[
            "Improved the features, best practices, architecture, static analysis, tech stacks, and CI/CD across several (~18) front-end projects. This included working with a diverse range of front-end frameworks, like Backbone.js, Mithril.js, React, and jQuery; and design systems like Semantic UI.",
            "Created many subsites under the main website (bunq.com) using jQuery and PHP: a Developer Portal where developers working with the bunq API could register a (bare-bones) bank account, log in, and manage their application OAuth credentials; and another where you could see all the donation initiatives created by users, including donation goals, progress, story, and links to donate.",
            "Carried out admin duties on the website (bunq.com) such as managing user access and permissions, configurations, plugins, page structures, component schemas, and more in CraftCMS. Similar was also done for the forum website in Flarum, though less frequently.",
            "Made several improvements to the Flarum-based forum (including a WebView used by the banking apps): completed a large Flarum upgrade and UI redesign, added the ability to Google Translate posts, and made other general improvements to the PHP back-end and Mithril.js front-end.",
            "Built a web app in React where you could upload a photo of a receipt to a proprietary Machine Learning model and it would parse it into individual line items. You could then edit/split the bill and send out payment requests via email, SMS, or in the banking app.",
            "Built an iframe widget with React and a 2D canvas library that made it possible for users to embed a dynamic 3D terrain that displayed the current amount of trees they've planted so far, similar to the forest terrain displayed inside the banking app.",
          ]}
        />

        <ResumeExperienceItem
          company="Stentorian"
          location="Remote"
          position="Self-employed Full-stack Engineer"
          duration="Mar. 2018 - Present"
          achievements={[
            "Built four web apps as part of a product that helped event organizers manage their ambassador promotions: a dashboard where they could manage and keep track of their event promotions and ambassadors, one where invitations could be accepted and managers/ambassadors could register, one where ambassadors could keep track of and submit their promotion tasks, and another where ambassadors could manage their rewards (like event guestlists). The entire project was full-stack with TypeScript, Node.js, PostgreSQL, React, and Tailwind CSS. Any frameworks were built custom and from scratch for the project (see below).",
            "Created an ORM framework for Redux and then a similar one again for MobX. They brought the benefits of Object-Relational Mapping to the front-end.",
            "Created a robust logging framework that prevents accidental sensitive information leaks — without the uncertainty of pattern matching.",
            "Created a Spring-like REST API framework for Node.js for OOP TypeScript projects, which acted as a thin wrapper that added basic routing, comprehensive error handling, request processing and response creation features. It allowed me to create incredibly robust REST APIs.",
            "Created an incredibly comprehensive linting and formatting configuration and tool belt to apply strict guidelines and best practices. It was packaged in a way that made it easy to use in all my projects to maintain consistent quality control.",
          ]}
        />

        <ResumeExperienceItem
          company="JES Pipelines PTE Ltd."
          location="Remote"
          position="IT & Software Engineering"
          duration="May 2016 - Nov. 2019"
          achievements={[
            "Wrote small GUI programs in C# to help with repetitive tasks, such as calculating Snell's law.",
            "Helped the IT department troubleshoot and solve a broad range of technical issues and challenges. Occasionally filled in for day-to-day operations.",
            "Traveled internationally to visit on-site projects in Thailand and Turkey, help with IT operations in Spain, and meet with vendors in England.",
            "Wrote an all-in-one laptop setup PowerShell script to automate getting new or formatted HP ZBook laptops ready for use out in the field, which included installing software, setting up various configurations, and uninstalling bloatware that came pre-installed on the laptop (which sometimes caused technical issues).",
            "Developed a Windows program in C++ to generate Excel reports from interpreted ultrasonic scan files saved from TD-Scan, for daily use by operators in pipeline projects. The Graphical User Interface (GUI) was written by hand using the Windows SDK.",
          ]}
        />

        <ResumeExperienceItem
          company="Dimensional Games"
          location="Remote"
          position="3D Game Developer"
          duration="Apr. 2012 - May 2017"
          achievements={[
            "Created a Tetris-inspired game in C# with the Unity Engine, where you had letters falling down and had to correctly build conjugated verbs in Portuguese.",
            "Created several Unity Engine assets developed in C# for sale: a fully-featured inventory system with a GUI, example implementations of different networking systems and frameworks, a multiplayer GUI chat system, and a multiplayer wave survival FPS inspired by Call of Duty's zombie mode.",
            "Created a C# Windows program in Visual Studio to control a Lego Mindstorms automated guided vehicle (AGV) via bluetooth.",
          ]}
        />
      </ResumeSection>

      <ResumeSection title="skills" withoutBulletPoints>
        <ResumeSkillItem type="Runtimes" examples={["Node.js"]} />
        <ResumeSkillItem
          type="Languages"
          examples={[
            "C#",
            "C++",
            "HTML",
            "CSS",
            "SCSS",
            "PHP",
            "SQL",
            "Bash",
            "JavaScript",
            "TypeScript",
            "Java",
          ]}
        />
        <ResumeSkillItem
          type="Databases"
          examples={["MongoDB", "MySQL", "PostgreSQL", "DynamoDB"]}
        />
        <ResumeSkillItem
          type="Frameworks"
          examples={["jQuery", "React", "Express.js", "Next.js", "Spring Boot", "Qwik"]}
        />
        <ResumeSkillItem type="Design Systems" examples={["Semantic UI", "Tailwind CSS"]} />
        <ResumeSkillItem type="Testing" examples={["Jest", "Cypress", "Playwright"]} />
        <ResumeSkillItem type="Data Modeling" examples={["Mongoose", "Redux", "MobX"]} />
        <ResumeSkillItem
          type="Tools"
          examples={["Git", "npm", "Yarn", "ESLint", "Prettier", "Maven", "Webpack", "Turbo"]}
        />
        <ResumeSkillItem type="Cloud" examples={["Cloudflare", "Docker", "Kubernetes", "AWS"]} />
        <ResumeSkillItem type="Other" examples={["Unity Engine", "CraftCMS", "Flarum"]} />
      </ResumeSection>
    </div>
  );
});

export const head: DocumentHead = () => {
  const title = "Daniel van Dijk's Resume";
  const description = "Full-stack Software Engineer, Game Developer, and Writer.";

  return { title, meta: createPageMetaTags({ title, description }) };
};
