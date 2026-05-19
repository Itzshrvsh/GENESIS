import { Router, Request, Response } from 'express';

interface Scenario {
  id: number;
  name: string;
  description?: string;
}

// In‑memory storage for demo purposes
const scenarios: Scenario[] = [];
let nextId = 1;

const router = Router();

/**
 * Get all scenarios
 */
router.get('/', (_req: Request, res: Response) => {
  res.json(scenarios);
});

/**
 * Get a scenario by ID
 */
router.get('/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const scenario = scenarios.find(s => s.id === id);
  if (!scenario) {
    return res.status(404).json({ message: 'Scenario not found' });
  }
  res.json(scenario);
});

/**
 * Create a new scenario
 */
router.post('/', (req: Request, res: Response) => {
  const { name, description } = req.body;
  if (!name) {
    return res.status(400).json({ message: 'Name is required' });
  }
  const newScenario: Scenario = {
    id: nextId++,
    name,
    description,
  };
  scenarios.push(newScenario);
  res.status(201).json(newScenario);
});

/**
 * Update an existing scenario
 */
router.put('/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const scenarioIndex = scenarios.findIndex(s => s.id === id);
  if (scenarioIndex === -1) {
    return res.status(404).json({ message: 'Scenario not found' });
  }
  const { name, description } = req.body;
  if (!name) {
    return res.status(400).json({ message: 'Name is required' });
  }
  const updatedScenario: Scenario = {
    id,
    name,
    description,
  };
  scenarios[scenarioIndex] = updatedScenario;
  res.json(updatedScenario);
});

/**
 * Delete a scenario
 */
router.delete('/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const scenarioIndex = scenarios.findIndex(s => s.id === id);
  if (scenarioIndex === -1) {
    return res.status(404).json({ message: 'Scenario not found' });
  }
  scenarios.splice(scenarioIndex, 1);
  res.status(204).send();
});

export default router;