/** Build the private source coordinate table once per validation operation. */
export function buildSourceLineIndex(text) {
  const starts = [0], lengths = [];
  for (const match of text.matchAll(/\r\n|\r|\n/gu)) {
    lengths.push(match.index - starts.at(-1));
    starts.push(match.index + match[0].length);
  }
  lengths.push(text.length - starts.at(-1));
  return {starts, lengths};
}
