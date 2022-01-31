export function capitalize (word: string) {
  return word
    .toLowerCase()
    .replace(/\w/, firstLetter => firstLetter.toUpperCase());
}
