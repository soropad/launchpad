/**
 * Utility function for combining classnames
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes
    .filter((c) => c && typeof c === "string")
    .join(" ")
    .trim();
}
