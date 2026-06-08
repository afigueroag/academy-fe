import type { UserGender, UserRead } from '../types';

/**
 * Datos personales y de contactos del estudiante (género, código postal,
 * padre/encargado, madre y dos contactos de emergencia). Compartido entre el
 * formulario de alta/edición (UserForm) y la configuración del estudiante
 * (StudentConfig). Solo aplica a estudiantes.
 */
export interface StudentExtra {
  gender: '' | UserGender;
  postal_code: string;
  father_name: string;
  father_occupation: string;
  father_employer: string;
  father_address: string;
  father_phone: string;
  mother_name: string;
  mother_occupation: string;
  mother_employer: string;
  mother_address: string;
  mother_phone: string;
  emergency_contact_1_name: string;
  emergency_contact_1_phone: string;
  emergency_contact_1_relationship: string;
  emergency_contact_2_name: string;
  emergency_contact_2_phone: string;
  emergency_contact_2_relationship: string;
}

export const EMPTY_STUDENT_EXTRA: StudentExtra = {
  gender: '',
  postal_code: '',
  father_name: '',
  father_occupation: '',
  father_employer: '',
  father_address: '',
  father_phone: '',
  mother_name: '',
  mother_occupation: '',
  mother_employer: '',
  mother_address: '',
  mother_phone: '',
  emergency_contact_1_name: '',
  emergency_contact_1_phone: '',
  emergency_contact_1_relationship: '',
  emergency_contact_2_name: '',
  emergency_contact_2_phone: '',
  emergency_contact_2_relationship: '',
};

export function studentExtraFromUser(u: UserRead): StudentExtra {
  return {
    gender: u.gender ?? '',
    postal_code: u.postal_code ?? '',
    father_name: u.father_name ?? '',
    father_occupation: u.father_occupation ?? '',
    father_employer: u.father_employer ?? '',
    father_address: u.father_address ?? '',
    father_phone: u.father_phone ?? '',
    mother_name: u.mother_name ?? '',
    mother_occupation: u.mother_occupation ?? '',
    mother_employer: u.mother_employer ?? '',
    mother_address: u.mother_address ?? '',
    mother_phone: u.mother_phone ?? '',
    emergency_contact_1_name: u.emergency_contact_1_name ?? '',
    emergency_contact_1_phone: u.emergency_contact_1_phone ?? '',
    emergency_contact_1_relationship: u.emergency_contact_1_relationship ?? '',
    emergency_contact_2_name: u.emergency_contact_2_name ?? '',
    emergency_contact_2_phone: u.emergency_contact_2_phone ?? '',
    emergency_contact_2_relationship: u.emergency_contact_2_relationship ?? '',
  };
}

const trimOrNull = (s: string): string | null => {
  const t = s.trim();
  return t === '' ? null : t;
};

/** Convierte el estado del formulario al shape que esperan UserCreate/UserUpdate. */
export function studentExtraToPayload(e: StudentExtra) {
  return {
    gender: e.gender === '' ? null : (e.gender as UserGender),
    postal_code: trimOrNull(e.postal_code),
    father_name: trimOrNull(e.father_name),
    father_occupation: trimOrNull(e.father_occupation),
    father_employer: trimOrNull(e.father_employer),
    father_address: trimOrNull(e.father_address),
    father_phone: trimOrNull(e.father_phone),
    mother_name: trimOrNull(e.mother_name),
    mother_occupation: trimOrNull(e.mother_occupation),
    mother_employer: trimOrNull(e.mother_employer),
    mother_address: trimOrNull(e.mother_address),
    mother_phone: trimOrNull(e.mother_phone),
    emergency_contact_1_name: trimOrNull(e.emergency_contact_1_name),
    emergency_contact_1_phone: trimOrNull(e.emergency_contact_1_phone),
    emergency_contact_1_relationship: trimOrNull(
      e.emergency_contact_1_relationship,
    ),
    emergency_contact_2_name: trimOrNull(e.emergency_contact_2_name),
    emergency_contact_2_phone: trimOrNull(e.emergency_contact_2_phone),
    emergency_contact_2_relationship: trimOrNull(
      e.emergency_contact_2_relationship,
    ),
  };
}

const GENDER_OPTIONS: { value: UserGender; label: string }[] = [
  { value: 'masculine', label: 'Masculino' },
  { value: 'feminine', label: 'Femenino' },
];

interface Props {
  value: StudentExtra;
  onChange: (next: StudentExtra) => void;
  /** Prefijo para los `id`/`htmlFor` (evita colisiones si hay varios forms). */
  idPrefix?: string;
}

export default function StudentExtraFields({
  value,
  onChange,
  idPrefix = 'se',
}: Props) {
  const set = <K extends keyof StudentExtra>(k: K, v: StudentExtra[K]) =>
    onChange({ ...value, [k]: v });

  const text = (
    key: keyof StudentExtra,
    label: string,
    type: string = 'text',
  ) => (
    <div className="field">
      <label className="field__label" htmlFor={`${idPrefix}-${key}`}>
        {label}
      </label>
      <input
        id={`${idPrefix}-${key}`}
        className="input"
        type={type}
        value={value[key] as string}
        onChange={(e) => set(key, e.target.value as StudentExtra[typeof key])}
      />
    </div>
  );

  return (
    <>
      <h3 className="form-section__title">Datos personales</h3>
      <div className="field--row">
        <div className="field">
          <label className="field__label" htmlFor={`${idPrefix}-gender`}>
            Género
          </label>
          <select
            id={`${idPrefix}-gender`}
            className="select"
            value={value.gender}
            onChange={(e) => set('gender', e.target.value as '' | UserGender)}
          >
            <option value="">— Selecciona —</option>
            {GENDER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        {text('postal_code', 'Código postal')}
      </div>

      <h3 className="form-section__title">Padre / Encargado</h3>
      <div className="field--row">
        {text('father_name', 'Nombre')}
        {text('father_phone', 'Teléfono', 'tel')}
      </div>
      <div className="field--row">
        {text('father_occupation', 'Ocupación')}
        {text('father_employer', 'Lugar de empleo')}
      </div>
      {text('father_address', 'Dirección')}

      <h3 className="form-section__title">Madre</h3>
      <div className="field--row">
        {text('mother_name', 'Nombre')}
        {text('mother_phone', 'Teléfono', 'tel')}
      </div>
      <div className="field--row">
        {text('mother_occupation', 'Ocupación')}
        {text('mother_employer', 'Lugar de empleo')}
      </div>
      {text('mother_address', 'Dirección')}

      <h3 className="form-section__title">Contacto de emergencia 1</h3>
      <div className="field--row">
        {text('emergency_contact_1_name', 'Nombre')}
        {text('emergency_contact_1_phone', 'Teléfono', 'tel')}
      </div>
      {text('emergency_contact_1_relationship', 'Parentesco')}

      <h3 className="form-section__title">Contacto de emergencia 2</h3>
      <div className="field--row">
        {text('emergency_contact_2_name', 'Nombre')}
        {text('emergency_contact_2_phone', 'Teléfono', 'tel')}
      </div>
      {text('emergency_contact_2_relationship', 'Parentesco')}
    </>
  );
}
