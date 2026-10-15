import type { Request, Response } from 'express';
import * as sheetService from './sheet.service.js';

export async function getSheet(_req: Request, res: Response) {
  const sheet = await sheetService.getSheet();
  res.set('Cache-Control', 'private, max-age=300');
  res.json(sheet);
}
