const PROGRAM_KEYWORDS_PATTERN = /\b(major|minor|program|degree|BA\b|BS\b|B\.A\.|B\.S\.)/i;

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function detectProgramMentions(text, lookup) {
  const mentions = [];
  for (const [, program] of lookup) {
    const isSingleWord = program.name.split(/\s+/).length === 1;
    const pattern = new RegExp(`\\b${escapeRegex(program.name)}\\b`, "i");
    const match = pattern.exec(text);

    if (!match) continue;

    if (isSingleWord) {
      const start = Math.max(0, match.index - 80);
      const end = Math.min(text.length, match.index + match[0].length + 80);
      const context = text.substring(start, end);
      if (!PROGRAM_KEYWORDS_PATTERN.test(context)) continue;
    }

    mentions.push(program);
  }
  return mentions;
}

module.exports = {
  PROGRAM_KEYWORDS_PATTERN,
  escapeRegex,
  detectProgramMentions,
};
