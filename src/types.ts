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
  plan: AcademyPlan;
  default_instructor_hourly_rate: number | null;
  default_assistant_hourly_rate: number | null;
  currency: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
}

export interface AcademyPublic {
  id: number;
  name: string;
  type: AcademyType;
}

export interface UserMe {
  id: number;
  first_name: string;
  last_name: string;
  email: string | null;
  status: UserStatus;
  is_active: boolean;
  academy: AcademyMe;
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

export interface InviteToken {
  invite_token: string;
  token_type: string;
}

export interface ListUsersParams {
  role: UserRole;
  status?: UserStatus | 'all';
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
  course: CoursePublic;
  student: UserPublic;
  academy: AcademyPublic;
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
