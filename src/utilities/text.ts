function getWordCount(text: string): number {
  return text.split(" ").length;
}

function getReadTimeInMinutesFromWordCount(wordCount: number): number {
  return Math.ceil(wordCount / 200);
}

export { getWordCount, getReadTimeInMinutesFromWordCount };
