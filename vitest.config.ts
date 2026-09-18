import { defineConfig } from "vitest/config";

// The suite contains render-gate tests that legitimately run for tens of seconds
// under parallel-worker load (worst observed: ~90s for the sdd_for_sdd spacing
// regression and Scenario production gates). With vitest's default 5000ms
// testTimeout, whether a slow test failed depended on machine load and on
// whether the test happened to yield to the event loop, producing run-to-run
// flakiness (12/13/14 failures on identical code).
//
// The margin below is ~2x the worst observed legitimate test duration, so a
// machine roughly 2x slower than the development box still passes, while a
// genuine hang (the routing-solver hang this guards against ran for minutes to
// infinity) is still caught within three minutes per test.
//
// Do not treat this timeout as a performance budget. Hang prevention belongs in
// the code under test (e.g. the bounded search budgets in
// src/renderer/staged/routingCore/solver.ts and occupancy.ts, asserted by
// tests/routingCore.spec.ts and tests/routingHardeningAssignment.spec.ts).
export default defineConfig({
  test: {
    testTimeout: 180_000,
    hookTimeout: 180_000,
    // Print each test line as it completes rather than only per-file summaries,
    // so a long run visibly progresses instead of looking stalled. Note this is
    // test-granularity only: vitest has no built-in heartbeat *within* a single
    // long test, so a 100s test still prints nothing until it finishes.
    reporter: "verbose"
  }
});
