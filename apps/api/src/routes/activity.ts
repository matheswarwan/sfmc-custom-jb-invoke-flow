import { Router } from 'express';
import { object } from '@jah/shared';
import { getExecutor } from '../executors/index.js';
export const activity = Router();
activity.post('/execute', async (req,res) => {
  if (!Array.isArray(object(req.body).inArguments)) { res.status(400).json({ error: 'inArguments must be an array' }); return; }
  const result = await getExecutor('salesforce-flow').execute();
  res.status(501).json(result);
});
for (const action of ['save','stop','unpublish']) activity.post(`/${action}`, (_req,res) => { res.sendStatus(200); });
for (const action of ['validate','publish']) activity.post(`/${action}`, (_req,res) => { res.status(422).json({ error: 'Phase 2 is configuration-only. Runtime authentication and executors must be implemented before activation.' }); });
