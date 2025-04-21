/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "jest-environment-node",
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        useESM: true,
      },
    ],
  },
  testMatch: ["**/*.test.ts"],
  collectCoverageFrom: [
    "src/**/*.ts",
    // exclude as it contains boundary injection logic mainly
    "!src/index.ts",
    "!src/**/*.d.ts",
    "!src/**/__tests__/**",
    "!src/**/*.test.ts",
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};
