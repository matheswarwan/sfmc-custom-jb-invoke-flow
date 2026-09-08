import express from 'express';
import { env } from './config/env.js';
import { activity } from './routes/activity.js';
import { health } from './routes/health.js';
const app = express();
app.use(express.json({ limit: '256kb' }));
app.use('/health',health); app.use('/activity',activity);
app.listen(env.port, () => console.log(`Journey Action Hub API listening on ${env.port}`));
