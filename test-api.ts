/**
 * Test script for API endpoints
 * Run with: npx tsx test-api.ts
 */

const BASE_URL = "http://localhost:3000";

async function testApi(path: string) {
  const url = `${BASE_URL}${path}`;
  console.log(`\n➜ Testing ${url}...`);

  try {
    const res = await fetch(url);
    const data = await res.json();
    console.log(`  Status: ${res.status}`);
    console.log(`  Response: ${JSON.stringify(data, null, 2)}`);
    return { ok: res.ok, data };
  } catch (err) {
    console.error(`  ❌ Failed: ${err instanceof Error ? err.message : err}`);
    return { ok: false, error: err };
  }
}

async function main() {
  console.log("=== API Test Suite ===\n");

  await testApi("/api/hello");
  await testApi("/api/test");

  console.log("\n=== Done ===");
}

main();
