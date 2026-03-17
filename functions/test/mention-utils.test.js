const test = require("node:test");
const assert = require("node:assert/strict");
const { detectProgramMentions } = require("../mention-utils");

test("single-word program is ignored without program keywords", () => {
  const lookup = new Map([
    ["english", { name: "English" }],
  ]);

  const mentions = detectProgramMentions(
    "I enjoy English literature and writing in general.",
    lookup
  );

  assert.equal(mentions.length, 0);
});

test("single-word program is detected with nearby program keyword", () => {
  const lookup = new Map([
    ["english", { name: "English" }],
  ]);

  const mentions = detectProgramMentions(
    "I am an English major and need advising help.",
    lookup
  );

  assert.equal(mentions.length, 1);
  assert.equal(mentions[0].name, "English");
});

test("multi-word programs are detected without keyword gate", () => {
  const lookup = new Map([
    ["creative writing", { name: "Creative Writing" }],
  ]);

  const mentions = detectProgramMentions(
    "Creative Writing looks like a good fit for me.",
    lookup
  );

  assert.equal(mentions.length, 1);
  assert.equal(mentions[0].name, "Creative Writing");
});
