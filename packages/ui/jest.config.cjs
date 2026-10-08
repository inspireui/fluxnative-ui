// `preset: 'react-native'` resolves to @react-native/jest-preset: the native
// module mocks, haste platforms (iOS by default) and test environment.
//
// pnpm stores packages at node_modules/.pnpm/<name@version>/node_modules/<name>,
// so the preset's transformIgnorePatterns (which only look at the first
// `node_modules/` segment) would skip the untranspiled React Native sources.
// The pattern below allows an optional `.pnpm/<dir>/node_modules/` hop before
// the package name.
const transformed = [
  '(jest-)?react-native(-[^/]+)?',
  '@react-native(-community)?',
  'expo(nent)?(-[^/]+)?',
  '@expo(nent)?',
  '@fluxnative',
].join('|');

/** @type {import('jest').Config} */
module.exports = {
  preset: 'react-native',
  rootDir: __dirname,
  roots: ['<rootDir>/src'],
  testMatch: ['<rootDir>/src/**/__tests__/**/*.test.tsx'],
  // Runs after the preset's own setup file.
  setupFiles: ['<rootDir>/jest.setup.ts'],
  transformIgnorePatterns: [`/node_modules/(?!(\\.pnpm/[^/]+/node_modules/)?(${transformed})/)`],
};
