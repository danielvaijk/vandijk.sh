import fs from "node:fs";
import path from "node:path";

import type { QwikJSX } from "@builder.io/qwik";
import { component$ } from "@builder.io/qwik";
import { routeLoader$, type DocumentHead, type DocumentHeadValue } from "@builder.io/qwik-city";

import { createPageMetaTags } from "src/helpers/meta";
import { Resume } from "src/routes/resume/resume";
import { redactResumeContactInfo, type ResumeData } from "src/routes/resume/resume-data";

const useResumeData = routeLoader$(async ({ env }): Promise<ResumeData> => {
  const isDeployment = typeof env.get("CF_PAGES") === "string";
  const localResumeRepositoryPath = path.resolve(process.cwd(), "../resume");

  if (!isDeployment && fs.existsSync(localResumeRepositoryPath)) {
    console.log("Fetching resume JSON from file system....");

    const filePath = path.join(localResumeRepositoryPath, "schema.json");
    const dataRaw = fs.readFileSync(filePath, { encoding: "utf8" });

    return redactResumeContactInfo(JSON.parse(dataRaw) as ResumeData);
  }

  const githubAuthToken = env.get("GITHUB_TOKEN");

  if (typeof githubAuthToken === "undefined") {
    throw new Error("GitHub authentication token is missing.");
  }

  console.debug("Fetching resume JSON from GitHub...");

  const githubResumeResponse = await fetch(
    "https://api.github.com/repos/danielvaijk/resume/contents/schema.json?ref=main",
    {
      headers: {
        Accept: "application/vnd.github.v3.raw",
        Authorization: `token ${githubAuthToken}`,
      },
    },
  );

  const responseBody: unknown = await githubResumeResponse.json();

  if (!githubResumeResponse.ok) {
    console.error(responseBody);
    throw new Error("GitHub resume request failed.");
  }

  return redactResumeContactInfo(responseBody as ResumeData);
});

const page = component$((): QwikJSX.Element => {
  const resumeData = useResumeData();

  return <Resume {...resumeData.value} />;
});

const head: DocumentHead = (): DocumentHeadValue => {
  const title = "Daniel van Dijk's Resume";
  const description = "Full-stack Software Engineer, Game Developer, and Writer.";

  return { meta: createPageMetaTags({ description, title }), title };
};

export default page;
export type { ResumeData };
export { head, useResumeData };
