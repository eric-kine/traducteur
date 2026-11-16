import { Router } from 'express';
import { authenticate } from '../../common/middlewares/authenticate';
import { authorize } from '../../common/middlewares/authorize';
import { getDashboard } from './dashboard.service';

export const dashboardRouter = Router();
dashboardRouter.get('/', authenticate, authorize('ADMIN', 'SCOLARITE'), async (req, res) => {
  res.json({ dashboard: await getDashboard(req.user!) });
});
