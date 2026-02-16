/**
 * Converts wizard manifests into context strings for Sandra's system prompt.
 * Mirrors the format of the existing buildDcdaContext() and hardcoded English
 * context, but generalized from the manifest schema.
 */

/**
 * Convert a manifest result into a context string for the system prompt.
 * @param {{manifest: object, source: string}} manifestData
 * @returns {string}
 */
function manifestToContext(manifestData) {
  const { manifest } = manifestData;

  // Fallback objects from program-data/*.json use a different structure
  if (manifest._isFallback) {
    return buildFallbackContext(manifest);
  }

  const sections = [];

  // Department header
  sections.push(`## ${manifest.department} Department Programs`);
  if (manifest.wizardUrl) {
    sections.push(`Interactive advising wizard: ${manifest.wizardUrl}`);
  }

  // Per-program sections
  for (const program of manifest.programs) {
    sections.push(formatProgram(program));
  }

  // Advising notes
  if (manifest.advisingNotes && manifest.advisingNotes.length > 0) {
    sections.push(`### ${manifest.department} Advising Notes:`);
    sections.push(manifest.advisingNotes.map((n) => `- ${n}`).join("\n"));
  }

  // Contacts (deduplicated across programs)
  const allContacts = deduplicateContacts(manifest.programs);
  if (allContacts.length > 0) {
    sections.push(`### ${manifest.department} Department Contacts:`);
    sections.push(allContacts.map(formatContact).join("\n"));
  }

  return "\n\n" + sections.join("\n\n");
}

/**
 * Format a single program from the manifest into context lines.
 */
function formatProgram(program) {
  const lines = [];
  lines.push(`### ${program.name} (${program.degree}, ${program.totalHours} hours)`);

  if (program.url) {
    lines.push(program.url);
  }

  // Description (first one, truncated)
  if (program.descriptions && program.descriptions.length > 0) {
    const desc = program.descriptions[0];
    lines.push(desc.length > 250 ? desc.substring(0, 250) + "..." : desc);
  }

  // Requirements by category
  if (program.requirements && program.requirements.categories) {
    lines.push("Required categories:");
    for (const cat of program.requirements.categories) {
      const courseList = cat.courses
        .slice(0, 6)
        .map((c) => `${c.code} ${c.title}`)
        .join(", ");
      const note = cat.note ? ` — ${cat.note}` : "";
      lines.push(`- ${cat.name} (${cat.hours} hrs): ${courseList}${note}`);
    }
  }

  // Overlays (English-specific but schema-supported)
  if (program.requirements && program.requirements.overlays) {
    lines.push("Overlay requirements:");
    for (const ov of program.requirements.overlays) {
      const courseList = ov.courses
        .slice(0, 4)
        .map((c) => `${c.code} ${c.title}`)
        .join(", ");
      lines.push(`- ${ov.name} (${ov.hours} hrs): ${courseList}`);
    }
  }

  // Career options
  if (program.careerOptions && program.careerOptions.length > 0) {
    lines.push(`Careers: ${program.careerOptions.join(", ")}`);
  }

  // Internship
  if (program.internship && program.internship.description) {
    const iDesc = program.internship.description;
    lines.push(
      `Internship: ${iDesc.length > 200 ? iDesc.substring(0, 200) + "..." : iDesc}`
    );
  }

  // Highlighted courses for current term
  if (program.highlightedCourses && program.highlightedCourses.courses) {
    const term = program.highlightedCourses.term || "Highlighted";
    lines.push(`${term} Courses:`);
    for (const c of program.highlightedCourses.courses.slice(0, 10)) {
      const schedule = c.schedule ? ` (${c.schedule})` : "";
      lines.push(`- ${c.code} ${c.title}${schedule}`);
    }
  }

  // Program-level note
  if (program.note) {
    lines.push(`Note: ${program.note}`);
  }

  return lines.join("\n");
}

/**
 * Build context from static fallback program-data/*.json files.
 * These use a different structure than manifests (requiredCourses/electiveCourses
 * instead of categories), so we format them like buildProgramDetailsContext does.
 */
function buildFallbackContext(manifest) {
  const sections = manifest.programs.map((p) => {
    const lines = [];
    const degreeStr = p.degree ? `${p.degree}, ` : "";
    lines.push(`### ${p.name} (${degreeStr}${p.totalHours} hours)`);
    if (p.url) lines.push(p.url);

    if (p.descriptions && p.descriptions[0]) {
      const desc = p.descriptions[0];
      lines.push(desc.length > 250 ? desc.substring(0, 250) + "..." : desc);
    }

    const req = p.requirements || {};
    if (req.requiredCourses && req.requiredCourses.courses.length > 0) {
      lines.push(
        `Required (${req.requiredCourses.hours} hrs): ${req.requiredCourses.courses.join(", ")}`
      );
    }
    if (
      req.electiveCourses &&
      (req.electiveCourses.hours > 0 || req.electiveCourses.description)
    ) {
      const desc = req.electiveCourses.description || "See advisor for options";
      lines.push(`Electives (${req.electiveCourses.hours} hrs): ${desc}`);
    }

    if (p.careerOptions && p.careerOptions.length > 0) {
      lines.push(`Careers: ${p.careerOptions.join(", ")}`);
    }

    if (p.contacts && p.contacts.length > 0) {
      const contactLines = p.contacts.map((c) => {
        const parts = [c.role];
        if (c.name) parts.push(c.name);
        if (c.email) parts.push(c.email);
        return `- ${parts.join(", ")}`;
      });
      lines.push(`Contacts:\n${contactLines.join("\n")}`);
    }

    return lines.join("\n");
  });

  return `\n\n## ${manifest.department} Department Programs (fallback)\n\n${sections.join("\n\n")}`;
}

/**
 * Deduplicate contacts across programs in a manifest.
 */
function deduplicateContacts(programs) {
  const seen = new Set();
  const contacts = [];
  for (const p of programs) {
    if (!p.contacts) continue;
    for (const c of p.contacts) {
      const key = `${c.name}|${c.email}`;
      if (!seen.has(key)) {
        seen.add(key);
        contacts.push(c);
      }
    }
  }
  return contacts;
}

/**
 * Format a single contact for context output.
 */
function formatContact(c) {
  const parts = [];
  if (c.role) parts.push(c.role);
  if (c.name) parts.push(c.name);
  if (c.email) parts.push(c.email);
  if (c.phone) parts.push(c.phone);
  if (c.office) parts.push(c.office);
  return `- ${parts.join(", ")}`;
}

/**
 * Extract slim program objects from a manifest for the programLookup Map.
 * Handles both real manifests and fallback objects.
 * @param {object} manifest
 * @returns {Array<{name, degree, totalHours, url, description, careerOptions, contacts, wizardUrl}>}
 */
function extractProgramsForLookup(manifest) {
  return manifest.programs.map((p) => ({
    name: p.name,
    degree: p.degree || "",
    totalHours: p.totalHours || 0,
    url: p.url || manifest.wizardUrl || "",
    description: (p.descriptions && p.descriptions[0]) || "",
    careerOptions: p.careerOptions || [],
    contacts: (p.contacts || []).map((c) => ({
      role: c.role || "",
      name: c.name || "",
      email: c.email || "",
    })),
    wizardUrl: manifest.wizardUrl || "",
  }));
}

module.exports = { manifestToContext, extractProgramsForLookup };
