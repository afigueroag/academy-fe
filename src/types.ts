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

export interface UserMe {
  id: number;
  first_name: string;
  last_name: string;
  email: string | null;
  status: UserStatus;
  is_active: boolean;
  academy: AcademyMe;
}

export interface ValidationError {
  loc: (string | number)[];
  msg: string;
  type: string;
}

export interface HTTPValidationError {
  detail: ValidationError[];
}
