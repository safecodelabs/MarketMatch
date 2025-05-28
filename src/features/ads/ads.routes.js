import { Router } from 'express';
const router = Router();
import { getAdInfo } from './ads.controller';

router.post('/ad-info', getAdInfo);

export default router;
