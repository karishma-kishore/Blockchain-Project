// Thin wrapper so server routes can share the same badge client used elsewhere.
// Re-exports the functions from ../client (issueBadge, getBadge, usesMock, etc.).
const badgeClient = require('../client');

module.exports = badgeClient;
