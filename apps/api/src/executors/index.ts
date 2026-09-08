import type { ExecutorType } from '@jah/shared';
import { SalesforceFlowExecutor } from './SalesforceFlowExecutor.js';
import { RestApiExecutor } from './RestApiExecutor.js';
const executors = { 'salesforce-flow': new SalesforceFlowExecutor(), 'rest-api': new RestApiExecutor() };
export const getExecutor = (type: ExecutorType) => executors[type];
