import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import * as controller from './sheet.controller.js';

export const sheetRouter = Router();

sheetRouter.get('/', requireAuth, controller.getSheet);
