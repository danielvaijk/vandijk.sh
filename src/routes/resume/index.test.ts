import assert from "node:assert/strict";

import { redactResumeContactInfo, type ResumeData } from "src/routes/resume/resume-data";

const resumeData: ResumeData = {
  awards: [],
  basics: {
    email: "private@example.com",
    label: "Engineer",
    location: {},
    name: "Daniel",
    phone: "+31 6 4148 7488",
    profiles: [],
    summary: "",
  },
  certificates: [],
  education: [],
  expertise: [],
  interests: [],
  languages: [],
  projects: [],
  publications: [],
  references: [],
  skills: [],
  volunteer: [],
  work: [],
};

assert.deepEqual(redactResumeContactInfo(resumeData).basics, {
  ...resumeData.basics,
  email: "<redacted email address>",
  phone: "<redacted phone number>",
});
