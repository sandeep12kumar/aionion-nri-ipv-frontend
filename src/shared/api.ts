import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from './types';

// Sign-ins are kept per browser tab, so Admin, Agent and Customer can be tested side by side.
const STAFF_TOKEN = 'ipv.staff.token';
const STAFF_USER = 'ipv.staff.user';
const CUSTOMER_TOKEN = 'ipv.customer.token';

export const getStaffToken = () => sessionStorage.getItem(STAFF_TOKEN);
export const getCustomerToken = () => sessionStorage.getItem(CUSTOMER_TOKEN);
export const setCustomerToken = (token: string) => sessionStorage.setItem(CUSTOMER_TOKEN, token);
export const clearCustomerToken = () => sessionStorage.removeItem(CUSTOMER_TOKEN);

export function getStaffUser(): User | null {
  const raw = sessionStorage.getItem(STAFF_USER);
  return raw ? (JSON.parse(raw) as User) : null;
}

export function setStaffSession(token: string, user: User) {
  sessionStorage.setItem(STAFF_TOKEN, token);
  sessionStorage.setItem(STAFF_USER, JSON.stringify(user));
}

export function clearStaffSession() {
  sessionStorage.removeItem(STAFF_TOKEN);
  sessionStorage.removeItem(STAFF_USER);
}

// Locally the API is on the same address (Vite forwards /api). Live, VITE_API_URL points at API Gateway.
const API_BASE = `${(import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')}/api`;

// The full address of an API path, for the rare call that doesn't go through api().
export const apiUrl = (path: string) => `${API_BASE}${path}`;

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  form?: FormData;
  token?: string | null;
}

async function send(path: string, { method, body, form, token }: RequestOptions = {}) {
  const auth = token === undefined ? getStaffToken() : token;
  const headers: Record<string, string> = {};
  if (auth) headers.Authorization = `Bearer ${auth}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: method ?? (body !== undefined || form ? 'POST' : 'GET'),
      headers,
      body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
    });
  } catch {
    throw new ApiError(0, 'Could not reach the server. Check that it is running.');
  }
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    if (response.status === 401 && auth === getStaffToken() && auth && path !== '/auth/login') {
      clearStaffSession();
      window.location.assign('/login');
    }
    throw new ApiError(response.status, data?.error ?? `Request failed (${response.status})`);
  }
  return response;
}

export async function api<T>(path: string, options?: RequestOptions): Promise<T> {
  const response = await send(path, options);
  return (await response.json()) as T;
}

// With S3 storage the server replies with a short-lived link instead of the file itself.
export async function apiBlob(path: string, options?: RequestOptions): Promise<Blob> {
  const response = await send(path, options);
  if (!response.headers.get('Content-Type')?.includes('application/json')) return response.blob();
  const { url } = (await response.json()) as { url: string };
  let file: Response;
  try {
    file = await fetch(url);
  } catch {
    throw new ApiError(0, 'Could not download the file from storage.');
  }
  if (!file.ok) throw new ApiError(file.status, 'The file could not be opened. Please try again.');
  return file.blob();
}

export async function openProtectedFile(path: string) {
  const url = URL.createObjectURL(await apiBlob(path));
  window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export const errorMessage = (error: unknown) => (error instanceof Error ? error.message : 'Something went wrong');

export function useLoad<T>(load: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const latest = useRef(0);

  const reload = useCallback(async () => {
    const call = ++latest.current;
    setLoading(true);
    try {
      const result = await load();
      if (call === latest.current) {
        setData(result);
        setError(null);
      }
    } catch (err) {
      if (call === latest.current) setError(errorMessage(err));
    } finally {
      if (call === latest.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, error, loading, reload };
}
