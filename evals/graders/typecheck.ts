// typecheck: the screen compiled the way a template is, against the real
// catalog layer. One scaffold per process: `fluxnative-catalog emit --to
// <tmp>/files`, `<tmp>/node_modules` linked to packages/catalog/node_modules
// (react, react-native, react-native-svg and their types), and the compiler
// options of packages/catalog/tsconfig.files.json. Each sample is written to
// `<tmp>/files/screens/<Name>.tsx` and checked like `tsc -p` would; parsed
// library files are cached across samples, so a check costs tens of ms.

import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import ts from 'typescript';
import { CATALOG_CLI, CATALOG_DIR, CATALOG_NODE_MODULES, CATALOG_TSCONFIG } from '../paths.ts';
import { SCREEN_DIR } from './source.ts';
import { countScore, type GradeResult } from './types.ts';

export interface TypecheckDiagnostic {
  code: number;
  /** Relative to the template's `files/`; null for global diagnostics. */
  file: string | null;
  line: number | null;
  message: string;
}

export interface TypecheckDetails {
  errors: TypecheckDiagnostic[];
  /** `@ts-nocheck` / `@ts-ignore` / `@ts-expect-error`: a screen may not switch the checker off. */
  suppressions: string[];
  ms: number;
}

const SUPPRESSION_RE = /@ts-(?:nocheck|ignore|expect-error)\b/g;
const MAX_MESSAGE = 400;

export class Typechecker {
  #dir: string | null = null;
  #options: ts.CompilerOptions | null = null;
  readonly #cache = new Map<string, ts.SourceFile>();

  /** The scaffold's `files/` folder (created on first use). */
  get filesDir(): string {
    return join(this.#scaffold(), 'files');
  }

  /** Builds the scaffold and reads the compiler options now, so a setup problem surfaces before any API call. */
  prepare(): void {
    this.#scaffold();
    this.#compilerOptions();
  }

  check(code: string, screenName: string): GradeResult<TypecheckDetails> {
    const started = performance.now();
    const filesDir = this.filesDir;
    const options = this.#compilerOptions();
    const screenFile = join(filesDir, SCREEN_DIR, `${screenName}.tsx`);
    mkdirSync(join(filesDir, SCREEN_DIR), { recursive: true });
    writeFileSync(screenFile, code);
    try {
      const program = ts.createProgram({ rootNames: [screenFile], options, host: this.#host(options, filesDir) });
      const sf = program.getSourceFile(screenFile);
      // The order and short-circuits of `tsc` (emitFilesAndReportErrors).
      let diagnostics: readonly ts.Diagnostic[] = [...program.getSyntacticDiagnostics(sf)];
      if (diagnostics.length === 0) {
        diagnostics = [...program.getOptionsDiagnostics(), ...program.getGlobalDiagnostics()];
        if (diagnostics.length === 0) diagnostics = program.getSemanticDiagnostics(sf);
        if (diagnostics.length === 0 && options.declaration) diagnostics = program.getDeclarationDiagnostics(sf);
      }
      const errors = diagnostics.filter((d) => d.category === ts.DiagnosticCategory.Error).map((d) => toDiagnostic(d, filesDir));
      const suppressions = [...code.matchAll(SUPPRESSION_RE)].map((m) => m[0]);
      const findings = errors.length + suppressions.length;
      return {
        pass: findings === 0,
        score: countScore(findings),
        details: { errors, suppressions, ms: Math.round(performance.now() - started) },
      };
    } finally {
      unlinkSync(screenFile);
    }
  }

  dispose(): void {
    if (this.#dir === null) return;
    try {
      unlinkSync(join(this.#dir, 'node_modules')); // the link, never what it points at
    } catch {
      // already gone
    }
    rmSync(this.#dir, { recursive: true, force: true });
    this.#dir = null;
  }

  #scaffold(): string {
    if (this.#dir !== null) return this.#dir;
    const dir = mkdtempSync(join(tmpdir(), 'fluxnative-eval-'));
    try {
      execFileSync(process.execPath, [CATALOG_CLI, 'emit', '--to', join(dir, 'files')], { stdio: 'pipe' });
      symlinkSync(CATALOG_NODE_MODULES, join(dir, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
    } catch (error) {
      rmSync(dir, { recursive: true, force: true });
      throw new Error(`typecheck: could not scaffold the catalog layer (run \`pnpm install\` first?): ${(error as Error).message}`);
    }
    this.#dir = dir;
    return dir;
  }

  #compilerOptions(): ts.CompilerOptions {
    if (this.#options !== null) return this.#options;
    const read = ts.readConfigFile(CATALOG_TSCONFIG, ts.sys.readFile);
    if (read.error) throw new Error(`typecheck: ${ts.flattenDiagnosticMessageText(read.error.messageText, '\n')}`);
    const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, CATALOG_DIR, undefined, CATALOG_TSCONFIG);
    const options: ts.CompilerOptions = { ...parsed.options, noEmit: true };
    delete options.configFilePath;
    this.#options = options;
    return options;
  }

  /** A compiler host that re-parses only the screen; library and catalog files are parsed once per process. */
  #host(options: ts.CompilerOptions, filesDir: string): ts.CompilerHost {
    const host = ts.createCompilerHost(options, true);
    const screens = join(filesDir, SCREEN_DIR);
    const getSourceFile = host.getSourceFile.bind(host);
    host.getSourceFile = (fileName, languageVersion, onError, shouldCreate) => {
      if (fileName.startsWith(screens)) return getSourceFile(fileName, languageVersion, onError, shouldCreate);
      const hit = this.#cache.get(fileName);
      if (hit !== undefined) return hit;
      const sf = getSourceFile(fileName, languageVersion, onError, shouldCreate);
      if (sf !== undefined) this.#cache.set(fileName, sf);
      return sf;
    };
    return host;
  }
}

function toDiagnostic(d: ts.Diagnostic, filesDir: string): TypecheckDiagnostic {
  let message = ts.flattenDiagnosticMessageText(d.messageText, '\n');
  if (message.length > MAX_MESSAGE) message = `${message.slice(0, MAX_MESSAGE)}…`;
  if (d.file === undefined) return { code: d.code, file: null, line: null, message };
  const line = d.start === undefined ? null : d.file.getLineAndCharacterOfPosition(d.start).line + 1;
  return { code: d.code, file: relative(filesDir, d.file.fileName).split('\\').join('/'), line, message };
}
