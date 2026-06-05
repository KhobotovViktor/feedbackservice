// Verbose, step-by-step logging is useful when debugging an integration but
// floods PM2's log files on a busy production box (every B24 dispatch, every
// follow-up run, every rating sync writes several lines). Gate it behind an
// env flag so production stays quiet by default; set LOG_VERBOSE=true on the
// server only while actively investigating something.
//
// Errors should still use console.error directly — those we always want.
const VERBOSE = process.env.LOG_VERBOSE === "true";

export function verbose(...args: unknown[]): void {
  if (VERBOSE) console.log(...args);
}
