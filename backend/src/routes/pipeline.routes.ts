import { Router } from 'express';
import {
  getBoardData, assignCustomerToStage, getFunnelData,
  createActivity, listActivities, listQuotes, createQuote, listContracts, createContract,
  createPipelineColumn, updatePipelineColumn, deletePipelineColumn,
  createPipelineStage, updatePipelineStage, deletePipelineStage
} from '../controllers/pipeline.controller.js';
import { authenticate, requireAdminOrStaff } from '../middleware/index.js';

const router = Router();
router.use(authenticate, requireAdminOrStaff);

router.get('/board',                          getBoardData);
router.post('/customers/:customerId/stage',   assignCustomerToStage);
router.get('/funnel',                         getFunnelData);
router.post('/activities',                    createActivity);
router.get('/activities/:customerId',         listActivities);
router.get('/quotes',                         listQuotes);
router.post('/quotes',                        createQuote);
router.get('/contracts',                      listContracts);
router.post('/contracts',                     createContract);

router.post('/columns',                       createPipelineColumn);
router.put('/columns/:id',                    updatePipelineColumn);
router.delete('/columns/:id',                 deletePipelineColumn);

router.post('/stages',                        createPipelineStage);
router.put('/stages/:id',                     updatePipelineStage);
router.delete('/stages/:id',                  deletePipelineStage);

export default router;
