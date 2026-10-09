// The two places the catalog shells out to git: the commit the layer was
// rendered from (recorded as `catalog.commit`), and the three-way merge
// behind `update --merge`.

import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PACKAGE_ROOT } from './emit.ts';

/** Variables that would point git at another repository than the one around `cwd`. */
const REPO_ENV = ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_OBJECT_DIRECTORY', 'GIT_COMMON_DIR', 'GIT_PREFIX'];

function git(args: string[], cwd: string): SpawnSyncReturns<string> {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !REPO_ENV.includes(key)));
  return spawnSync('git', args, { cwd, env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

function gitOutput(args: string[], cwd: string): string | null {
  const result = git(args, cwd);
  return result.status === 0 ? result.stdout.trim() : null;
}

function checkoutCommit(packageRoot: string): string | null {
  // A copy under another repository's node_modules is not tracked there.
  if (gitOutput(['ls-files', '--error-unmatch', 'package.json'], packageRoot) === null) return null;
  // Pathspecs are relative to `cwd`: this package and the two it renders from.
  const status = gitOutput(['status', '--porcelain', '--', '.', '../tokens', '../icons'], packageRoot);
  if (status !== '') return null;
  return gitOutput(['rev-parse', 'HEAD'], packageRoot);
}

function packageGitHead(packageRoot: string): string | null {
  try {
    const pkg = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8')) as { gitHead?: unknown };
    return typeof pkg.gitHead === 'string' && pkg.gitHead !== '' ? pkg.gitHead : null;
  } catch {
    return null;
  }
}

/**
 * The commit to record as `catalog.commit`:
 * - `FLUXNATIVE_CATALOG_COMMIT` when it is set (empty means null), for reproducible runs;
 * - `git rev-parse HEAD` when this package runs from a git checkout with no
 *   local changes in packages/catalog, packages/tokens or packages/icons;
 * - otherwise `gitHead` from package.json when a release put it there, else null.
 */
export function catalogCommit(packageRoot: string = PACKAGE_ROOT): string | null {
  const forced = process.env.FLUXNATIVE_CATALOG_COMMIT;
  if (forced !== undefined) return forced.trim() === '' ? null : forced.trim();
  return checkoutCommit(packageRoot) ?? packageGitHead(packageRoot);
}

export interface MergeResult {
  content: string;
  /** Conflict blocks left in `content`; 0 is a clean merge. */
  conflicts: number;
}

/**
 * `git merge-file -p --zdiff3 <local> <base> <theirs>`: merges a hand-edited
 * file with the catalog's new copy, against the copy it was emitted from.
 * Conflicts come back as `<<<<<<<` / `|||||||` / `=======` / `>>>>>>>` blocks
 * named by `labels`. Falls back to `--diff3` on git older than 2.35.
 */
export function mergeFile(local: string, base: string, theirs: string, labels: { local: string; base: string; theirs: string }): MergeResult {
  const dir = mkdtempSync(join(tmpdir(), 'fluxnative-merge-'));
  try {
    const files = [join(dir, 'local'), join(dir, 'base'), join(dir, 'theirs')] as const;
    writeFileSync(files[0], local);
    writeFileSync(files[1], base);
    writeFileSync(files[2], theirs);
    const run = (style: string) => git(['merge-file', '-p', style, '-L', labels.local, '-L', labels.base, '-L', labels.theirs, ...files], dir);
    let result = run('--zdiff3');
    if (result.status === 129) result = run('--diff3');
    if (result.error) throw new Error(`--merge needs git on the PATH (${result.error.message})`);
    if (result.status === null || result.status > 127) throw new Error(`git merge-file failed: ${result.stderr.trim() || `exit ${result.status}`}`);
    return { content: result.stdout, conflicts: result.status };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
