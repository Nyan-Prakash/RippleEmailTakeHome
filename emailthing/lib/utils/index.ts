// Utility functions and helpers
// This will be populated in future PRs

export function cn(...classes: (string | undefined | false)[]): string {
  return classes.filter(Boolean).join(" ");
}
