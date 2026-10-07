export { FluxStack } from './FluxStack.tsx';
// No extension on purpose: Metro resolves FluxTabs.ios.tsx on iOS only for
// an extensionless import. TypeScript reads FluxTabs.tsx; both share types.
export { FluxTabs } from './FluxTabs';
export type { FluxTabProps, FluxTabsProps } from './tabs-shared.ts';
