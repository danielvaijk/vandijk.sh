// Copyright (c) 2023 Daniel van Dijk (https://daniel.vandijk.sh)
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.

const WORDS_PER_MINUTE = 200;

function getWordCount(text: string): number {
  return text.split(" ").length;
}

function getReadTimeInMinutesFromWordCount(wordCount: number): number {
  return Math.ceil(wordCount / WORDS_PER_MINUTE);
}

export { getWordCount, getReadTimeInMinutesFromWordCount };
