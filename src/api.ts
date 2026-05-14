import type {
  HTTPValidationError,
  InviteToken,
  ListUsersParams,
  Token,
  UserCreate,
  UserInvite,
  UserMe,
  UserPassword,
  UserPublic,
  UserRead,
  UserSignUp,
  UserUpdate,
  ValidationError,
} from './types';

const RAW_BASE = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000/';
const API_BASE = RAW_BASE.replace(/\/+$/, '');

const TOKEN_KEY = 'access_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  fieldErrors: Record<string, string>;
  validation: ValidationError[];

  constructor(
    status: number,
    message: string,
    validation: ValidationError[] = [],
  ) {
    super(message);
    this.status = status;
    this.validation = validation;
    this.fieldErrors = {};
    for (const err of validation) {
      const field = err.loc[err.loc.length - 1];
      if (typeof field === 'string') {
        this.fieldErrors[field] = err.msg;
      }
    }
  }
}

async function parseError(res: Response): Promise<ApiError> {
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* ignore */
  }

  if (
    res.status === 422 &&
    body &&
    typeof body === 'object' &&
    'detail' in body
  ) {
    const v = body as HTTPValidationError;
    const first = v.detail?.[0]?.msg ?? 'Datos inválidos';
    return new ApiError(res.status, first, v.detail ?? []);
  }

  if (body && typeof body === 'object' && 'detail' in body) {
    const detail = (body as { detail: unknown }).detail;
    if (typeof detail === 'string') {
      return new ApiError(res.status, detail);
    }
  }

  return new ApiError(res.status, `Error ${res.status}`);
}

interface AuthFetchOptions {
  method?: string;
  body?: unknown;
  token?: string;
}

async function authFetch(path: string, opts: AuthFetchOptions = {}): Promise<Response> {
  const token = opts.token ?? getToken();
  if (!token) throw new ApiError(401, 'No autenticado');

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  let body: BodyInit | undefined;
  if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method: opts.method ?? 'GET',
    headers,
    body,
  });
  return res;
}

export async function register(payload: UserSignUp): Promise<void> {
  const res = await fetch(`${API_BASE}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw await parseError(res);
}

export async function login(email: string, password: string): Promise<Token> {
  const form = new URLSearchParams();
  form.set('username', email);
  form.set('password', password);

  const res = await fetch(`${API_BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as Token;
}

export async function getMe(): Promise<UserMe> {
  const res = await authFetch('/me');
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as UserMe;
}

export async function listUsers(params: ListUsersParams): Promise<UserRead[]> {
  const q = new URLSearchParams();
  q.set('role', params.role);
  if (params.status && params.status !== 'all') q.set('status', params.status);
  if (params.search) q.set('search', params.search);
  if (params.skip !== undefined) q.set('skip', String(params.skip));
  if (params.limit !== undefined) q.set('limit', String(params.limit));

  const res = await authFetch(`/users?${q.toString()}`);
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as UserRead[];
}

export async function getUser(id: number): Promise<UserRead> {
  const res = await authFetch(`/users/${id}`);
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as UserRead;
}

export async function createUser(payload: UserCreate): Promise<UserRead> {
  const res = await authFetch('/users', { method: 'POST', body: payload });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as UserRead;
}

export async function updateUser(
  id: number,
  payload: UserUpdate,
): Promise<UserRead> {
  const res = await authFetch(`/users/${id}`, { method: 'PATCH', body: payload });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as UserRead;
}

export async function deleteUser(id: number): Promise<UserPublic> {
  const res = await authFetch(`/users/${id}`, { method: 'DELETE' });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as UserPublic;
}

export async function inviteUser(payload: UserInvite): Promise<InviteToken> {
  const res = await authFetch('/users/invite', { method: 'POST', body: payload });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as InviteToken;
}

export async function getInvitee(inviteToken: string): Promise<UserPublic> {
  const res = await authFetch('/invites', { token: inviteToken });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as UserPublic;
}

export async function acceptInvite(
  inviteToken: string,
  payload: UserPassword,
): Promise<UserPublic> {
  const res = await authFetch('/invites', {
    method: 'POST',
    body: payload,
    token: inviteToken,
  });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as UserPublic;
}
