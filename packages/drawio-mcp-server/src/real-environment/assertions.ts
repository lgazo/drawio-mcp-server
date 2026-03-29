import { expect } from "@jest/globals";

import type { RealEnvironmentContext } from "./types.js";
import { captureVerificationArtifact } from "./screenshot.js";
import { browserErrors } from "./harness.js";

export async function withVerificationScreenshot<T>(
  context: RealEnvironmentContext,
  testName: string,
  stepName: string,
  verify: () => Promise<T> | T,
) {
  await captureVerificationArtifact(
    context.artifactRunDir,
    context.page,
    testName,
    stepName,
  );
  return await verify();
}

export async function expectNoBrowserErrors(
  context: RealEnvironmentContext,
  testName: string,
) {
  return withVerificationScreenshot(
    context,
    testName,
    "before-browser-log-verification",
    () => {
      expect(browserErrors(context)).toEqual([]);
    },
  );
}

export async function expectNoServerErrors(
  context: RealEnvironmentContext,
  testName: string,
  logCountBefore: number,
) {
  return withVerificationScreenshot(
    context,
    testName,
    "before-server-log-verification",
    () => {
      const serverErrors = context.logger.errors().slice(logCountBefore);
      expect(serverErrors).toEqual([]);
    },
  );
}
