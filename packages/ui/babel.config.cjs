// Babel config for jest only; Expo/Metro use their own. The React Native
// preset normally rewrites helpers to `@babel/runtime` imports, which pnpm
// does not expose to the workspace sources, so helpers are inlined instead.
module.exports = {
  presets: [['module:@react-native/babel-preset', { enableBabelRuntime: false }]],
};
