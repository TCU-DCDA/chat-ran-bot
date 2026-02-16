const fs = require("fs");
const path = require("path");
const Ajv = require("ajv");
const addFormats = require("ajv-formats");
const registry = require("./wizard-registry.json");

// In-memory cache: department -> { manifest, fetchedAt, source }
const memoryCache = new Map();

// Single-flight dedup: department -> Promise
const inflightRefreshes = new Map();

// Constants
const TTL_MS = 60 * 60 * 1000; // 1 hour
const RETRY_DELAY_MS = 5000;
const FETCH_TIMEOUT_MS = 10000;
const SUPPORTED_VERSIONS = ["1.0"];

// Module state
let db = null;
let validateManifest = null;

/**
 * Initialize the manifest loader with Firestore reference.
 * Must be called once at startup.
 * @param {FirebaseFirestore.Firestore} firestoreDb
 */
function initManifestLoader(firestoreDb) {
  db = firestoreDb;

  // Load and compile AJV schema
  const schemaPath = path.join(__dirname, "schemas", "manifest.schema.json");
  const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
  const ajv = new Ajv({ allErrors: true });
  addFormats(ajv);
  validateManifest = ajv.compile(schema);
}

/**
 * Get a manifest for a department. Implements TTL + SWR + fallback chain.
 * @param {string} department - Must match a key in wizard-registry.json
 * @returns {Promise<{manifest: object, source: string} | null>}
 */
async function getManifest(department) {
  const entry = registry.departments[department];
  if (!entry) return null;

  // 1. Check memory cache
  const cached = memoryCache.get(department);
  if (cached) {
    const age = Date.now() - cached.fetchedAt;
    if (age < TTL_MS) {
      // Fresh — return immediately
      return { manifest: cached.manifest, source: "memory" };
    }
    // Stale — return immediately, trigger background refresh (SWR)
    log("ttl_refresh_trigger", {
      department,
      staleDurationMs: age - TTL_MS,
    });
    refreshManifest(department); // non-blocking
    return { manifest: cached.manifest, source: "memory" };
  }

  // 2. Memory miss — try Firestore cache
  const firestoreCached = await readFirestoreCache(department);
  if (firestoreCached) {
    memoryCache.set(department, {
      manifest: firestoreCached.manifest,
      fetchedAt: firestoreCached.fetchedAt,
      source: "firestore",
    });
    // Trigger background refresh regardless of Firestore age (cold-miss refresh)
    refreshManifest(department);
    return { manifest: firestoreCached.manifest, source: "firestore" };
  }

  // 3. All caches empty — synchronous live fetch
  try {
    const manifest = await fetchAndValidate(department);
    if (manifest) {
      memoryCache.set(department, {
        manifest,
        fetchedAt: Date.now(),
        source: "live",
      });
      // Write to Firestore in background (don't block response)
      writeFirestoreCache(department, manifest).catch((err) =>
        log("firestore_write_failure", { department, error: err.message })
      );
      return { manifest, source: "live" };
    }
  } catch (err) {
    log("manifest_fetch_failure", {
      department,
      manifestUrl: entry.manifestUrl,
      error: err.message,
      fallbackSource: "static",
    });
  }

  // 4. All failed — static fallback
  return loadStaticFallback(department);
}

/**
 * Get manifests for all registered departments.
 * @returns {Promise<Map<string, {manifest: object, source: string}>>}
 */
async function getAllManifests() {
  const results = new Map();
  const departments = Object.keys(registry.departments);

  const settled = await Promise.allSettled(
    departments.map(async (dept) => {
      const result = await getManifest(dept);
      if (result) results.set(dept, result);
    })
  );

  // Log any unexpected rejections
  for (let i = 0; i < settled.length; i++) {
    if (settled[i].status === "rejected") {
      log("manifest_fetch_failure", {
        department: departments[i],
        error: settled[i].reason?.message || "Unknown error",
        fallbackSource: "none",
      });
    }
  }

  return results;
}

// --- Internal functions ---

/**
 * Background refresh with single-flight dedup and one retry.
 */
function refreshManifest(department) {
  if (inflightRefreshes.has(department)) {
    return inflightRefreshes.get(department);
  }

  const promise = (async () => {
    try {
      const manifest = await fetchAndValidate(department);
      if (manifest) {
        memoryCache.set(department, {
          manifest,
          fetchedAt: Date.now(),
          source: "live",
        });
        await writeFirestoreCache(department, manifest);
        return;
      }
    } catch (err) {
      log("manifest_fetch_failure", {
        department,
        manifestUrl: registry.departments[department].manifestUrl,
        error: err.message,
        retried: false,
      });
    }

    // One retry after delay
    await sleep(RETRY_DELAY_MS);
    try {
      const manifest = await fetchAndValidate(department);
      if (manifest) {
        memoryCache.set(department, {
          manifest,
          fetchedAt: Date.now(),
          source: "live",
        });
        await writeFirestoreCache(department, manifest);
        log("manifest_fetch_success", {
          department,
          retried: true,
        });
      }
    } catch (retryErr) {
      log("manifest_fetch_failure", {
        department,
        manifestUrl: registry.departments[department].manifestUrl,
        error: retryErr.message,
        retried: true,
      });
    }
  })().finally(() => {
    inflightRefreshes.delete(department);
  });

  inflightRefreshes.set(department, promise);
  return promise;
}

/**
 * Fetch manifest from live URL and validate against schema.
 * @returns {object|null} Valid manifest or null
 */
async function fetchAndValidate(department) {
  const entry = registry.departments[department];
  const startTime = Date.now();

  const response = await fetch(entry.manifestUrl, {
    headers: { "User-Agent": "Sandra/1.0 (AddRan Advisor Chat)" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} from ${entry.manifestUrl}`);
  }

  const manifest = await response.json();
  const fetchDurationMs = Date.now() - startTime;

  // Schema validation
  const valid = validateManifest(manifest);
  if (!valid) {
    log("manifest_validation_failure", {
      department,
      validationErrors: validateManifest.errors,
      fallbackSource: "pending",
    });
    return null;
  }

  // Version check
  if (!SUPPORTED_VERSIONS.includes(manifest.manifestVersion)) {
    log("manifest_version_rejected", {
      department,
      receivedVersion: manifest.manifestVersion,
      supportedVersions: SUPPORTED_VERSIONS,
    });
    return null;
  }

  log("manifest_fetch_success", {
    department,
    manifestVersion: manifest.manifestVersion,
    lastUpdated: manifest.lastUpdated,
    fetchDurationMs,
    programCount: manifest.programs.length,
  });

  return manifest;
}

async function readFirestoreCache(department) {
  try {
    const doc = await db.collection("manifests").doc(department).get();
    if (!doc.exists) return null;
    const data = doc.data();
    return {
      manifest: data.manifest,
      fetchedAt: data.fetchedAt?.toMillis?.() || Date.now(),
    };
  } catch (err) {
    log("firestore_read_failure", { department, error: err.message });
    return null;
  }
}

async function writeFirestoreCache(department, manifest) {
  const { FieldValue } = require("firebase-admin/firestore");
  await db
    .collection("manifests")
    .doc(department)
    .set({
      manifest,
      fetchedAt: FieldValue.serverTimestamp(),
      version: manifest.manifestVersion,
      lastUpdated: manifest.lastUpdated,
      department,
    });
}

/**
 * Load static fallback from program-data/*.json files.
 * Returns a synthetic manifest-like object for context generation.
 */
function loadStaticFallback(department) {
  const entry = registry.departments[department];
  if (!entry || !entry.fallbackPrograms || entry.fallbackPrograms.length === 0) {
    log("fallback_usage", {
      department,
      fallbackSource: "none",
      reason: "no fallback programs configured",
    });
    return null;
  }

  const programs = [];
  for (const slug of entry.fallbackPrograms) {
    const filepath = path.join(__dirname, "program-data", `${slug}.json`);
    if (fs.existsSync(filepath)) {
      try {
        const data = JSON.parse(fs.readFileSync(filepath, "utf8"));
        programs.push(data);
      } catch (e) {
        console.warn(`Failed to load fallback ${filepath}:`, e.message);
      }
    }
  }

  if (programs.length === 0) {
    log("fallback_usage", {
      department,
      fallbackSource: "none",
      reason: "no fallback files found",
    });
    return null;
  }

  log("fallback_usage", {
    department,
    fallbackSource: "static",
    programCount: programs.length,
  });

  return {
    manifest: {
      department,
      programs,
      _isFallback: true,
    },
    source: "static-fallback",
  };
}

function log(event, data) {
  const entry = {
    severity:
      event.includes("failure") ||
      event.includes("rejected") ||
      event.includes("mismatch")
        ? "WARNING"
        : "INFO",
    message: event,
    ...data,
    timestamp: new Date().toISOString(),
  };
  if (entry.severity === "WARNING") {
    console.warn(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { initManifestLoader, getManifest, getAllManifests };
