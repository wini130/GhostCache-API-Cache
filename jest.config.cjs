// jest.config.cjs
module.exports = {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  // Tell ts-jest to treat .ts files as ESM:
  extensionsToTreatAsEsm: [".ts"],
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { useESM: true }],
  },
  testMatch: ["**/__tests__/**/*.(test|spec).[jt]s?(x)"],
  // Optional: add other Jest config as needed.
};
