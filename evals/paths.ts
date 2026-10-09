// Paths shared by the runner, the graders and the tests.

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const EVALS_DIR = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = dirname(EVALS_DIR);
export const BRIEFS_DIR = join(EVALS_DIR, 'briefs');
export const FIXTURES_DIR = join(EVALS_DIR, 'fixtures');
/** Canned model outputs for `--dry-run`, one `<brief>.md` (or `<brief>.<sample>.md`) each. */
export const DRY_RUN_DIR = join(FIXTURES_DIR, 'dry-run');
export const REPORTS_DIR = join(EVALS_DIR, 'reports');

export const CATALOG_DIR = join(REPO_ROOT, 'packages', 'catalog');
/** The canonical copy of the catalog layer: what `fluxnative-catalog emit` writes into a template. */
export const CATALOG_FILES = join(CATALOG_DIR, 'files');
export const CATALOG_CLI = join(CATALOG_DIR, 'src', 'cli.ts');
/** The template dialect's compiler options (strict, noUncheckedIndexedAccess, jsx: react). */
export const CATALOG_TSCONFIG = join(CATALOG_DIR, 'tsconfig.files.json');
/** react, react-native, react-native-svg and their types, which a scaffolded template resolves through a symlink. */
export const CATALOG_NODE_MODULES = join(CATALOG_DIR, 'node_modules');
