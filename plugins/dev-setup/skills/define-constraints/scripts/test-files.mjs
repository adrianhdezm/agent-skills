// Which files are tests. Shared by guard.mjs here and trace.mjs in verify-build, so a file the guard protects is a
// file the trace reads. Matched against a path relative to the repository root.
export const TEST_FILE =
  /(\.|-|_)(test|spec|e2e)\.[cm]?[jt]sx?$|(^|\/)tests?\/.*\.[cm]?[jt]sx?$|(^|\/)test_[^/]*\.py$|_test\.(py|go)$/;
