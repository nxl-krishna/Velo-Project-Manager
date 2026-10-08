import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.test.ts"],
  transform: { "^.+\\.tsx?$": ["ts-jest", { tsconfig: "tsconfig.json" }] },
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/src/$1" },
  setupFilesAfterEnv: ["<rootDir>/src/__tests__/setup.ts"],
  coverageDirectory: "coverage",
  collectCoverageFrom: ["src/lib/**/*.ts", "src/app/api/**/*.ts"],
};

export default config;
