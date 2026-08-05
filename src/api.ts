import type {
  AcademyMe,
  AcademyUpdate,
  ActiveSessionRead,
  AnnouncementCreate,
  AnnouncementPreviewRequest,
  AnnouncementPreviewResponse,
  AnnouncementRead,
  AnnouncementRecipientRead,
  AnnouncementUpdate,
  AudiencePreviewRequest,
  AudiencePreviewResponse,
  DebtReminderSuggestRequest,
  AttendanceCreate,
  AttendanceMatrixRead,
  AttendanceRead,
  AttendanceUpdate,
  CourseCreate,
  CourseInstructorRead,
  CourseRead,
  CourseStudentRead,
  CourseUpdate,
  DiscountCreate,
  DiscountRead,
  DiscountUpdate,
  DocumentCategory,
  DocumentDownload,
  DocumentRead,
  DocumentVisibilityUpdate,
  ListDiscountsParams,
  EnrollmentCreate,
  EnrollmentRead,
  EnrollmentUpdate,
  FinanceExpensesRead,
  FinanceIncomeRead,
  FinanceOverviewRead,
  FinancePayrollRead,
  FinancePnlRead,
  GroupCategoryCreate,
  GroupCategoryRead,
  GroupCategoryUpdate,
  GroupCreate,
  GroupRead,
  GroupUpdate,
  HomeMe,
  HTTPValidationError,
  ListGroupsParams,
  InstructorPmtParams,
  InstructorPmtRead,
  InviteToken,
  ListAnnouncementsParams,
  ListAttendanceParams,
  ListCoursesParams,
  ListRecipientsParams,
  ListEnrollmentsParams,
  ListRecurringTransactionsParams,
  ListTransactionsParams,
  ListUsersParams,
  PasswordChange,
  PaymentAccountCreate,
  PaymentAccountRead,
  PaymentAccountTest,
  PaymentAccountUpdate,
  PaymentCreate,
  PaymentIntentRead,
  RecurringTransactionCreate,
  RecurringTransactionRead,
  RecurringTransactionUpdate,
  SessionCreate,
  Token,
  TransactionCreate,
  TransactionRead,
  TransactionSummary,
  TransactionSummaryParams,
  TransactionUpdate,
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

// Handler global de sesión expirada. Lo registra AuthProvider para limpiar el
// estado de React y navegar a /login sin recargar la página. Se dispara cuando
// cualquier llamada autenticada recibe 401 (token expirado o inválido).
type SessionExpiredHandler = () => void;
let sessionExpiredHandler: SessionExpiredHandler | null = null;

export function setSessionExpiredHandler(
  fn: SessionExpiredHandler | null,
): void {
  sessionExpiredHandler = fn;
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
    if (opts.body instanceof FormData) {
      // No fijar Content-Type: el navegador añade el boundary del multipart.
      body = opts.body;
    } else {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(opts.body);
    }
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method: opts.method ?? 'GET',
    headers,
    body,
  });
  if (res.status === 401) {
    // Token expirado o inválido a mitad de sesión: cerrar sesión globalmente
    // para que las guardas de ruta redirijan a /login sin necesidad de refresh.
    clearToken();
    sessionExpiredHandler?.();
  }
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

export async function getMeHome(): Promise<HomeMe> {
  const res = await authFetch('/me/home');
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as HomeMe;
}

export async function changeMyPassword(payload: PasswordChange): Promise<void> {
  const res = await authFetch('/me/password', { method: 'POST', body: payload });
  if (!res.ok) throw await parseError(res);
}

export async function updateMe(patch: UserUpdate): Promise<UserMe> {
  const res = await authFetch('/me', { method: 'PATCH', body: patch });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as UserMe;
}

export async function listUsers(params: ListUsersParams): Promise<UserRead[]> {
  const q = new URLSearchParams();
  if (params.role) q.set('role', params.role);
  if (params.status && params.status !== 'all') q.set('status', params.status);
  if (params.search) q.set('search', params.search);
  if (params.debt_filter) q.set('debt_filter', params.debt_filter);
  if (params.enrollment_fee_month !== undefined)
    q.set('enrollment_fee_month', String(params.enrollment_fee_month));
  if (params.active !== undefined) q.set('active', String(params.active));
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

export async function updateAcademy(
  id: number,
  patch: AcademyUpdate,
): Promise<void> {
  const res = await authFetch(`/academies/${id}`, {
    method: 'PATCH',
    body: patch,
  });
  if (!res.ok) throw await parseError(res);
}

// Sube el logo de la academia (multipart, campo `file`). Tipos permitidos:
// PNG, JPEG, WEBP, SVG. Máx 2 MB. Devuelve la academia con el nuevo logo_url.
export async function uploadAcademyLogo(
  id: number,
  file: File,
): Promise<AcademyMe> {
  const form = new FormData();
  form.append('file', file);
  const res = await authFetch(`/academies/${id}/logo`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as AcademyMe;
}

// Quita el logo. Devuelve la academia con logo_url en null.
export async function deleteAcademyLogo(id: number): Promise<AcademyMe> {
  const res = await authFetch(`/academies/${id}/logo`, { method: 'DELETE' });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as AcademyMe;
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

export async function listCourses(
  params: ListCoursesParams = {},
): Promise<CourseRead[]> {
  const q = new URLSearchParams();
  if (params.status && params.status !== 'all') q.set('status', params.status);
  if (params.instructor) q.set('instructor', params.instructor);
  if (params.search) q.set('search', params.search);
  if (params.active !== undefined) q.set('active', String(params.active));
  if (params.skip !== undefined) q.set('skip', String(params.skip));
  if (params.limit !== undefined) q.set('limit', String(params.limit));

  const qs = q.toString();
  const res = await authFetch(`/courses${qs ? `?${qs}` : ''}`);
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as CourseRead[];
}

export async function listStudentCourses(
  params: { search?: string } = {},
): Promise<CourseStudentRead[]> {
  const q = new URLSearchParams();
  q.set('active', 'true');
  q.set('status', 'active');
  if (params.search) q.set('search', params.search);
  const res = await authFetch(`/courses?${q.toString()}`);
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as CourseStudentRead[];
}

// Cursos del instructor autenticado. El backend scopea `/courses` a las clases
// asignadas y responde con `CourseInstructorRead` (incluye `schedules`), por lo
// que sirve para pintar el calendario del instructor.
export async function listInstructorCourses(
  params: { search?: string } = {},
): Promise<CourseInstructorRead[]> {
  const q = new URLSearchParams();
  q.set('active', 'true');
  q.set('status', 'active');
  if (params.search) q.set('search', params.search);
  const res = await authFetch(`/courses?${q.toString()}`);
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as CourseInstructorRead[];
}

export async function getCourse(id: number): Promise<CourseRead> {
  const res = await authFetch(`/courses/${id}`);
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as CourseRead;
}

export async function createCourse(payload: CourseCreate): Promise<CourseRead> {
  const res = await authFetch('/courses', { method: 'POST', body: payload });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as CourseRead;
}

export async function updateCourse(
  id: number,
  payload: CourseUpdate,
): Promise<CourseRead> {
  const res = await authFetch(`/courses/${id}`, {
    method: 'PATCH',
    body: payload,
  });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as CourseRead;
}

export async function deleteCourse(id: number): Promise<CourseRead> {
  const res = await authFetch(`/courses/${id}`, { method: 'DELETE' });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as CourseRead;
}

export async function listEnrollments(
  params: ListEnrollmentsParams = {},
): Promise<EnrollmentRead[]> {
  const q = new URLSearchParams();
  if (params.course_id !== undefined) q.set('course_id', String(params.course_id));
  if (params.student_id !== undefined) q.set('student_id', String(params.student_id));
  if (params.status) q.set('status', params.status);
  if (params.skip !== undefined) q.set('skip', String(params.skip));
  if (params.limit !== undefined) q.set('limit', String(params.limit));

  const qs = q.toString();
  const res = await authFetch(`/enrollments${qs ? `?${qs}` : ''}`);
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as EnrollmentRead[];
}

export async function createEnrollment(
  payload: EnrollmentCreate,
): Promise<EnrollmentRead> {
  const res = await authFetch('/enrollments', { method: 'POST', body: payload });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as EnrollmentRead;
}

export async function enrollMe(
  course_id: number,
  student_id: number,
): Promise<EnrollmentRead> {
  return createEnrollment({ course_id, student_id });
}

export async function unenrollMe(
  course_id: number,
  student_id: number,
): Promise<EnrollmentRead> {
  return deleteEnrollment(course_id, student_id);
}

export async function updateEnrollment(
  course_id: number,
  student_id: number,
  payload: EnrollmentUpdate,
): Promise<EnrollmentRead> {
  const res = await authFetch(`/enrollments/${course_id}/${student_id}`, {
    method: 'PATCH',
    body: payload,
  });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as EnrollmentRead;
}

export async function deleteEnrollment(
  course_id: number,
  student_id: number,
): Promise<EnrollmentRead> {
  const res = await authFetch(`/enrollments/${course_id}/${student_id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as EnrollmentRead;
}

// ---------- Grupos ----------

export async function listGroupCategories(): Promise<GroupCategoryRead[]> {
  const res = await authFetch('/groups/categories');
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as GroupCategoryRead[];
}

export async function getGroupCategory(id: number): Promise<GroupCategoryRead> {
  const res = await authFetch(`/groups/categories/${id}`);
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as GroupCategoryRead;
}

export async function createGroupCategory(
  payload: GroupCategoryCreate,
): Promise<GroupCategoryRead> {
  const res = await authFetch('/groups/categories', {
    method: 'POST',
    body: payload,
  });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as GroupCategoryRead;
}

export async function updateGroupCategory(
  id: number,
  payload: GroupCategoryUpdate,
): Promise<GroupCategoryRead> {
  const res = await authFetch(`/groups/categories/${id}`, {
    method: 'PATCH',
    body: payload,
  });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as GroupCategoryRead;
}

export async function deleteGroupCategory(id: number): Promise<void> {
  const res = await authFetch(`/groups/categories/${id}`, { method: 'DELETE' });
  if (!res.ok) throw await parseError(res);
}

export async function listGroups(
  params: ListGroupsParams = {},
): Promise<GroupRead[]> {
  const q = new URLSearchParams();
  if (params.category_id !== undefined)
    q.set('category_id', String(params.category_id));
  if (params.skip !== undefined) q.set('skip', String(params.skip));
  if (params.limit !== undefined) q.set('limit', String(params.limit));
  const qs = q.toString();
  const res = await authFetch(`/groups${qs ? `?${qs}` : ''}`);
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as GroupRead[];
}

export async function createGroup(payload: GroupCreate): Promise<GroupRead> {
  const res = await authFetch('/groups', { method: 'POST', body: payload });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as GroupRead;
}

export async function updateGroup(
  id: number,
  payload: GroupUpdate,
): Promise<GroupRead> {
  const res = await authFetch(`/groups/${id}`, { method: 'PATCH', body: payload });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as GroupRead;
}

export async function deleteGroup(id: number): Promise<void> {
  const res = await authFetch(`/groups/${id}`, { method: 'DELETE' });
  if (!res.ok) throw await parseError(res);
}

function txParams(params: ListTransactionsParams): string {
  const q = new URLSearchParams();
  if (params.kind) q.set('kind', params.kind);
  if (params.status) q.set('status', params.status);
  if (params.category) q.set('category', params.category);
  if (params.payment_method) q.set('payment_method', params.payment_method);
  if (params.user_id !== undefined) q.set('user_id', String(params.user_id));
  if (params.from_date) q.set('from_date', params.from_date);
  if (params.to_date) q.set('to_date', params.to_date);
  if (params.search) q.set('search', params.search);
  if (params.skip !== undefined) q.set('skip', String(params.skip));
  if (params.limit !== undefined) q.set('limit', String(params.limit));
  return q.toString();
}

export async function getTransactionsSummary(
  params: TransactionSummaryParams = {},
): Promise<TransactionSummary> {
  const q = new URLSearchParams();
  if (params.kind) q.set('kind', params.kind);
  if (params.category) q.set('category', params.category);
  if (params.user_id !== undefined) q.set('user_id', String(params.user_id));
  if (params.from_date) q.set('from_date', params.from_date);
  if (params.to_date) q.set('to_date', params.to_date);
  const qs = q.toString();
  const res = await authFetch(`/transactions/summary${qs ? `?${qs}` : ''}`);
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as TransactionSummary;
}

export async function listTransactions(
  params: ListTransactionsParams = {},
): Promise<TransactionRead[]> {
  const qs = txParams(params);
  const res = await authFetch(`/transactions${qs ? `?${qs}` : ''}`);
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as TransactionRead[];
}

export async function getTransaction(id: number): Promise<TransactionRead> {
  const res = await authFetch(`/transactions/${id}`);
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as TransactionRead;
}

export async function createTransaction(
  payload: TransactionCreate,
): Promise<TransactionRead> {
  const res = await authFetch('/transactions', {
    method: 'POST',
    body: payload,
  });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as TransactionRead;
}

export async function updateTransaction(
  id: number,
  payload: TransactionUpdate,
): Promise<TransactionRead> {
  const res = await authFetch(`/transactions/${id}`, {
    method: 'PATCH',
    body: payload,
  });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as TransactionRead;
}

export async function deleteTransaction(id: number): Promise<TransactionRead> {
  const res = await authFetch(`/transactions/${id}`, { method: 'DELETE' });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as TransactionRead;
}

// ---------- Pagos (ATH Móvil) ----------
// Cuentas de cobro (solo admin) y disparo del pago contra una Transaction. La
// confirmación/captura las resuelve el backend (job reconcile_payment_intents);
// el frontend refleja el resultado con poll a getTransaction hasta status 'paid'.

export async function listPaymentAccounts(): Promise<PaymentAccountRead[]> {
  const res = await authFetch('/payment-accounts');
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as PaymentAccountRead[];
}

export async function getPaymentAccount(
  id: number,
): Promise<PaymentAccountRead> {
  const res = await authFetch(`/payment-accounts/${id}`);
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as PaymentAccountRead;
}

export async function createPaymentAccount(
  payload: PaymentAccountCreate,
): Promise<PaymentAccountRead> {
  const res = await authFetch('/payment-accounts', {
    method: 'POST',
    body: payload,
  });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as PaymentAccountRead;
}

export async function updatePaymentAccount(
  id: number,
  payload: PaymentAccountUpdate,
): Promise<PaymentAccountRead> {
  const res = await authFetch(`/payment-accounts/${id}`, {
    method: 'PATCH',
    body: payload,
  });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as PaymentAccountRead;
}

export async function deletePaymentAccount(
  id: number,
): Promise<PaymentAccountRead> {
  const res = await authFetch(`/payment-accounts/${id}`, { method: 'DELETE' });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as PaymentAccountRead;
}

// Dispara un cobro REAL de $1.00 con el public token de esta cuenta (aunque no
// sea la predeterminada ni esté activa) para verificar el token. No crea
// Transaction: el intent viene con transaction_id null y no toca la
// contabilidad. El monto lo fija el backend. Errores: 400 (ATH Móvil rechazó —
// el mensaje viene en .message/.detail y se muestra tal cual), 404 (cuenta
// inexistente), 409 (ya hay una prueba en curso), 429 (máx. 5 pruebas/hora).
export async function testPaymentAccount(
  id: number,
  payload: PaymentAccountTest,
): Promise<PaymentIntentRead> {
  const res = await authFetch(`/payment-accounts/${id}/test`, {
    method: 'POST',
    body: payload,
  });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as PaymentIntentRead;
}

// Última prueba de la cuenta, para el poll mientras se espera la aprobación y
// para retomar una prueba en curso al reabrir la pantalla. Devuelve null si la
// cuenta nunca se probó (el backend responde 404 en ese caso).
export async function getPaymentAccountTest(
  id: number,
): Promise<PaymentIntentRead | null> {
  const res = await authFetch(`/payment-accounts/${id}/test`);
  if (res.status === 404) return null;
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as PaymentIntentRead;
}

// Inicia un pago ATH Móvil contra una Transaction existente (pending). Devuelve
// el PaymentIntent en estado 'open'. Errores posibles: 409 (ya hay un pago en
// curso para esa transacción), 400 (transacción no pagable / sin cuenta de
// cobro activa), 404 (transacción inexistente) — todos llegan como ApiError con
// .status y .detail (mensaje legible del backend).
export async function createPayment(
  payload: PaymentCreate,
): Promise<PaymentIntentRead> {
  const res = await authFetch('/payments', { method: 'POST', body: payload });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as PaymentIntentRead;
}

export async function listRecurringTransactions(
  params: ListRecurringTransactionsParams = {},
): Promise<RecurringTransactionRead[]> {
  const q = new URLSearchParams();
  if (params.kind) q.set('kind', params.kind);
  if (params.category) q.set('category', params.category);
  if (params.frequency) q.set('frequency', params.frequency);
  if (params.user_id !== undefined) q.set('user_id', String(params.user_id));
  if (params.course_id !== undefined)
    q.set('course_id', String(params.course_id));
  if (params.active !== undefined) q.set('active', String(params.active));
  if (params.search) q.set('search', params.search);
  if (params.skip !== undefined) q.set('skip', String(params.skip));
  if (params.limit !== undefined) q.set('limit', String(params.limit));
  const qs = q.toString();
  const res = await authFetch(`/recurring-transactions${qs ? `?${qs}` : ''}`);
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as RecurringTransactionRead[];
}

export async function getRecurringTransaction(
  id: number,
): Promise<RecurringTransactionRead> {
  const res = await authFetch(`/recurring-transactions/${id}`);
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as RecurringTransactionRead;
}

export async function createRecurringTransaction(
  payload: RecurringTransactionCreate,
): Promise<RecurringTransactionRead> {
  const res = await authFetch('/recurring-transactions', {
    method: 'POST',
    body: payload,
  });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as RecurringTransactionRead;
}

export async function updateRecurringTransaction(
  id: number,
  payload: RecurringTransactionUpdate,
): Promise<RecurringTransactionRead> {
  const res = await authFetch(`/recurring-transactions/${id}`, {
    method: 'PATCH',
    body: payload,
  });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as RecurringTransactionRead;
}

export async function deleteRecurringTransaction(
  id: number,
): Promise<RecurringTransactionRead> {
  const res = await authFetch(`/recurring-transactions/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as RecurringTransactionRead;
}

// ---------- Descuentos ----------

export async function listDiscounts(
  params: ListDiscountsParams = {},
): Promise<DiscountRead[]> {
  const q = new URLSearchParams();
  if (params.user_id !== undefined) q.set('user_id', String(params.user_id));
  if (params.type) q.set('type', params.type);
  if (params.applies_to) q.set('applies_to', params.applies_to);
  if (params.active !== undefined) q.set('active', String(params.active));
  if (params.search) q.set('search', params.search);
  if (params.skip !== undefined) q.set('skip', String(params.skip));
  if (params.limit !== undefined) q.set('limit', String(params.limit));
  const qs = q.toString();
  const res = await authFetch(`/discounts${qs ? `?${qs}` : ''}`);
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as DiscountRead[];
}

export async function getDiscount(id: number): Promise<DiscountRead> {
  const res = await authFetch(`/discounts/${id}`);
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as DiscountRead;
}

export async function createDiscount(
  payload: DiscountCreate,
): Promise<DiscountRead> {
  const res = await authFetch('/discounts', { method: 'POST', body: payload });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as DiscountRead;
}

export async function updateDiscount(
  id: number,
  payload: DiscountUpdate,
): Promise<DiscountRead> {
  const res = await authFetch(`/discounts/${id}`, {
    method: 'PATCH',
    body: payload,
  });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as DiscountRead;
}

export async function deleteDiscount(id: number): Promise<DiscountRead> {
  const res = await authFetch(`/discounts/${id}`, { method: 'DELETE' });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as DiscountRead;
}

export async function listAttendance(
  params: ListAttendanceParams = {},
): Promise<AttendanceRead[]> {
  const q = new URLSearchParams();
  if (params.course_id !== undefined)
    q.set('course_id', String(params.course_id));
  if (params.user_id !== undefined) q.set('user_id', String(params.user_id));
  if (params.from_date) q.set('from_date', params.from_date);
  if (params.to_date) q.set('to_date', params.to_date);
  if (params.attendance_role) q.set('attendance_role', params.attendance_role);
  if (params.status) q.set('status', params.status);
  if (params.skip !== undefined) q.set('skip', String(params.skip));
  if (params.limit !== undefined) q.set('limit', String(params.limit));

  const qs = q.toString();
  const res = await authFetch(`/attendance${qs ? `?${qs}` : ''}`);
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as AttendanceRead[];
}

export async function createAttendance(
  payload: AttendanceCreate,
): Promise<AttendanceRead> {
  const res = await authFetch('/attendance', { method: 'POST', body: payload });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as AttendanceRead;
}

export async function updateAttendance(
  course_id: number,
  user_id: number,
  scheduled_datetime: string,
  payload: AttendanceUpdate,
): Promise<AttendanceRead> {
  const dt = encodeURIComponent(scheduled_datetime);
  const res = await authFetch(`/attendance/${course_id}/${user_id}/${dt}`, {
    method: 'PATCH',
    body: payload,
  });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as AttendanceRead;
}

export async function deleteAttendance(
  course_id: number,
  user_id: number,
  scheduled_datetime: string,
): Promise<void> {
  const dt = encodeURIComponent(scheduled_datetime);
  const res = await authFetch(`/attendance/${course_id}/${user_id}/${dt}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw await parseError(res);
}

export async function openAttendanceSession(
  payload: SessionCreate,
): Promise<AttendanceRead[]> {
  const res = await authFetch('/attendance/sessions', {
    method: 'POST',
    body: payload,
  });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as AttendanceRead[];
}

export async function getActiveSession(
  course_id: number,
): Promise<ActiveSessionRead> {
  const res = await authFetch(`/courses/${course_id}/active-session`);
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as ActiveSessionRead;
}

export async function getCourseAttendanceMatrix(
  courseId: number,
  params: { from_date?: string; to_date?: string } = {},
): Promise<AttendanceMatrixRead> {
  const q = new URLSearchParams();
  if (params.from_date) q.set('from_date', params.from_date);
  if (params.to_date) q.set('to_date', params.to_date);
  const qs = q.toString();
  const res = await authFetch(
    `/courses/${courseId}/attendance-matrix${qs ? `?${qs}` : ''}`,
  );
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as AttendanceMatrixRead;
}

// ---------- Documentos de usuario ----------

export async function listUserDocuments(
  userId: number,
): Promise<DocumentRead[]> {
  const res = await authFetch(`/documents/users/${userId}`);
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as DocumentRead[];
}

export async function uploadUserDocument(
  userId: number,
  category: DocumentCategory,
  file: File,
): Promise<DocumentRead> {
  const form = new FormData();
  form.append('file', file);
  const res = await authFetch(
    `/documents/users/${userId}?category=${encodeURIComponent(category)}`,
    { method: 'POST', body: form },
  );
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as DocumentRead;
}

export async function getDocumentDownload(
  docId: number,
): Promise<DocumentDownload> {
  const res = await authFetch(`/documents/users/${docId}/download`);
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as DocumentDownload;
}

export async function updateDocumentVisibility(
  docId: number,
  payload: DocumentVisibilityUpdate,
): Promise<DocumentRead> {
  const res = await authFetch(`/documents/users/${docId}`, {
    method: 'PATCH',
    body: payload,
  });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as DocumentRead;
}

export async function deleteDocument(docId: number): Promise<DocumentRead> {
  const res = await authFetch(`/documents/users/${docId}`, { method: 'DELETE' });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as DocumentRead;
}

// ---------- Finanzas (dashboards) ----------
// Solo lectura. month (1-12), year (>=2025). No se envía group_category_id: el
// desglose de ingresos es por usuario, no por grupo.

function dashboardQuery(month: number, year: number): string {
  const q = new URLSearchParams();
  q.set('month', String(month));
  q.set('year', String(year));
  return q.toString();
}

export async function getFinanceOverview(
  month: number,
  year: number,
): Promise<FinanceOverviewRead> {
  const res = await authFetch(`/dashboards/overview?${dashboardQuery(month, year)}`);
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as FinanceOverviewRead;
}

export async function getFinanceIncome(
  month: number,
  year: number,
): Promise<FinanceIncomeRead> {
  const res = await authFetch(`/dashboards/income?${dashboardQuery(month, year)}`);
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as FinanceIncomeRead;
}

export async function getFinanceExpenses(
  month: number,
  year: number,
): Promise<FinanceExpensesRead> {
  const res = await authFetch(`/dashboards/expenses?${dashboardQuery(month, year)}`);
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as FinanceExpensesRead;
}

export async function getFinancePnl(
  month: number,
  year: number,
): Promise<FinancePnlRead> {
  const res = await authFetch(`/dashboards/pnl?${dashboardQuery(month, year)}`);
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as FinancePnlRead;
}

export async function getFinancePayroll(
  month: number,
  year: number,
): Promise<FinancePayrollRead> {
  const res = await authFetch(`/dashboards/payroll?${dashboardQuery(month, year)}`);
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as FinancePayrollRead;
}

export async function getInstructorPmt(
  user_id: number,
  params: InstructorPmtParams = {},
): Promise<InstructorPmtRead> {
  const q = new URLSearchParams();
  if (params.from_date) q.set('from_date', params.from_date);
  if (params.to_date) q.set('to_date', params.to_date);
  const qs = q.toString();
  const res = await authFetch(
    `/users/${user_id}/instructor-pmt${qs ? `?${qs}` : ''}`,
  );
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as InstructorPmtRead;
}

// ---------- Comunicados ----------

export async function listAnnouncements(
  params: ListAnnouncementsParams = {},
): Promise<AnnouncementRead[]> {
  const q = new URLSearchParams();
  if (params.status) q.set('status', params.status);
  if (params.category) q.set('category', params.category);
  if (params.search) q.set('search', params.search);
  if (params.skip !== undefined) q.set('skip', String(params.skip));
  if (params.limit !== undefined) q.set('limit', String(params.limit));
  const qs = q.toString();
  const res = await authFetch(`/announcements${qs ? `?${qs}` : ''}`);
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as AnnouncementRead[];
}

export async function getAnnouncement(id: number): Promise<AnnouncementRead> {
  const res = await authFetch(`/announcements/${id}`);
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as AnnouncementRead;
}

export async function createAnnouncement(
  payload: AnnouncementCreate,
): Promise<AnnouncementRead> {
  const res = await authFetch('/announcements', {
    method: 'POST',
    body: payload,
  });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as AnnouncementRead;
}

export async function updateAnnouncement(
  id: number,
  payload: AnnouncementUpdate,
): Promise<AnnouncementRead> {
  const res = await authFetch(`/announcements/${id}`, {
    method: 'PATCH',
    body: payload,
  });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as AnnouncementRead;
}

export async function deleteAnnouncement(id: number): Promise<void> {
  const res = await authFetch(`/announcements/${id}`, { method: 'DELETE' });
  if (!res.ok) throw await parseError(res);
}

export async function sendAnnouncement(id: number): Promise<AnnouncementRead> {
  const res = await authFetch(`/announcements/${id}/send`, { method: 'POST' });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as AnnouncementRead;
}

export async function previewAnnouncement(
  payload: AnnouncementPreviewRequest,
): Promise<AnnouncementPreviewResponse> {
  const res = await authFetch('/announcements/preview', {
    method: 'POST',
    body: payload,
  });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as AnnouncementPreviewResponse;
}

// Sugiere un borrador de recordatorio de deuda (asunto + prosa + audiencia).
// `userId` presente → 1 alumno; ausente → masivo (todos con deuda). El front solo
// pre-llena el compositor; el alta ocurre con createAnnouncement al guardar/enviar.
export async function suggestDebtReminder(
  userId?: number | null,
): Promise<AnnouncementCreate> {
  const payload: DebtReminderSuggestRequest = { user_id: userId ?? null };
  const res = await authFetch('/announcements/debt-reminder/suggest', {
    method: 'POST',
    body: payload,
  });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as AnnouncementCreate;
}

export async function previewAudience(
  payload: AudiencePreviewRequest,
): Promise<AudiencePreviewResponse> {
  const res = await authFetch('/announcements/audience/preview', {
    method: 'POST',
    body: payload,
  });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as AudiencePreviewResponse;
}

export async function listRecipients(
  id: number,
  params: ListRecipientsParams = {},
): Promise<AnnouncementRecipientRead[]> {
  const q = new URLSearchParams();
  if (params.status) q.set('status', params.status);
  if (params.skip !== undefined) q.set('skip', String(params.skip));
  if (params.limit !== undefined) q.set('limit', String(params.limit));
  const qs = q.toString();
  const res = await authFetch(
    `/announcements/${id}/recipients${qs ? `?${qs}` : ''}`,
  );
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as AnnouncementRecipientRead[];
}

export async function resendRecipient(
  id: number,
  recipientId: number,
): Promise<AnnouncementRecipientRead> {
  const res = await authFetch(
    `/announcements/${id}/recipients/${recipientId}/resend`,
    { method: 'POST' },
  );
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as AnnouncementRecipientRead;
}

export async function listMyAnnouncements(
  params: { skip?: number; limit?: number } = {},
): Promise<AnnouncementRead[]> {
  const q = new URLSearchParams();
  if (params.skip !== undefined) q.set('skip', String(params.skip));
  if (params.limit !== undefined) q.set('limit', String(params.limit));
  const qs = q.toString();
  const res = await authFetch(`/me/announcements${qs ? `?${qs}` : ''}`);
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as AnnouncementRead[];
}
