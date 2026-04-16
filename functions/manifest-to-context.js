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

  // Full course catalog (not every wizard emits one)
  if (manifest.courseCatalog && manifest.courseCatalog.length > 0) {
    sections.push(`### ${manifest.department} Course Catalog:`);
    sections.push(manifest.courseCatalog.map(formatCatalogCourse).join("\n"));
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

  // Highlighted courses: either an array of {term, courses} (current shape,
  // one entry per upcoming term) or a single {term, courses} object (legacy).
  // The converter handles both so Sandra stays compatible during rollout.
  if (program.highlightedCourses) {
    const termGroups = Array.isArray(program.highlightedCourses)
      ? program.highlightedCourses
      : [program.highlightedCourses];

    for (const group of termGroups) {
      if (!group || !Array.isArray(group.courses)) continue;
      const term = group.term || "Highlighted";
      const seen = new Set();
      const unique = group.courses.filter((c) => {
        if (seen.has(c.code)) return false;
        seen.add(c.code);
        return true;
      });
      if (unique.length === 0) continue;
      lines.push(`${term} Courses (${unique.length} unique):`);
      for (const c of unique) {
        const meta = [];
        if (c.schedule) meta.push(c.schedule);
        if (c.modality) meta.push(c.modality);
        const suffix = meta.length > 0 ? ` — ${meta.join(", ")}` : "";
        lines.push(`- ${c.code} ${c.title}${suffix}`);
      }
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
 * Format a single course from manifest.courseCatalog for context output.
 */
function formatCatalogCourse(c) {
  const levelPart = c.level ? `, ${c.level}` : "";
  const header = `- ${c.code} — ${c.title} (${c.hours} hrs${levelPart})`;
  if (!c.description) return header;
  const desc =
    c.description.length > 200
      ? c.description.substring(0, 200) + "..."
      : c.description;
  return `${header}: ${desc}`;
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
