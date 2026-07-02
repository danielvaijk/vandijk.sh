const WORDS_PER_MINUTE = 200;
const MARKDOWN_CODE_BLOCK_REGEX =
  /(^|\n)[ \t]*(`{3,}|~{3,})[^\n]*\n[\s\S]*?\n[ \t]*\2[ \t]*(?=\n|$)/gu;

function getWordCount(text: string): number {
  const normalizedText = text.trim();

  if (normalizedText.length === 0) {
    return 0;
  }

  return normalizedText.split(/\s+/u).length;
}

function stripMarkdownCodeBlocks(markdown: string): string {
  return markdown.replace(MARKDOWN_CODE_BLOCK_REGEX, "$1");
}

function stripFrontmatter(markdown: string): string {
  return markdown.replace(/^---\n[\s\S]*?\n---\n?/u, "");
}

function stripMarkdownTextSyntax(text: string): string {
  return text
    .replace(/!\[[^\]]*\]\([^)]*\)/gu, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/gu, "$1")
    .replace(/`([^`]+)`/gu, "$1")
    .replace(/[*_~]+/gu, "")
    .replace(/<[^>]+>/gu, " ");
}

function getMarkdownProseText(markdown: string): string {
  const lines = stripMarkdownCodeBlocks(stripFrontmatter(markdown)).split("\n");
  const proseLines = new Array<string>();
  let isInMdxBlock = false;
  let isInMdxExportBlock = false;

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (trimmedLine.length === 0) {
      isInMdxBlock = false;
      isInMdxExportBlock = false;
      continue;
    }

    if (isInMdxBlock || isInMdxExportBlock) {
      continue;
    }

    if (/^import\s/u.test(trimmedLine)) {
      continue;
    }

    if (/^export\s/u.test(trimmedLine)) {
      isInMdxExportBlock = true;
      continue;
    }

    if (/^(?:[-*_]\s*){3,}$/u.test(trimmedLine)) {
      continue;
    }

    if (/^<[A-Za-z][\w.:-]*(?:[\s>/]|$)/u.test(trimmedLine)) {
      isInMdxBlock = !/\/>\s*$|<\/[A-Za-z][\w.:-]*>\s*$/u.test(trimmedLine);
      continue;
    }

    if (/^<\/[A-Za-z][\w.:-]*/u.test(trimmedLine) || /^[{}]/u.test(trimmedLine)) {
      continue;
    }

    proseLines.push(
      stripMarkdownTextSyntax(
        trimmedLine
          .replace(/^#{1,6}\s+/u, "")
          .replace(/^>\s?/u, "")
          .replace(/^\s*(?:[-+*]|\d+[.)])\s+(?:\[[ xX]\]\s+)?/u, ""),
      ),
    );
  }

  return proseLines.join("\n");
}

function getMarkdownProseWordCount(markdown: string): number {
  return getWordCount(getMarkdownProseText(markdown));
}

function getReadTimeInMinutesFromWordCount(wordCount: number): number {
  return Math.ceil(wordCount / WORDS_PER_MINUTE);
}

export {
  getWordCount,
  stripMarkdownCodeBlocks,
  getMarkdownProseWordCount,
  getReadTimeInMinutesFromWordCount,
};
