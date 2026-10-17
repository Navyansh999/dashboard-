import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { WorkItemService } from '../services/workItemService.js';
import { authMiddleware } from '../middleware/auth.js';
import { idempotencyMiddleware } from '../middleware/idempotency.js';
import { BadRequestError } from '../middleware/errorHandler.js';

export const workItemRouter = Router();

// All work-item routes require authentication
workItemRouter.use(authMiddleware);

// 1. List work items (with search, filtering, preset views, pagination)
workItemRouter.get('/', (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      teamId,
      status,
      priority,
      type,
      assigneeId,
      q,
      viewPreset,
      limit,
      offset
    } = req.query;

    const result = WorkItemService.listWorkItems(req.user!, {
      teamId: teamId as string | undefined,
      status: status as string | undefined,
      priority: priority as string | undefined,
      type: type as string | undefined,
      assigneeId: assigneeId as string | undefined,
      q: q as string | undefined,
      viewPreset: viewPreset as any,
      limit: limit ? parseInt(limit as string, 10) : 20,
      offset: offset ? parseInt(offset as string, 10) : 0
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// 2. Create work item (protected with idempotency support!)
const createSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().min(5, 'Description must be at least 5 characters'),
  type: z.enum(['INCIDENT', 'CUSTOMER_ISSUE', 'PAYMENT', 'COMPLIANCE', 'OPERATIONAL_TASK']),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
  team_id: z.string().min(1, 'Team ID is required'),
  assignee_id: z.string().nullable().optional(),
  due_date: z.string().nullable().optional()
});

workItemRouter.post('/', idempotencyMiddleware, (req: Request, res: Response, next: NextFunction) => {
  try {
    const parse = createSchema.safeParse(req.body);
    if (!parse.success) {
      throw new BadRequestError('Validation failed', parse.error.format());
    }

    const item = WorkItemService.createWorkItem(req.user!, parse.data);
    res.status(201).json({ item });
  } catch (err) {
    next(err);
  }
});

// 3. Get single work item
workItemRouter.get('/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const item = WorkItemService.getWorkItemById(req.user!, id);
    res.json({ item });
  } catch (err) {
    next(err);
  }
});

// 4. Update work item (with Optimistic Concurrency Control)
const updateSchema = z.object({
  title: z.string().min(3).optional(),
  description: z.string().min(5).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  due_date: z.string().nullable().optional(),
  version: z.number({ required_error: 'Optimistic lock token "version" is required' })
});

workItemRouter.patch('/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const parse = updateSchema.safeParse(req.body);
    if (!parse.success) {
      throw new BadRequestError('Validation failed', parse.error.format());
    }

    const item = WorkItemService.updateWorkItem(req.user!, id, parse.data);
    res.json({ item });
  } catch (err) {
    next(err);
  }
});

// 5. Atomic Claim Work Item
workItemRouter.post('/:id/claim', (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const item = WorkItemService.claimWorkItem(req.user!, id);
    res.json({ item, message: 'Work item successfully claimed' });
  } catch (err) {
    next(err);
  }
});

// 6. Workflow Transition
const transitionSchema = z.object({
  newStatus: z.enum(['OPEN', 'IN_PROGRESS', 'AWAITING_APPROVAL', 'RESOLVED', 'CLOSED']),
  expectedVersion: z.number({ required_error: 'expectedVersion is required for safe workflow transition' }),
  note: z.string().optional()
});

workItemRouter.post('/:id/transition', (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const parse = transitionSchema.safeParse(req.body);
    if (!parse.success) {
      throw new BadRequestError('Validation failed', parse.error.format());
    }

    const item = WorkItemService.transitionStatus(
      req.user!,
      id,
      parse.data.newStatus,
      parse.data.expectedVersion,
      parse.data.note
    );

    res.json({ item, message: `Status transitioned to ${item.status}` });
  } catch (err) {
    next(err);
  }
});

// 7. Get Activity History
workItemRouter.get('/:id/activity', (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const history = WorkItemService.getActivityHistory(req.user!, id);
    res.json({ history });
  } catch (err) {
    next(err);
  }
});

// 8. Get Comments
workItemRouter.get('/:id/comments', (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const comments = WorkItemService.getComments(req.user!, id);
    res.json({ comments });
  } catch (err) {
    next(err);
  }
});

// 9. Add Comment
workItemRouter.post('/:id/comments', (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { body } = req.body;
    if (!body || typeof body !== 'string') {
      throw new BadRequestError('body string is required');
    }

    const comment = WorkItemService.addComment(req.user!, id, body);
    res.status(201).json({ comment });
  } catch (err) {
    next(err);
  }
});
