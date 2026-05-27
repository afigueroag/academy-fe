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

export type UserRole = 'admin' | 'receptionist' | 'instructor' | 'student';

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
}

export interface AcademyPublic {
  id: number;
  name: string;
  type: AcademyType;
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
  pending_transactions: TransactionUserRead[];
  debt_amount: number | null;
  next_due_date: string | null;
  next_due_amount: number | null;
}

export interface UserRead {
  id: number;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  date_of_birth: string | null;
  start_date: string | null;
  payment_method: PaymentMethod | null;
  special_conditions: string | null;
  status: UserStatus;
  is_active: boolean;
  academy: AcademyPublic;
  pending_transactions: TransactionUserRead[];
  debt_amount: number | null;
  next_due_date: string | null;
  next_due_amount: number | null;
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
  phone: string | null;
  address: string | null;
  date_of_birth: string | null;
  start_date: string | null;
  payment_method: PaymentMethod | null;
  special_conditions: string | null;
  status: UserStatus | null;
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
  amount: number;
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
}

export type TransactionUpdate = TransactionCreate;

export interface TransactionRead extends TransactionCreate {
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

export interface HomeMe {
  user: UserRead;
  enrolled_courses: CourseRead[];
  pending_transactions: TransactionRead[];
  scheduled_transactions: TransactionRead[];
  attendance_summary: AttendanceMe | null;
  next_session: NextSessionMe | null;
}
