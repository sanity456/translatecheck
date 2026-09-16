// Reads only: verify the active Studio Next deployment and recorded workflow.
// Historical stable Studio scripts and evidence remain in git before this migration.
process.argv.push('--verify');
await import('./studio-next-release.mjs');
