export function issueKeyToBranch(key: string, issueType: string): string {
  const prefix = issueType.toLowerCase() === "bug" ? "bugfix" : "feature";
  return `${prefix}/${key.toLowerCase()}`;
}

export function getCommitEmoji(issueType: string): string {
  return issueType.toLowerCase() === "bug" ? "🐛" : "✨";
}
