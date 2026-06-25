const REDACTED_EMAIL_ADDRESS = "<redacted email address>";
const REDACTED_PHONE_NUMBER = "<redacted phone number>";

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

const redactResumeContactInfo = (resumeData: ResumeData): ResumeData => ({
  ...resumeData,
  basics: {
    ...resumeData.basics,
    email: REDACTED_EMAIL_ADDRESS,
    phone: REDACTED_PHONE_NUMBER,
  },
});

export type { ResumeData };
export { redactResumeContactInfo };
