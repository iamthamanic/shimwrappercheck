/**
 * AGENTS.md reader via core.
 */
const { loadCoreModule } = require("../core-bridge.js");

async function getAgentsMd(projectRoot) {
  const core = await loadCoreModule();
  if (!core?.getAgentsMdContent) {
    return { found: false, message: "Core engine not built." };
  }
  return core.getAgentsMdContent(projectRoot);
}

module.exports = { getAgentsMd };
