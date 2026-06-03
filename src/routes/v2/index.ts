import { Router } from 'express';
import v1Routes from '../v1';

// v2 extends v1; override specific routes here as API evolves
const router = Router();
router.use('/', v1Routes);

export default router;
