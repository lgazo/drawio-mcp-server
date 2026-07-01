/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  testEnvironment: "jest-environment-node",
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { useESM: true }],
  },
  testMatch: ["**/src/**/*.test.ts"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  extensionsToTreatAsEsm: [".ts"],
  modulePaths: ["../../node_modules"],
};
