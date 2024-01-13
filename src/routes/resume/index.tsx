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
            "Become a mentor after 6 months.",
            "Created a developer portal on the website, including plugins in PHP and front-end in jQuery.",
            "Improved the standards, architecture, static analysis, and CI/CD pipelines of several (~18) front-end projects.",
            "Was the technical owner and admin of the website (bunq.com), maintaining, redesigning, and building new pages and back-end plugins in PHP for CraftCMS.",
            "Completed a full redesign and upgrade of the Flarum-based forum website, including making improvements and adding features to the PHP back-end and the Mithril front-end.",
            "Developed a web app in React for uploading receipts so you could split the bill and send out payment requests.",
            "Developed an iframe widget with React and a 2D canvas library that allowed users to display a 3D terrain with the amount of trees they've planted.",
          ]}
        />

        <ResumeExperienceItem
          company="Stentorian"
          location="Remote"
          position="Self-employed Full-stack Engineer"
          duration="Mar. 2018 - Present"
          achievements={[
            "Built a duo-app web platform to help event organizers manage their ambassador marketing efforts, and ambassadors to manage their tasks and rewards.",
            "Created a ORM framework to facilitate managing model data from back-end responses in the front-end for Redux and then a similar one again for MobX.",
            "Created a Spring-like framework for Node.js for TypeScript Object-oriented Programming.",
            "Created a security-first logger that prevents the leak of sensitive information though logs, without pattern matching.",
          ]}
        />

        <ResumeExperienceItem
          company="JES Pipelines PTE Ltd."
          location="Remote"
          position="IT & Software Engineering"
          duration="May 2016 - Nov. 2019"
          achievements={[
            "Helped the IT department troubleshoot and solve a broad range of technical issues and challenges, including helping with operations from time to time.",
            "Wrote a PowerShell script to automate setting up new HP ZBook laptops for used by operators out in the field, which included installing software, configuring the Windows registry, and uninstalling bloatware.",
            "Developed a Windows program in C++ to generate Excel reports from interpreted ultrasonic scan files from TD-Scan, for daily use by operators in pipeline projects. The Graphical User Interface was written by hand using the Windows SDK.",
          ]}
        />

        <ResumeExperienceItem
          company="Dimensional Games"
          location="Remote"
          position="3D Game Developer"
          duration="Apr. 2012 - May 2017"
          achievements={[
            "Created a Tetris-inspired game in C# with the Unity Engine for conjugating Portuguese verbs for a school project.",
            "Created a Unity Engine asset in C# that provided a fully-featured game inventory system, including a Graphical User Interface.",
            "Created a Unity Engine asset in C# that provided example implementations with different networking systems and frameworks.",
            "Created a Unity Engine asset in C# that provided a multiplayer chat system, including a Graphical User Interface.",
            "Created a First Person Shooter inspired by Call of Duty's zombie mode in C# with the Unity Engine and sold it as an asset.",
            "Created a C# Windows program using Visual Studio to control a Lego Mindstorms automated guided vehicle (AGV) via bluetooth.",
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
          examples={["jQuery", "React", "Express.js", "Next.js", "Jest", "Spring Boot", "Qwik"]}
        />
        <ResumeSkillItem type="Data Modeling" examples={["Mongoose", "Redux", "MobX"]} />
        <ResumeSkillItem
          type="Tools"
          examples={["Git", "npm", "Yarn", "Docker", "Kubernetes", "Maven", "Webpack", "Turbo"]}
        />
        <ResumeSkillItem
          type="Other"
          examples={["Unity Engine", "Cloudflare", "CraftCMS", "Flarum", "AWS"]}
        />
      </ResumeSection>
    </div>
  );
});

export const head: DocumentHead = () => {
  const title = "Daniel van Dijk's Resume";
  const description = "Full-stack Software Engineer, Game Developer, and Writer.";

  return { title, meta: createPageMetaTags({ title, description }) };
};
