/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  testEnvironment: "jest-environment-node",
  rootDir: ".",
  coverageProvider: "babel",
  transform: {
    "^.+\\.[jt]sx?$": "esbuild-jest",
  },
  transformIgnorePatterns: ["/node_modules/(?!nanoid|\\.pnpm)"],
  testMatch: ["**/build/**/*.test.js"],
  testPathIgnorePatterns: ["/node_modules/", "/src/"],
  collectCoverageFrom: [
    "packages/drawio-mcp-server/build/**/*.js",
    // exclude as it contains boundary injection logic mainly
    "!packages/drawio-mcp-server/build/index.js",
    "!**/node_modules/**",
    "!packages/drawio-mcp-server/build/**/*.test.js",
    "!packages/drawio-mcp-server/build/plugin/**",
    "!packages/drawio-mcp-server/build/assets/**",
  ],
  coverageThreshold: {
    global: {
      branches: 75,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};
