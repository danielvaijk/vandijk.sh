// Copyright (c) 2023 Daniel van Dijk (https://daniel.vandijk.sh)
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.

import type { QwikJSX } from "@builder.io/qwik";
import { component$ } from "@builder.io/qwik";
import { routeLoader$, type DocumentHead, type DocumentHeadValue } from "@builder.io/qwik-city";

import { createPageMetaTags } from "src/helpers/meta";
import { Resume } from "src/routes/resume/resume";

interface ResumeData {
  awards: Array<{
    awarder: string;
    date: string;
    summary?: string;
    title: string;
  }>;
  basics: {
    email: string;
    label: string;
    location: {
      address?: string;
      city?: string;
      countryCode?: string;
      postalCode?: string;
      region?: string;
    };
    name: string;
    phone?: string;
    profiles: Array<{
      network: string;
      url?: string;
      username: string;
    }>;
    summary: string;
    url?: string;
  };
  certificates: Array<{
    date: string;
    issuer: string;
    name: string;
    url?: string;
  }>;
  education: Array<{
    area: string;
    courses?: Array<string>;
    description?: string;
    endDate?: string;
    gpa?: string;
    institution: string;
    startDate?: string;
    studyType: string;
  }>;
  expertise: Array<{
    areas: Array<string>;
    category: string;
  }>;
  interests: Array<{
    keywords?: Array<string>;
    name: string;
  }>;
  languages: Array<{
    fluency: string;
    language: string;
  }>;
  meta?: {
    canonical?: string;
    lastModified?: string;
    theme?: string;
    version?: string;
  };
  projects: Array<{
    description: string;
    endDate: string;
    entity?: string;
    highlights?: Array<string>;
    keywords?: Array<string>;
    name: string;
    roles?: Array<string>;
    startDate: string;
    type?: string;
    url?: string;
  }>;
  publications: Array<{
    name: string;
    publisher: string;
    releaseDate: string;
    summary?: string;
    website?: string;
  }>;
  references: Array<{
    company?: string;
    name: string;
    position?: string;
    reference: string;
  }>;
  skills: Array<{
    keywords: Array<string>;
    level?: string;
    name: string;
  }>;
  volunteer: Array<{
    endDate?: string;
    highlights?: Array<string>;
    location?: string;
    organization: string;
    position: string;
    startDate?: string;
    summary?: string;
    website?: string;
  }>;
  work: Array<{
    company: string;
    description?: string;
    endDate: string | "Present";
    highlights: Array<string>;
    location?: string;
    position: string;
    startDate: string;
    website?: string;
  }>;
}

const useResumeData = routeLoader$(async ({ env }): Promise<ResumeData> => {
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
    }
  );

  const responseBody: unknown = await githubResumeResponse.json();

  if (!githubResumeResponse.ok) {
    console.error(responseBody);
    throw new Error("GitHub resume request failed.");
  }

  return responseBody as ResumeData;
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
