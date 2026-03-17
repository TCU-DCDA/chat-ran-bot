const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { initManifestLoader, getManifest, __test } = require("../manifest-loader");

function createMockFirestore(seed = {}) {
  const docs = new Map(Object.entries(seed));

  return {
    collection(collectionName) {
      return {
        doc(docId) {
          const key = `${collectionName}/${docId}`;
          return {
            async get() {
              if (!docs.has(key)) return { exists: false, data: () => undefined };
              const value = docs.get(key);
              return { exists: true, data: () => value };
            },
            async set(value) {
              docs.set(key, value);
            },
          };
        },
      };
    },
  };
}

function loadDcdaManifestFixture() {
  const fixturePath = path.resolve(
    __dirname,
    "../../../dcda-advising-wizard/public/advising-manifest.json"
  );
  return JSON.parse(fs.readFileSync(fixturePath, "utf8"));
}

test.afterEach(() => {
  __test.resetForTests();
});

test("falls back to static program data when live fetch fails", async () => {
  initManifestLoader(createMockFirestore());

  const originalFetch = global.fetch;
  global.fetch = async () => {
    throw new Error("network down");
  };

  try {
    const result = await getManifest("Digital Culture and Data Analytics");
    assert.equal(result.source, "static-fallback");
    assert.equal(result.manifest._isFallback, true);
    assert.ok(result.manifest.programs.length > 0);
  } finally {
    global.fetch = originalFetch;
  }
});

test("serves stale memory cache immediately and refreshes in background", async () => {
  initManifestLoader(createMockFirestore());
  __test.setMemoryCacheForTests(
    "Digital Culture and Data Analytics",
    { department: "Digital Culture and Data Analytics", manifestVersion: "1.0", programs: [] },
    Date.now() - __test.TTL_MS - 1000
  );

  const validManifest = loadDcdaManifestFixture();
  const originalFetch = global.fetch;

  let resolveFetch;
  const gate = new Promise((resolve) => {
    resolveFetch = resolve;
  });
  let fetchCalls = 0;

  global.fetch = async () => {
    fetchCalls += 1;
    await gate;
    return {
      ok: true,
      status: 200,
      json: async () => validManifest,
    };
  };

  try {
    const first = await getManifest("Digital Culture and Data Analytics");
    const second = await getManifest("Digital Culture and Data Analytics");

    assert.equal(first.source, "memory");
    assert.equal(second.source, "memory");

    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(fetchCalls, 1);

    resolveFetch();
    const inflight = __test.getInflightPromiseForTests("Digital Culture and Data Analytics");
    if (inflight) await inflight;
  } finally {
    global.fetch = originalFetch;
  }
});

test("returns live manifest on cache miss when fetch succeeds", async () => {
  initManifestLoader(createMockFirestore());
  const validManifest = loadDcdaManifestFixture();

  const originalFetch = global.fetch;
  let fetchCalls = 0;
  global.fetch = async () => {
    fetchCalls += 1;
    return {
      ok: true,
      status: 200,
      json: async () => validManifest,
    };
  };

  try {
    const result = await getManifest("Digital Culture and Data Analytics");
    assert.equal(result.source, "live");
    assert.equal(result.manifest.manifestVersion, "1.0");
    assert.equal(fetchCalls, 1);
  } finally {
    global.fetch = originalFetch;
  }
});
