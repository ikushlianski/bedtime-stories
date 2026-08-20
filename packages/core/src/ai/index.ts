import { OpenRouterRunner, AiExecutionError, AiValidationError } from '../openrouter/openrouter.runner.js'

export type { AiRunner, RunTextOptions, RunStructuredOptions, RunImageOptions, RunImageResult } from './runner.interface.js'
export { OpenRouterRunner, AiExecutionError, AiValidationError }
export { parseJsonWithSchema, jsonCandidates, extractBalancedObject } from '../openrouter/json-extract.js'

export const aiRunner: OpenRouterRunner = new OpenRouterRunner()
