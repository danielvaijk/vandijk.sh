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

export { slugify, joinPathNames };
