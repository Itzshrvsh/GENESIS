import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';

type SimulationStatus = 'pending' | 'running' | 'completed' | 'failed';

interface SimulationRecord {
  status: SimulationStatus;
  // additional fields (e.g., startTime) could be added here
}

const simulations = new Map<string, SimulationRecord>();

const router = Router();

/**
 * Launch a new simulation.
 * Returns a generated simulation ID and initial status.
 */
router.post('/launch', (req: Request, res: Response) => {
  const id = randomUUID();
  simulations.set(id, { status: 'running' });

  // Mock simulation lifecycle: automatically complete after 5 seconds
  setTimeout(() => {
    const record = simulations.get(id);
    if (record) {
      record.status = 'completed';
    }
    // In a real app, you might emit telemetry via Socket.IO here.
  }, 5000);

  res.status(201).json({ id, status: 'running' });
});

/**
 * Get the status of a simulation by its ID.
 */
router.get('/status/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const record = simulations.get(id);
  if (!record) {
    return res.status(404).json({ error: 'Simulation not found' });
  }
  res.json({ id, status: record.status });
});

export default router;