const WORDS_PER_MINUTE = 200;

function getWordCount(text: string): number {
  return text.split(" ").length;
}

function getReadTimeInMinutesFromWordCount(wordCount: number): number {
  return Math.ceil(wordCount / WORDS_PER_MINUTE);
}

export { getWordCount, getReadTimeInMinutesFromWordCount };
