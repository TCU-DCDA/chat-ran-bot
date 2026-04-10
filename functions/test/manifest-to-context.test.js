const test = require("node:test");
const assert = require("node:assert/strict");
const { manifestToContext, extractProgramsForLookup } = require("../manifest-to-context");

test("manifestToContext includes department sections and deduplicates contacts", () => {
  const context = manifestToContext({
    source: "live",
    manifest: {
      department: "English",
      wizardUrl: "https://english.example.edu",
      programs: [
        {
          name: "English",
          degree: "BA",
          totalHours: 33,
          descriptions: ["Program description."],
          requirements: {
            categories: [
              {
                name: "Core",
                hours: 3,
                courses: [{ code: "ENGL 10803", title: "Composition", hours: 3 }],
              },
            ],
          },
          contacts: [{ role: "Advisor", name: "Alex Advisor", email: "alex@tcu.edu" }],
        },
        {
          name: "Writing and Rhetoric",
          degree: "BA",
          totalHours: 33,
          descriptions: ["Second program description."],
          requirements: { categories: [] },
          contacts: [{ role: "Advisor", name: "Alex Advisor", email: "alex@tcu.edu" }],
        },
      ],
      advisingNotes: ["Meet with advisor before registration."],
    },
  });

  assert.match(context, /## English Department Programs/);
  assert.match(context, /Interactive advising wizard: https:\/\/english\.example\.edu/);
  assert.match(context, /### English \(BA, 33 hours\)/);
  assert.match(context, /### English Department Contacts:/);

  const contactMatches = context.match(/alex@tcu\.edu/g) || [];
  assert.equal(contactMatches.length, 1);
});

test("manifestToContext lists every course in a category (no truncation)", () => {
  const courses = Array.from({ length: 25 }, (_, i) => ({
    code: `TEST ${10000 + i}`,
    title: `Course ${i}`,
    hours: 3,
  }));
  const context = manifestToContext({
    source: "live",
    manifest: {
      department: "Test",
      programs: [
        {
          name: "Test",
          degree: "BA",
          totalHours: 33,
          requirements: {
            categories: [{ name: "Big Category", hours: 75, courses }],
          },
        },
      ],
    },
  });

  for (const c of courses) {
    assert.ok(
      context.includes(c.code),
      `expected context to include ${c.code}`
    );
  }
});

test("manifestToContext emits courseCatalog section with descriptions when present", () => {
  const context = manifestToContext({
    source: "live",
    manifest: {
      department: "DCDA",
      programs: [
        {
          name: "DCDA",
          degree: "BA",
          totalHours: 33,
          requirements: { categories: [] },
        },
      ],
      courseCatalog: [
        {
          code: "POSC 31453",
          title: "Data Science and Public Policy",
          hours: 3,
          level: "upper",
          description: "An introduction to the politics and policies of data science.",
        },
      ],
    },
  });

  assert.match(context, /### DCDA Course Catalog:/);
  assert.match(context, /POSC 31453 — Data Science and Public Policy \(3 hrs, upper\)/);
  assert.match(context, /politics and policies of data science/);
});

test("manifestToContext omits courseCatalog section when manifest has none", () => {
  const context = manifestToContext({
    source: "live",
    manifest: {
      department: "English",
      programs: [
        {
          name: "English",
          degree: "BA",
          totalHours: 33,
          requirements: { categories: [] },
        },
      ],
    },
  });

  assert.doesNotMatch(context, /Course Catalog:/);
});

test("manifestToContext truncates long catalog descriptions at 200 chars", () => {
  const longDesc = "x".repeat(300);
  const context = manifestToContext({
    source: "live",
    manifest: {
      department: "Test",
      programs: [{ name: "Test", degree: "BA", totalHours: 33, requirements: { categories: [] } }],
      courseCatalog: [
        { code: "TEST 10000", title: "Long", hours: 3, description: longDesc },
      ],
    },
  });

  assert.match(context, /x{200}\.\.\./);
  assert.doesNotMatch(context, /x{201}/);
});

test("extractProgramsForLookup maps core display fields", () => {
  const result = extractProgramsForLookup({
    wizardUrl: "https://english.example.edu",
    programs: [
      {
        name: "English",
        degree: "BA",
        totalHours: 33,
        descriptions: ["Program description."],
        careerOptions: ["Editor"],
        contacts: [{ role: "Advisor", name: "Alex Advisor", email: "alex@tcu.edu" }],
      },
    ],
  });

  assert.equal(result.length, 1);
  assert.equal(result[0].name, "English");
  assert.equal(result[0].wizardUrl, "https://english.example.edu");
  assert.equal(result[0].description, "Program description.");
  assert.deepEqual(result[0].careerOptions, ["Editor"]);
});
