const WORDS_PER_MINUTE = 200;

function getWordCount(text: string): number {
  const normalizedText = text.trim();

  if (normalizedText.length === 0) {
    return 0;
  }

  return normalizedText.split(/\s+/u).length;
}

function stripMarkdownCodeBlocks(markdown: string): string {
  return markdown.replace(
    /(^|\n)[ \t]*(`{3,}|~{3,})[^\n]*\n[\s\S]*?\n[ \t]*\2[ \t]*(?=\n|$)/gu,
    "$1",
  );
}

function getMarkdownProseWordCount(markdown: string): number {
  return getWordCount(stripMarkdownCodeBlocks(markdown));
}

function getReadTimeInMinutesFromWordCount(wordCount: number): number {
  return Math.ceil(wordCount / WORDS_PER_MINUTE);
}

export { getWordCount, getMarkdownProseWordCount, getReadTimeInMinutesFromWordCount };
