function slugify(text: string): string {
  return (
    text
      .trim()
      .toLowerCase()
      // Replace all spaces with a dash.
      .replace(/\s+/g, "-")
      // Replace all non-word characters.
      .replace(/[^\w\\-]+/g, "")
      // Collapse repeated dashes.
      .replace(/\\-\\-+/g, "-")
  );
}

function joinPathNames(...segments: Array<string>): string {
  let result = "";

  for (const segment of segments) {
    const partToAdd = segment.startsWith("/") ? segment.slice(1) : segment;

    if (result.endsWith("/")) {
      result += partToAdd;
    } else if (result.length === 0) {
      result += partToAdd;
    } else {
      result += "/" + partToAdd;
    }
  }

  return result;
}

function determineOriginUrl(): string {
  const { CF_PAGES_BRANCH, CF_PAGES_URL, PREVIEW_BUILD } = process.env;

  if (CF_PAGES_BRANCH === "main") {
    return "https://daniel.vandijk.sh";
  } else if (CF_PAGES_URL) {
    return CF_PAGES_URL;
  } else if (PREVIEW_BUILD) {
    return "http://localhost:4173";
  } else {
    return "http://localhost:5173";
  }
}

export { slugify, joinPathNames, determineOriginUrl };
