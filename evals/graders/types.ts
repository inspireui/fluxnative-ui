// What every grader returns. Graders are deterministic: the same output
// always gets the same grade, so a score change means the model changed.

export interface GradeResult<D> {
  pass: boolean;
  /** 0..1, higher is better. Count-based graders use 1 / (1 + findings). */
  score: number;
  details: D;
}

/** Details of a grader that had no code to look at (the output had no code block). */
export interface Skipped {
  skipped: string;
}

/** 1 for a clean result, falling towards 0 as findings pile up. */
export function countScore(findings: number): number {
  return 1 / (1 + findings);
}
