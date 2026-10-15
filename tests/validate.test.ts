import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { errorHandler } from '../src/middleware/error.js';
import { validate } from '../src/middleware/validate.js';

const app = express();
app.get(
  '/items/:id',
  validate('params', z.object({ id: z.coerce.number().int().positive() })),
  validate('query', z.object({ page: z.coerce.number().int().min(1).default(1) })),
  (req, res) => {
    res.json({ params: req.params, query: req.query });
  },
);
app.use(errorHandler);

describe('validate middleware', () => {
  it('replaces params and query with parsed values', async () => {
    const res = await request(app).get('/items/42?page=3');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ params: { id: 42 }, query: { page: 3 } });
  });

  it('fills in defaults', async () => {
    const res = await request(app).get('/items/7');
    expect(res.body.query).toEqual({ page: 1 });
  });

  it('returns 400 with field errors on bad input', async () => {
    const res = await request(app).get('/items/abc?page=0');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toHaveProperty('id');
  });
});
