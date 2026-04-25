import { Router } from 'express';
import {
  getBoardData, assignCustomerToStage, getFunnelData,
  createActivity, listActivities, listQuotes, createQuote, listContracts, createContract,
  createPipelineColumn, updatePipelineColumn, deletePipelineColumn,
  createPipelineStage, updatePipelineStage, deletePipelineStage,
  updateActivityStatus
} from '../controllers/pipeline.controller.js';
import {
  listCustomerCosts, createCustomerCost, updateCustomerCost, deleteCustomerCost, getCustomerCostSummary
} from '../controllers/customer-cost.controller.js';
import { authenticate, requireAdminOrStaff } from '../middleware/index.js';

const router = Router();
router.use(authenticate, requireAdminOrStaff);

router.get('/board',                          getBoardData);
router.post('/customers/:customerId/stage',   assignCustomerToStage);
router.get('/funnel',                         getFunnelData);
router.post('/activities',                    createActivity);
router.get('/activities/:customerId',         listActivities);
router.patch('/activities/:id/status',        updateActivityStatus);
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

router.get('/costs',                          listCustomerCosts);
router.get('/costs/:customerId/summary',      getCustomerCostSummary);
router.post('/costs',                         createCustomerCost);
router.put('/costs/:id',                      updateCustomerCost);
router.delete('/costs/:id',                   deleteCustomerCost);

export default router;
