export type AcademyType =
  | 'school'
  | 'dance_academy'
  | 'music_academy'
  | 'martial_arts_academy'
  | 'sports_academy'
  | 'art_academy'
  | 'holistic_center_yoga'
  | 'other';

export type AcademyPlan = 'starter' | 'professional';

export type UserStatus = 'pending' | 'active' | 'inactive';

export type UserRole =
  | 'admin'
  | 'receptionist'
  | 'instructor'
  | 'instructor_student' // híbrido: imparte clases y a la vez es alumno
  | 'student';

export type UserGender = 'masculine' | 'feminine';

export type PaymentMethod =
  | 'credit_card'
  | 'debit_card'
  | 'paypal'
  | 'bank_transfer'
  | 'cash'
  | 'other';

export type CourseStatus = 'active' | 'draft' | 'archived';

export type CourseRecurrence = 'weekly' | 'one_time';

export type ScheduleDay =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

export type InstructorType = 'instructor' | 'assistant';

export type EnrollmentStatus = 'active' | 'waiting' | 'completed' | 'cancelled';

export type TransactionKind = 'sale' | 'expense';

export type TransactionStatus = 'scheduled' | 'pending' | 'paid' | 'cancelled';

export type TransactionCategory =
  | 'tuition'
  | 'enrollment_fee'
  | 'class_fee'
  | 'material_sale'
  | 'exam_fee'
  | 'private_class'
  | 'other_income'
  | 'rent'
  | 'utilities'
  | 'salary'
  | 'marketing'
  | 'equipment'
  | 'other_expense';

export type TransactionFrequency =
  | 'weekly'
  | 'monthly'
  | 'quarterly'
  | 'semester'
  | 'annual'
  | 'one_time';

export type EnrollmentFeeMode =
  | 'annual_recurring'
  | 'one_time_on_signup'
  | 'none';

export type WeekendBillingBehavior =
  | 'ignore'
  | 'shift_previous'
  | 'shift_next';

export type Debt = 'any' | 'none' | 'tuition' | 'enrollment_fee';

export type CourseStudentStatusFilter = 'enrolled' | 'available';

export interface UserSignUp {
  first_name: string;
  last_name: string;
  academy_name: string;
  academy_type: AcademyType;
  // Requeridos por el backend; editables luego en Configuración.
  academy_country: string;
  academy_timezone: string;
  academy_primary_color: string | null;
  academy_secondary_color: string | null;
  academy_accent_color: string | null;
  academy_plan: AcademyPlan | null;
  email: string;
  phone: string | null;
  password: string;
}

export interface Token {
  access_token: string;
  token_type: string;
}

export interface AcademyMe {
  id: number;
  name: string;
  type: AcademyType;
  plan: AcademyPlan | null;
  default_instructor_hourly_rate: number | null;
  default_assistant_hourly_rate: number | null;
  students_self_unenroll: boolean | null;
  // Si la academia permite que el estudiante se inscriba a clases por sí mismo.
  // Default backend: false (solo el admin inscribe).
  students_self_enroll: boolean | null;
  currency: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
  country: string;
  timezone: string;
  default_billing_day: number | null;
  billing_lookahead_months: number | null;
  auto_billing_enabled: boolean | null;
  enrollment_fee_amount: number | null;
  enrollment_fee_month: number | null;
  enrollment_fee_mode: EnrollmentFeeMode | null;
  weekend_billing_behavior: WeekendBillingBehavior | null;
  // Días de gracia para pagar a partir del día de cobro (default 7).
  payment_grace_days: number | null;
}

// Campos editables de la academia desde la pantalla de configuración (admin).
// PATCH /academies/{id}. `name` y `payment_grace_days` requieren cambios de
// backend (ver STUDENTS_TABLE_BACKEND_PROMPT.md); el resto ya existe en OpenAPI.
export interface AcademyUpdate {
  name?: string;
  type?: AcademyType;
  plan?: AcademyPlan | null;
  default_instructor_hourly_rate?: number | null;
  default_assistant_hourly_rate?: number | null;
  students_self_unenroll?: boolean | null;
  students_self_enroll?: boolean | null;
  currency?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
  accent_color?: string | null;
  country?: string;
  timezone?: string;
  default_billing_day?: number | null;
  billing_lookahead_months?: number | null;
  auto_billing_enabled?: boolean | null;
  enrollment_fee_amount?: number | null;
  enrollment_fee_month?: number | null;
  enrollment_fee_mode?: EnrollmentFeeMode | null;
  weekend_billing_behavior?: WeekendBillingBehavior | null;
  payment_grace_days?: number | null;
}

export interface AcademyPublic {
  id: number;
  name: string;
  type: AcademyType;
  students_self_enroll?: boolean | null;
}

export interface UserMe {
  id: number;
  role: UserRole;
  first_name: string;
  last_name: string;
  email: string | null;
  status: UserStatus;
  is_active: boolean;
  academy: AcademyMe;
  credentials: string | null;
  pending_transactions: TransactionUserRead[];
  debt_amount: number | null;
  next_due_date: string | null;
  next_due_amount: number | null;
}

export interface UserRead {
  id: number;
  // Rol real del usuario. Pendiente en OpenAPI: el backend debe exponer `role`
  // en UserRead para poder mostrar/predefinir el rol al editar (ver punto 1 del
  // rol instructor_student). Nullable hasta que el backend lo agregue.
  role?: UserRole | null;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  date_of_birth: string | null;
  start_date: string | null;
  gender: UserGender | null;
  postal_code: string | null;
  father_name: string | null;
  father_occupation: string | null;
  father_employer: string | null;
  father_address: string | null;
  father_phone: string | null;
  mother_name: string | null;
  mother_occupation: string | null;
  mother_employer: string | null;
  mother_address: string | null;
  mother_phone: string | null;
  emergency_contact_1_name: string | null;
  emergency_contact_1_phone: string | null;
  emergency_contact_1_relationship: string | null;
  emergency_contact_2_name: string | null;
  emergency_contact_2_phone: string | null;
  emergency_contact_2_relationship: string | null;
  payment_method: PaymentMethod | null;
  special_conditions: string | null;
  status: UserStatus;
  credentials: string | null;
  is_active: boolean;
  academy: AcademyPublic;
  pending_transactions: TransactionUserRead[];
  debt_amount: number | null;
  next_due_date: string | null;
  next_due_amount: number | null;
  role_consecutive: number; // número de estudiante (BE ya lo expone)
  // Grupos a los que pertenece el alumno (puede pertenecer a varios, incluso de
  // la misma categoría). Ver GroupPublic.
  groups?: GroupPublic[] | null;
  // Montos activos de la tabla (cents); el BE ya los expone (nullable).
  tuition_amount: number | null; // costo mensualidad activa (cents)
  enrollment_fee_amount: number | null; // costo matrícula anual activa (cents)
}

// ---------- Grupos ----------
// Modelo de dos niveles: una Categoría (is_ordinal) contiene varios Grupos.
// `is_ordinal=false` → grupo cualitativo (rank no aplica). `is_ordinal=true` →
// grupo ordinal (importa el orden: cada grupo tiene rank).

export interface GroupCategoryPublic {
  id: number;
  name: string;
  is_ordinal: boolean;
}

export interface GroupPublic {
  id: number;
  name: string;
  category_id: number;
  rank: number | null;
  category: GroupCategoryPublic; // categoría anidada (úsala para is_ordinal/nombre)
}

// En openapi.json GroupRead es GroupPublic + `academy_id` (opcional). Se expone
// en lectura para poder reenviarlo en el payload de escritura de cursos (Group).
export interface GroupRead extends GroupPublic {
  academy_id?: number | null;
}

// Forma de grupo que espera el backend al crear/actualizar cursos. A diferencia
// de la lectura (GroupPublic/GroupRead), no lleva `category` anidada y `academy_id`
// es requerido. Se construye desde el GroupPicker arrastrando el academy_id del grupo.
export interface Group {
  id?: number | null;
  name: string;
  category_id: number;
  rank?: number | null;
  academy_id: number | null;
}

export interface GroupCreate {
  name: string;
  category_id: number;
  rank?: number | null;
}

export interface GroupUpdate {
  name: string;
  category_id: number;
  rank?: number | null;
}

export interface GroupCategoryRead {
  id: number;
  name: string;
  is_ordinal: boolean;
  groups: GroupRead[]; // grupos anidados
}

export interface GroupCategoryCreate {
  name: string;
  is_ordinal?: boolean | null;
}

export interface GroupCategoryUpdate {
  name: string;
  is_ordinal?: boolean | null;
}

export interface ListGroupsParams {
  category_id?: number;
  skip?: number;
  limit?: number;
}

export interface UserCreate {
  first_name: string;
  last_name: string;
  role: UserRole;
  email: string | null;
  phone: string | null;
  address: string | null;
  date_of_birth: string | null;
  start_date: string | null;
  payment_method: PaymentMethod | null;
  special_conditions: string | null;
  credentials?: string | null;
  gender?: UserGender | null;
  postal_code?: string | null;
  father_name?: string | null;
  father_occupation?: string | null;
  father_employer?: string | null;
  father_address?: string | null;
  father_phone?: string | null;
  mother_name?: string | null;
  mother_occupation?: string | null;
  mother_employer?: string | null;
  mother_address?: string | null;
  mother_phone?: string | null;
  emergency_contact_1_name?: string | null;
  emergency_contact_1_phone?: string | null;
  emergency_contact_1_relationship?: string | null;
  emergency_contact_2_name?: string | null;
  emergency_contact_2_phone?: string | null;
  emergency_contact_2_relationship?: string | null;
  groups?: GroupPublic[];
}

export interface UserInvite {
  first_name: string;
  last_name: string;
  email: string;
  role: UserRole;
}

export interface UserUpdate {
  first_name: string;
  last_name: string;
  // Cambiar el rol al editar (student/instructor ↔ instructor_student).
  // Pendiente en OpenAPI: el backend debe aceptar `role` en UserUpdate y manejar
  // los efectos (links de instructor, cobros de estudiante). Opcional: si no se
  // envía, el rol no cambia.
  role?: UserRole;
  phone: string | null;
  address: string | null;
  date_of_birth: string | null;
  start_date: string | null;
  payment_method: PaymentMethod | null;
  special_conditions: string | null;
  status: UserStatus | null;
  credentials?: string | null;
  gender?: UserGender | null;
  postal_code?: string | null;
  father_name?: string | null;
  father_occupation?: string | null;
  father_employer?: string | null;
  father_address?: string | null;
  father_phone?: string | null;
  mother_name?: string | null;
  mother_occupation?: string | null;
  mother_employer?: string | null;
  mother_address?: string | null;
  mother_phone?: string | null;
  emergency_contact_1_name?: string | null;
  emergency_contact_1_phone?: string | null;
  emergency_contact_1_relationship?: string | null;
  emergency_contact_2_name?: string | null;
  emergency_contact_2_phone?: string | null;
  emergency_contact_2_relationship?: string | null;
  groups?: GroupPublic[];
}

export interface UserPublic {
  id: number;
  first_name: string;
  last_name: string;
}

export interface UserPassword {
  email: string;
  password: string;
}

export interface PasswordChange {
  current_password: string;
  new_password: string;
}

export interface InviteToken {
  invite_token: string;
  token_type: string;
}

export interface ListUsersParams {
  role: UserRole;
  status?: UserStatus | 'all';
  search?: string;
  debt_filter?: Debt;
  // Mes (1-12): devuelve estudiantes con matrícula anual programada ese mes.
  enrollment_fee_month?: number;
  active?: boolean;
  skip?: number;
  limit?: number;
}

export interface TransactionUserRead {
  id: number;
  kind: TransactionKind;
  category: TransactionCategory;
  status: TransactionStatus;
  description: string;
  transaction_date: string;
  amount: number;
  period_start: string | null;
  period_end: string | null;
  recurring_id: number | null;
  course_id: number | null;
}

export interface TransactionCreate {
  kind: TransactionKind;
  category: TransactionCategory;
  status: TransactionStatus;
  description: string;
  transaction_date: string;
  // Monto bruto en cents (antes de descuento). El backend calcula el neto.
  gross_amount: number;
  user_id: number | null;
  external_name: string | null;
  course_id: number | null;
  period_start: string | null;
  period_end: string | null;
  paid_date: string | null;
  payment_method: PaymentMethod | null;
  recurring_id: number | null;
  payment_reference: string | null;
  payment_notes: string | null;
  // Descuento puntual de la transacción. Es fijo (discount_amount, cents) O
  // porcentual (discount_percentage, 0–100), nunca ambos a la vez.
  discount_amount: number | null;
  discount_percentage: number | null;
  discount_description: string | null;
  // Lo setea el backend para transacciones generadas desde un descuento
  // recurrente del estudiante. En alta/edición manual va null.
  discount_id: number | null;
}

export type TransactionUpdate = TransactionCreate;

export interface TransactionRead extends TransactionCreate {
  // Monto neto (cents) calculado por el backend a partir de gross_amount y el
  // descuento. Read-only: no se envía en create/update.
  amount: number;
  id: number;
  user: UserPublic | null;
}

export interface TransactionSummary {
  total: number;
  total_count: number;
  paid: number;
  pending: number;
  pending_count: number;
}

export interface RecurringTransactionCreate {
  kind: TransactionKind;
  category: TransactionCategory;
  description: string;
  frequency: TransactionFrequency;
  amount: number;
  user_id: number | null;
  external_name: string | null;
  course_id: number | null;
  billing_day: number | null;
  // Mes (1-12) del cargo para frecuencias anuales (p. ej. matrícula anual).
  // Lo usa el filtro "mes de matrícula" del módulo de estudiantes.
  billing_month?: number | null;
  start_date: string | null;
  end_date: string | null;
}

export type RecurringTransactionUpdate = RecurringTransactionCreate;

export interface RecurringTransactionRead extends RecurringTransactionCreate {
  id: number;
  user: UserPublic | null;
}

export interface ListTransactionsParams {
  kind?: TransactionKind;
  status?: TransactionStatus;
  category?: TransactionCategory;
  payment_method?: PaymentMethod;
  user_id?: number;
  from_date?: string;
  to_date?: string;
  search?: string;
  skip?: number;
  limit?: number;
}

export interface ListRecurringTransactionsParams {
  kind?: TransactionKind;
  category?: TransactionCategory;
  frequency?: TransactionFrequency;
  user_id?: number;
  course_id?: number;
  active?: boolean;
  search?: string;
  skip?: number;
  limit?: number;
}

export interface TransactionSummaryParams {
  kind?: TransactionKind;
  category?: TransactionCategory;
  user_id?: number;
  from_date?: string;
  to_date?: string;
}

// ---------- Descuentos ----------
// Descuento persistente por estudiante (tabla `discount`). El backend lo aplica
// al generar las recurring transactions; el front solo administra el CRUD.

export type DiscountType = 'family_discount' | 'scholarship' | 'other';

export type DiscountValueType = 'percentage' | 'fixed';

export type DiscountAppliesTo = 'tuition' | 'enrollment_fee' | 'both';

export interface DiscountCreate {
  user_id: number;
  type: DiscountType;
  value_type: DiscountValueType;
  // Según value_type: 'percentage' usa percentage (0–100) y amount null;
  // 'fixed' usa amount (cents) y percentage null. Exactamente uno.
  percentage: number | null;
  amount: number | null;
  applies_to: DiscountAppliesTo;
  description: string | null;
}

export interface DiscountUpdate extends DiscountCreate {
  is_active: boolean;
}

export interface DiscountRead extends DiscountCreate {
  is_active: boolean;
  id: number;
}

export interface ListDiscountsParams {
  user_id?: number;
  type?: DiscountType;
  applies_to?: DiscountAppliesTo;
  active?: boolean;
  search?: string;
  skip?: number;
  limit?: number;
}

export interface CoursePublic {
  id: number;
  name: string;
  description: string | null;
}

export interface ScheduleCreate {
  schedule_day: ScheduleDay;
  schedule_time: string;
}

export interface Schedule {
  id: number | null;
  schedule_day: ScheduleDay;
  schedule_time: string;
  course_id: number;
}

export interface CourseInstructorLinkCreate {
  instructor_id: number;
  type: InstructorType;
  hourly_rate: number | null;
}

export interface CourseInstructorLinkRead {
  id: number;
  course_id: number;
  instructor_id: number;
  type: InstructorType;
  hourly_rate: number | null;
  instructor: UserPublic;
}

export interface CourseInstructorLinkPublic {
  type: InstructorType;
  instructor: UserPublic;
}

export interface CourseRead {
  id: number;
  name: string;
  description: string | null;
  status: CourseStatus | null;
  recurrence: CourseRecurrence | null;
  duration_minutes: number;
  max_students: number | null;
  individual_cost: number | null;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  schedules: ScheduleCreate[];
  instructor_links: CourseInstructorLinkRead[];
  groups: GroupPublic[];
}

// Forma mínima que necesita el calendario semanal. Tanto `CourseRead` (admin)
// como `CourseInstructorRead` (instructor) son asignables a este tipo, lo que
// permite reutilizar CalendarView/DayList con el rol que sea.
export interface CalendarCourse {
  id: number;
  name: string;
  location?: string | null;
  recurrence: CourseRecurrence | null;
  duration_minutes: number;
  start_date: string | null;
  end_date: string | null;
  schedules: { schedule_day: ScheduleDay; schedule_time: string }[];
  instructor_links: { type: InstructorType; instructor: UserPublic }[];
}

export interface CourseCreate {
  name: string;
  description: string | null;
  status: CourseStatus | null;
  recurrence: CourseRecurrence | null;
  duration_minutes: number;
  max_students: number | null;
  individual_cost: number | null;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  schedules: ScheduleCreate[];
  instructor_links: CourseInstructorLinkCreate[];
  // Opcional en el contrato (default []); se llena desde el GroupPicker. Usa el
  // tipo de escritura `Group` (incluye academy_id), no GroupPublic.
  groups?: Group[];
}

export type CourseUpdate = CourseCreate;

export interface CourseStudentRead {
  id: number;
  name: string;
  description: string | null;
  status: CourseStatus;
  recurrence: CourseRecurrence;
  duration_minutes: number;
  individual_cost: number | null;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  schedules: Schedule[];
  instructor_links: CourseInstructorLinkPublic[];
  has_capacity: boolean;
  // Calculado por el backend: si el alumno cumple las reglas de grupos de la clase.
  can_enroll: boolean;
  // Grupos requeridos por la clase (para mostrar el motivo del bloqueo).
  groups: GroupPublic[];
}

export interface ListCoursesParams {
  status?: CourseStatus | 'all';
  instructor?: string;
  search?: string;
  active?: boolean;
  skip?: number;
  limit?: number;
}

export interface EnrollmentCreate {
  course_id: number;
  student_id: number;
}

export interface EnrollmentUpdate {
  status: EnrollmentStatus | null;
  completion_date: string | null;
}

export interface EnrollmentRead {
  status: EnrollmentStatus | null;
  completion_date: string | null;
  course: CourseRead;
  student: UserPublic;
  waiting_position: number | null;
  waitlisted_at: string | null;
}

export interface ListEnrollmentsParams {
  course_id?: number;
  student_id?: number;
  status?: EnrollmentStatus;
  skip?: number;
  limit?: number;
}

export interface ValidationError {
  loc: (string | number)[];
  msg: string;
  type: string;
}

export interface HTTPValidationError {
  detail: ValidationError[];
}

export type AttendanceStatus = 'present' | 'absent' | 'excused';

export type AttendanceRole = 'student' | 'instructor' | 'assistant';

export interface AttendanceCreate {
  scheduled_datetime: string;
  course_id: number;
  user_id: number;
  status: AttendanceStatus;
  attendance_role: AttendanceRole;
}

export interface AttendanceUpdate {
  status: AttendanceStatus;
  attendance_role: AttendanceRole;
}

export interface AttendanceRead {
  scheduled_datetime: string;
  course_id: number;
  user_id: number;
  status: AttendanceStatus;
  attendance_role: AttendanceRole;
  user: UserPublic;
  course: CoursePublic;
  created_at: string;
  created_by: UserPublic;
  updated_at: string;
}

export interface SessionCreate {
  scheduled_datetime: string;
  course_id: number;
}

export interface ListAttendanceParams {
  course_id?: number;
  user_id?: number;
  from_date?: string;
  to_date?: string;
  attendance_role?: AttendanceRole;
  status?: AttendanceStatus;
  skip?: number;
  limit?: number;
}

export interface CoursePmtRead {
  course_id: number;
  course_name: string;
  attendance_role: AttendanceRole;
  sessions: number;
  minutes: number;
  hours: number;
  hourly_rate: number;
  payment: number;
}

export interface InstructorPmtRead {
  total_minutes: number;
  total_hours: number;
  total_payment: number;
  by_course: CoursePmtRead[];
}

export interface InstructorPmtParams {
  from_date?: string;
  to_date?: string;
}

export interface ActiveSessionRead {
  scheduled_datetime: string | null;
  is_in_window: boolean;
}

export interface AttendanceMe {
  pct_last_12: number;
  present: number;
  absent: number;
  total: number;
}

export interface NextSessionMe {
  course: CourseRead;
  datetime: string;
}

export interface HomeMeInstructorKpis {
  active_courses: number;
  total_students: number;
  hours_this_month: number;
  pending_amount: number; // cents
}

export interface AssignedCourseRead {
  course: CoursePublic;
  next_session_datetime: string | null; // ISO
  has_active_session: boolean;
}

export interface HomeMePayouts {
  pending: TransactionRead[];
  scheduled: TransactionRead[];
  paid_recent: TransactionRead[];
}

export interface HomeMe {
  user: UserRead;
  enrolled_courses: CourseRead[];
  pending_transactions: TransactionRead[];
  scheduled_transactions: TransactionRead[];
  attendance_summary: AttendanceMe | null;
  next_session: NextSessionMe | null;
  // null cuando role != instructor:
  instructor_kpis: HomeMeInstructorKpis | null;
  assigned_courses: AssignedCourseRead[];
  payouts: HomeMePayouts | null;
}

// Schema dedicado al instructor (BE-5): sin individual_cost, instructor_links
// usa CourseInstructorLinkPublic (sin hourly_rate), has_capacity como bool.
export interface CourseInstructorRead {
  id: number;
  name: string;
  description: string | null;
  status: CourseStatus;
  recurrence: CourseRecurrence;
  duration_minutes: number;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  schedules: Schedule[];
  instructor_links: CourseInstructorLinkPublic[];
  has_capacity: boolean;
}

export interface AttendanceCell {
  scheduled_datetime: string; // ISO
  status: AttendanceStatus;
}

export interface StudentAttendanceRow {
  id: number;
  first_name: string;
  last_name: string;
  special_conditions: string | null;
  attendance_pct: number | null;
  attendance: AttendanceCell[];
}

export interface AttendanceMatrixRead {
  course: CourseInstructorRead;
  capacity: { enrolled: number; max: number };
  sessions: string[]; // ISO datetimes, asc
  students: StudentAttendanceRow[];
}

// ---------- Documentos ----------

export type DocumentCategory =
  | 'contract'
  | 'certificate'
  | 'id_document'
  | 'medical'
  | 'other';

// `private`: lo ven el propio usuario y la administración (cosas personales).
// `academy`: lo ve toda la academia (cosas públicas, ej. certificados).
export type DocumentVisibility = 'private' | 'academy';

export interface DocumentRead {
  id: number;
  category: DocumentCategory;
  visibility: DocumentVisibility;
  file_name: string;
  content_type: string;
  size_bytes: number;
  blob_path: string;
  uploaded_by_id: number;
}

export interface DocumentDownload {
  url: string;
  expires_in: number;
}

export interface DocumentVisibilityUpdate {
  visibility: DocumentVisibility;
}

// ---------- Finanzas (dashboards) ----------
// Derivados de openapi.json (schemas Finance*). Solo lectura: el backend ya
// agrega totales/variaciones; el frontend solo pinta. Montos en cents.

export interface KpiValue {
  value: number;
  prev_value: number;
  delta_pct: number | null;
}

export interface CategoryBreakdown {
  category: TransactionCategory;
  amount: number;
  count: number;
  pct: number;
}

export interface MethodBreakdown {
  payment_method: PaymentMethod;
  amount: number;
  count: number;
  pct: number;
}

export interface UserBreakdown {
  user: string;
  amount: number;
  count: number;
  pct: number;
}

export interface IncomeMonthStacked {
  month: string;
  by_category: TransactionCategory;
  total: number;
}

export interface MonthOverview {
  income: number;
  expense: number;
  net_profit: number;
}

export interface PnL {
  service_income: number;
  cogs: number;
  gross_profit: number;
  operating_expenses: number;
  operating_profit: number;
  other_income: number;
  other_expense: number;
  net_profit: number;
  margin: number;
}

export interface UpcomingPayment {
  id: number;
  description: string;
  date: string;
  amount: number;
  kind: TransactionKind;
  status: TransactionStatus;
}

export interface ExpenseBudget {
  scheduled_total: number;
  used_total: number;
  used_pct: number;
}

export interface FinanceOverviewKpis {
  total_income: KpiValue;
  total_expense: KpiValue;
  net_profit: KpiValue;
  profit_margin: KpiValue;
}

export interface FinanceOverviewRead {
  kpis: FinanceOverviewKpis;
  income_by_category: CategoryBreakdown[];
  month_overview: MonthOverview;
  pnl: PnL;
  recent_expenses: TransactionRead[];
  upcoming_payments: UpcomingPayment[];
}

export interface FinanceIncomeKpis {
  total_income: KpiValue;
  transaction_count: KpiValue;
  avg_daily: KpiValue;
  ytd_income: KpiValue;
}

export interface FinanceIncomeRead {
  kpis: FinanceIncomeKpis;
  by_month: IncomeMonthStacked[];
  by_category: CategoryBreakdown[];
  by_user: UserBreakdown[];
  by_payment_method: MethodBreakdown[];
}

export interface FinanceExpensesKpis {
  total_expense: KpiValue;
  transaction_count: KpiValue;
  avg_daily: KpiValue;
  budget: ExpenseBudget;
}

export interface FinanceExpensesRead {
  kpis: FinanceExpensesKpis;
  by_category: CategoryBreakdown[];
  by_payment_method: MethodBreakdown[];
  recent: TransactionRead[];
}

// ---------- Finanzas: P&L y Nómina (Parte 2) ----------
// Punto mensual para series (línea/barras). month: "YYYY-MM", amount en cents.
export interface MonthPoint {
  month: string;
  amount: number;
}

// ---- P&L ----
export interface FinancePnlKpis {
  income: KpiValue;
  expense: KpiValue;
  payroll: KpiValue;
  net_profit: KpiValue;
}

export interface FinancePnlRead {
  kpis: FinancePnlKpis;
  income_by_category: CategoryBreakdown[];
  expense_by_category: CategoryBreakdown[];
  pnl: PnL;
  // 12 meses hasta el mes seleccionado.
  net_profit_trend: MonthPoint[];
}

// ---- Nómina ----
export type PayrollRole = 'instructor' | 'other';

export interface NextScheduledPayment {
  date: string;
  days_until: number;
  amount: number;
}

export interface PayrollComputedRow {
  user: UserPublic;
  role: PayrollRole;
  period_start: string;
  period_end: string;
  hours: number;
  computed_amount: number;
  already_created: boolean;
}

export interface PayrollTransactionRow {
  id: number;
  user: UserPublic;
  role: PayrollRole;
  period_start: string | null;
  period_end: string | null;
  amount: number;
  status: TransactionStatus;
  paid_date: string | null;
}

export interface PayrollDistribution {
  instructor: number;
  other: number;
}

export interface UpcomingPayrollRow {
  user: UserPublic;
  role: PayrollRole;
  date: string;
  amount: number;
}

export interface FinancePayrollKpis {
  total_payroll: KpiValue;
  employees_paid: KpiValue;
  avg_per_employee: KpiValue;
  next_scheduled: NextScheduledPayment | null;
}

export interface FinancePayrollRead {
  kpis: FinancePayrollKpis;
  computed: PayrollComputedRow[];
  transactions: PayrollTransactionRow[];
  distribution: PayrollDistribution;
  by_month: MonthPoint[];
  upcoming: UpcomingPayrollRow[];
}

// ---------- Comunicados ----------
// Derivados de los schemas Announcement*/Audience*/DeliveryStatus del OpenAPI.
// Ciclo de vida real: draft → sending → sent/failed. `channels` siempre ['email']
// y `audience.contact_types` siempre ['self'] (constantes, no se exponen en UI).

export type AnnouncementStatus =
  | 'draft'
  | 'scheduled'
  | 'sending'
  | 'sent'
  | 'failed';
// Plantilla de render del correo. 'plain' = body compartido tal cual; 'debt_reminder'
// = el backend inyecta el bloque de deuda por destinatario (snapshot al enviar).
export type AnnouncementTemplate = 'plain' | 'debt_reminder';
export type AnnouncementCategory =
  | 'debt_reminder'
  | 'discount'
  | 'event'
  | 'holiday'
  | 'general';
export type AnnouncementChannel = 'email' | 'sms' | 'whatsapp';
export type AnnouncementContactType = 'self' | 'father' | 'mother' | 'external';
export type DeliveryStatus = 'pending' | 'sent' | 'delivered' | 'failed' | 'read';

export interface AnnouncementAudience {
  everyone?: boolean; // default false
  roles?: UserRole[] | null;
  group_ids?: number[] | null;
  course_ids?: number[] | null;
  user_ids?: number[] | null;
  with_debt?: boolean | null; // true=solo con deuda, false=solo sin, omitido=no filtra
  contact_types?: AnnouncementContactType[]; // default ['self'] — fijo, no exponer
}

export interface AnnouncementCreate {
  subject?: string | null;
  body: string; // texto plano; respeta saltos de línea, NO HTML
  category?: AnnouncementCategory; // default 'general'
  template?: AnnouncementTemplate; // default 'plain'
  channels?: AnnouncementChannel[]; // default ['email'] — fijo
  audience: AnnouncementAudience;
  scheduled_at?: string | null; // se guarda pero no auto-envía; no exponer
}

export interface AnnouncementUpdate {
  subject?: string | null;
  body?: string | null;
  category?: AnnouncementCategory | null;
  template?: AnnouncementTemplate | null;
  channels?: AnnouncementChannel[] | null;
  audience?: AnnouncementAudience | null;
  scheduled_at?: string | null;
}

export interface AnnouncementRead {
  id: number;
  subject: string | null;
  body: string;
  category: AnnouncementCategory;
  template: AnnouncementTemplate;
  channels: AnnouncementChannel[];
  audience: AnnouncementAudience | null;
  status: AnnouncementStatus;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  scheduled_at: string | null;
  sent_at: string | null;
  created_by_id: number | null;
  created_at: string | null;
}

export interface AnnouncementRecipientRead {
  id: number;
  user_id: number | null;
  contact_type: AnnouncementContactType;
  channel: AnnouncementChannel;
  destination: string;
  recipient_name: string | null;
  status: DeliveryStatus;
  provider_message_id: string | null;
  error: string | null;
  // Snapshot de la deuda usada al enviar (solo template 'debt_reminder'); null en 'plain'.
  context: DebtSnapshot | null;
  sent_at: string | null;
  user: UserPublic | null;
}

// Un adeudo puntual incluido en el bloque de deuda del correo. Montos en cents.
export interface DebtItem {
  description: string | null;
  category: TransactionCategory;
  amount: number;
  period_start: string | null;
  period_end: string | null;
  overdue: boolean;
}

// Fotografía de la deuda del destinatario al momento del envío. Montos en cents.
export interface DebtSnapshot {
  amount: number;
  currency: string;
  next_due_date: string | null;
  items: DebtItem[];
}

export interface DebtReminderSuggestRequest {
  user_id?: number | null; // presente = 1 alumno; ausente = masivo (con deuda)
}

export interface AnnouncementPreviewRequest {
  subject?: string | null;
  body: string;
  channel?: AnnouncementChannel; // default 'email'
  template?: AnnouncementTemplate; // default 'plain'
  user_id?: number | null; // destinatario para renderizar el bloque de deuda real
}

export interface AnnouncementPreviewResponse {
  subject: string | null;
  content: string; // HTML final del correo
}

export interface AudiencePreviewItem {
  user_id: number | null;
  recipient_name: string | null;
  contact_type: AnnouncementContactType;
  channel: AnnouncementChannel;
  destination: string;
}

export interface AudiencePreviewRequest {
  channels?: AnnouncementChannel[]; // default ['email']
  audience: AnnouncementAudience;
  template?: AnnouncementTemplate; // default 'plain' — 'debt_reminder' cuenta solo deudores
}

export interface AudiencePreviewResponse {
  total: number;
  sample: AudiencePreviewItem[];
}

export interface ListAnnouncementsParams {
  status?: AnnouncementStatus;
  category?: AnnouncementCategory;
  search?: string;
  skip?: number;
  limit?: number;
}

export interface ListRecipientsParams {
  status?: DeliveryStatus;
  skip?: number;
  limit?: number;
}
