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
