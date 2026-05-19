import type { RequestInit, Response } from 'node-fetch';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface ApiError extends Error {
  status: number;
  response: Response;
  data?: any;
}

/**
 * Basic helper to perform HTTP requests.
 * Uses the browser's fetch API (or node-fetch when bundled for backend).
 */
async function request<T>(
  method: HttpMethod,
  path: string,
  options: {
    body?: any;
    query?: Record<string, string | number | boolean | undefined>;
    token?: string;
    headers?: Record<string, string>;
  } = {}
): Promise<T> {
  const { body, query, token, headers = {} } = options;

  // Build query string
  const qs = query
    ? '?' +
      Object.entries(query)
        .filter(([, v]) => v !== undefined)
        .map(
          ([k, v]) =>
            `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`
        )
        .join('&')
    : '';

  const url = `${BASE_URL}${path}${qs}`;

  const init: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  };

  const response = await fetch(url, init);
  const contentType = response.headers.get('content-type') || '';

  let data: any = undefined;
  if (contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const err: ApiError = new Error(
      `API request failed (${response.status} ${response.statusText})`
    ) as ApiError;
    err.status = response.status;
    err.response = response;
    err.data = data;
    throw err;
  }

  return data as T;
}

/* -------------------------------------------------------------------------- */
/*                              Configuration                                 */
/* -------------------------------------------------------------------------- */

const BASE_URL = import.meta.env.VITE_API_URL ?? '/api';

/* -------------------------------------------------------------------------- */
/*                              Type Definitions                               */
/* -------------------------------------------------------------------------- */

export interface AuthLoginPayload {
  username: string;
  password: string;
}

export interface AuthLoginResponse {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
}

export interface Scenario {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  data?: any;
}

export interface CreateScenarioPayload {
  name: string;
  description?: string;
  data?: any;
}

export interface UpdateScenarioPayload {
  name?: string;
  description?: string;
  data?: any;
}

export interface SimulationLaunchPayload {
  scenarioId: string;
  parameters?: Record<string, any>;
}

export interface SimulationStatus {
  id: string;
  scenarioId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt?: string;
  finishedAt?: string;
  result?: any;
}

/* -------------------------------------------------------------------------- */
/*                              API Functions                                   */
/* -------------------------------------------------------------------------- */

/**
 * Authenticate a user and obtain a JWT token.
 */
export async function login(
  payload: AuthLoginPayload
): Promise<AuthLoginResponse> {
  return request<AuthLoginResponse>('POST', '/auth/login', { body: payload });
}

/**
 * Retrieve the list of scenarios belonging to the authenticated user.
 */
export async function getScenarios(token: string): Promise<Scenario[]> {
  return request<Scenario[]>('GET', '/scenarios', { token });
}

/**
 * Create a new scenario.
 */
export async function createScenario(
  token: string,
  payload: CreateScenarioPayload
): Promise<Scenario> {
  return request<Scenario>('POST', '/scenarios', { token, body: payload });
}

/**
 * Update an existing scenario.
 */
export async function updateScenario(
  token: string,
  scenarioId: string,
  payload: UpdateScenarioPayload
): Promise<Scenario> {
  return request<Scenario>('PUT', `/scenarios/${scenarioId}`, {
    token,
    body: payload,
  });
}

/**
 * Delete a scenario.
 */
export async function deleteScenario(
  token: string,
  scenarioId: string
): Promise<void> {
  await request<void>('DELETE', `/scenarios/${scenarioId}`, { token });
}

/**
 * Launch a simulation for a given scenario.
 */
export async function launchSimulation(
  token: string,
  payload: SimulationLaunchPayload
): Promise<SimulationStatus> {
  return request<SimulationStatus>('POST', '/simulations/launch', {
    token,
    body: payload,
  });
}

/**
 * Get the current status of a simulation.
 */
export async function getSimulationStatus(
  token: string,
  simulationId: string
): Promise<SimulationStatus> {
  return request<SimulationStatus>('GET', `/simulations/${simulationId}`, {
    token,
  });
}

/* -------------------------------------------------------------------------- */
/*                              Exported Helper                                 */
/* -------------------------------------------------------------------------- */

/**
 * Extract the JWT token from the login response.
 */
export function getAccessToken(resp: AuthLoginResponse): string {
  return resp.accessToken;
}