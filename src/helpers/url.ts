function getRouteFromText(text: string): string {
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

export { getRouteFromText };
