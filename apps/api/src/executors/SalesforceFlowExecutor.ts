import type { ActivityExecutor } from './Executor.js';
export class SalesforceFlowExecutor implements ActivityExecutor {
  async execute() { return { status: 'not-implemented' as const, message: 'Salesforce OAuth and Flow execution are not implemented in Phase 2.' }; }
}
