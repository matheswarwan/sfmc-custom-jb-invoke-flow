import type { ActivityExecutor } from './Executor.js';
export class RestApiExecutor implements ActivityExecutor {
  async execute() { return { status: 'not-implemented' as const, message: 'REST execution is not implemented in Phase 2.' }; }
}
