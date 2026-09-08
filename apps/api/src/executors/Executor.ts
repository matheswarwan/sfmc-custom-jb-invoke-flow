import type { JourneyExecutionContext, ExecutorResult } from '@jah/shared';
export interface ActivityExecutor { execute(context: JourneyExecutionContext): Promise<ExecutorResult> }
