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
  name: string;
  type: AcademyType;
  plan: AcademyPlan;
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
}

export interface AcademyBase {
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
  academy: AcademyBase;
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

export interface ValidationError {
  loc: (string | number)[];
  msg: string;
  type: string;
}

export interface HTTPValidationError {
  detail: ValidationError[];
}
