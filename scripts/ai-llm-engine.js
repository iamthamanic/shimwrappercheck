#!/usr/bin/env node
/**
 * ai-llm-engine.js — barrel file for the custom LLM engine.
 * Re-exports from ai-llm-request.js and ai-llm-models.js.
 * Why: keeps require() paths stable for consumers; internal modules can evolve.
 */
const { sendReview } = require("./ai-llm-request");
const { listModels } = require("./ai-llm-models");

module.exports = { sendReview, listModels };
