// The prompt: system = the template-dialect rules (the same for every
// context, so `none` vs `index` isolates what the docs add) + the context
// docs; user = the brief + the file to write. One generation, no fix loop.

import type { Brief } from './briefs.ts';
import type { Context } from './context.ts';

export const RULES = `You write one screen of a FluxBuilder template: a React Native screen built on the FluxNative UI catalog layer, which the template ships as plain files next to the screen.

# Output
Reply with exactly one \`\`\`tsx code block that holds the whole file \`screens/<Name>.tsx\` named in the request. Write no other code block.

# Template dialect
A screen that breaks any of these rules is rejected.
1. Imports: only \`react\`, \`react-native\`, \`react-native-svg\` and relative files. Catalog components are default exports of \`../components/<Component>\`, design tokens are named exports of \`../theme/tokens\`, and the palette hook is \`import { usePalette } from '../theme/usePalette'\`. No file extensions in import paths and no other package: no Expo, navigation, icon or \`@fluxnative/*\` packages.
2. React Native, not the web: \`View\`, \`Text\`, \`ScrollView\`, \`FlatList\`, \`Image\`, \`TextInput\`, \`StyleSheet\`. No \`className\`, no \`<div>\` or \`<span>\`, no \`document.\` or \`window.location\`.
3. One default-exported screen component in strict TypeScript: \`strict\`, \`noUncheckedIndexedAccess\`, \`noUnusedLocals\`, \`noUnusedParameters\` and \`jsx: react\`, so \`import React from 'react'\`. No \`@ts-\` suppression comments.
4. Colours come only from \`usePalette()\`, by semantic name (\`palette.primary\`, \`palette['muted-foreground']\`). Never a hex, \`rgb()\`, \`hsl()\` or named colour literal.
5. Font size, line height, letter spacing and corner radius come only from the tokens (\`text.lg.fontSize\`, \`text.lg.lineHeight\`, \`radius['2xl']\`). Never a number literal for \`fontSize\`, \`lineHeight\`, \`letterSpacing\` or \`borderRadius\`.
6. Use the catalog components instead of re-implementing them: no home-made pressable with a scale animation, button, chip, skeleton, empty or error state, bottom sheet, \`Modal\` or hand-drawn icon.
7. Mock the data inline; no network calls. The screen takes a \`previewState\` prop and renders every state the request lists.`;

export function systemPrompt(context: Context): string {
  if (context.docs.length === 0) return RULES;
  const docs = context.docs.map((doc) => `<doc path="${doc.path}">\n${doc.text.trim()}\n</doc>`).join('\n\n');
  return `${RULES}\n\n# Reference\nThe FluxNative UI documentation follows. Where it disagrees with the rules above, the rules win.\n\n${docs}`;
}

export function userPrompt(brief: Brief): string {
  const states = brief.expect.states.map((s) => `'${s}'`).join(' | ');
  return [
    brief.text.trim(),
    '',
    '---',
    `Write \`screens/${brief.screenName}.tsx\`. Its default export \`${brief.screenName}\` takes \`{ previewState?: ${states} }\` (default \`'live'\`) and renders each state with inline mock data. Reply with exactly one \`\`\`tsx block.`,
  ].join('\n');
}
