import { runDiscoveryTests } from "./device-manager-discovery.test.mjs";
import { runServiceTests } from "./device-manager-service.test.mjs";
import { runStage3Tests } from "./stage3-validation-and-jobs.test.mjs";

const tests = [
  ["discovery matching and history", runDiscoveryTests],
  ["service data APIs", runServiceTests],
  ["stage3 validation and job flows", runStage3Tests],
];

let failures = 0;
for (const [name, fn] of tests) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${name}`);
    console.error(error?.stack ?? error);
  }
}

if (failures > 0) {
  process.exitCode = 1;
} else {
  console.log(`All ${tests.length} test group(s) passed.`);
}
