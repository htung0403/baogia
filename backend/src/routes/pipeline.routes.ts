import { Router } from 'express';
import {
  getBoardData, assignCustomerToStage, getFunnelData,
  createActivity, listQuotes, createQuote, listContracts, createContract,
} from '../controllers/pipeline.controller.js';
import { authenticate, requireAdminOrStaff } from '../middleware/index.js';

const router = Router();
router.use(authenticate, requireAdminOrStaff);

router.get('/board',                          getBoardData);
router.post('/customers/:customerId/stage',   assignCustomerToStage);
router.get('/funnel',                         getFunnelData);
router.post('/activities',                    createActivity);
router.get('/quotes',                         listQuotes);
router.post('/quotes',                        createQuote);
router.get('/contracts',                      listContracts);
router.post('/contracts',                     createContract);

export default router;
