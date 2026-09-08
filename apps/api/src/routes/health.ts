import { Router } from 'express';
export const health = Router();
health.get('/', (_req,res) => { res.json({ status: 'ok', phase: 2, runtimeEnabled: false }); });
