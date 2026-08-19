import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  AnnouncementCategory,
  AnnouncementCreate,
  AnnouncementRead,
  AnnouncementTemplate,
  AudiencePreviewResponse,
  GroupRead,
  UserRole,
} from '../types';
import {
  ApiError,
  getUser,
  listCourses,
  listGroups,
  previewAnnouncement,
  previewAudience,
} from '../api';
import { SpinnerIcon, EyeIcon, MailIcon } from '../brand';
import GroupPicker from './GroupPicker';
import UserAutocomplete from './UserAutocomplete';
import { ANNOUNCEMENT_CATEGORIES, labelAnnouncementCategory } from '../utils/announcements';
import { labelUserRole } from '../utils/roles';

// Roles seleccionables como criterio de audiencia.
const AUDIENCE_ROLES: UserRole[] = [
  'student',
  'instructor',
  'instructor_student',
  'receptionist',
  'admin',
];

type DebtFilter = 'any' | 'with' | 'without';
type CourseOption = { id: number; name: string };
type UserOption = { id: number; first_name: string; last_name: string };

interface AnnouncementFormProps {
  announcement?: AnnouncementRead; // edición de un borrador existente
  initial?: AnnouncementCreate | null; // pre-llenado para uno nuevo (ej. suggest)
  template?: AnnouncementTemplate; // fuerza la plantilla (flujos de deuda)
  // Cuando se fija, el comunicado va a un solo alumno: se oculta la segmentación y
  // la audiencia queda { user_ids:[id] }. Se usa en el recordatorio por-estudiante.
  lockedUser?: { id: number; name: string } | null;
  canSend: boolean;
  submitting: boolean;
  serverError: string | null;
  apiError: ApiError | null;
  onSaveDraft: (payload: AnnouncementCreate) => void;
  onRequestSend: (payload: AnnouncementCreate, total: number) => void;
}

// Construye el payload de audiencia enviando solo las claves con valor.
function buildAudience(
  everyoneMode: boolean,
  roles: UserRole[],
  groupIds: number[],
  courseIds: number[],
  userIds: number[],
  debt: DebtFilter,
): AnnouncementCreate['audience'] {
  if (everyoneMode) {
    return { everyone: true, contact_types: ['self'] };
  }
  const audience: AnnouncementCreate['audience'] = {
    everyone: false,
    contact_types: ['self'],
  };
  if (roles.length) audience.roles = roles;
  if (groupIds.length) audience.group_ids = groupIds;
  if (courseIds.length) audience.course_ids = courseIds;
  if (userIds.length) audience.user_ids = userIds;
  if (debt !== 'any') audience.with_debt = debt === 'with';
  return audience;
}

export default function AnnouncementForm({
  announcement,
  initial,
  template,
  lockedUser,
  canSend,
  submitting,
  serverError,
  apiError,
  onSaveDraft,
  onRequestSend,
}: AnnouncementFormProps) {
  const seed = announcement ?? initial ?? null;
  const effectiveTemplate: AnnouncementTemplate =
    announcement?.template ?? initial?.template ?? template ?? 'plain';
  const isDebt = effectiveTemplate === 'debt_reminder';

  const [category, setCategory] = useState<AnnouncementCategory>(
    seed?.category ?? (isDebt ? 'debt_reminder' : 'general'),
  );
  const [subject, setSubject] = useState(seed?.subject ?? '');
  const [body, setBody] = useState(seed?.body ?? '');

  const initialAudience = seed?.audience ?? null;
  const [everyoneMode, setEveryoneMode] = useState<boolean>(
    initialAudience
      ? initialAudience.everyone !== false && !hasSelectors(initialAudience)
      : true,
  );
  const [roles, setRoles] = useState<UserRole[]>(initialAudience?.roles ?? []);
  const [groups, setGroups] = useState<GroupRead[]>([]);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [debt, setDebt] = useState<DebtFilter>(
    initialAudience?.with_debt == null
      ? 'any'
      : initialAudience.with_debt
        ? 'with'
        : 'without',
  );

  // Catálogos para el selector y para rehidratar la segmentación al editar.
  const [courseCatalog, setCourseCatalog] = useState<CourseOption[]>([]);
  const [courseSel, setCourseSel] = useState('');
  const [groupCatalog, setGroupCatalog] = useState<GroupRead[]>([]);

  const [localError, setLocalError] = useState<string | null>(null);

  // Preview de audiencia (debounced).
  const [audiencePreview, setAudiencePreview] =
    useState<AudiencePreviewResponse | null>(null);
  const [audienceLoading, setAudienceLoading] = useState(false);
  const [audienceError, setAudienceError] = useState<string | null>(null);

  // Preview del correo.
  const [emailPreview, setEmailPreview] = useState<string | null>(null);
  const [emailPreviewLoading, setEmailPreviewLoading] = useState(false);
  const [emailPreviewError, setEmailPreviewError] = useState<string | null>(null);

  const groupIds = useMemo(() => groups.map((g) => g.id), [groups]);
  const courseIds = useMemo(() => courses.map((c) => c.id), [courses]);
  const userIds = useMemo(() => users.map((u) => u.id), [users]);

  const audience = useMemo<AnnouncementCreate['audience']>(() => {
    if (lockedUser) {
      return {
        everyone: false,
        user_ids: [lockedUser.id],
        contact_types: ['self'],
      };
    }
    return buildAudience(everyoneMode, roles, groupIds, courseIds, userIds, debt);
  }, [lockedUser, everyoneMode, roles, groupIds, courseIds, userIds, debt]);

  // Catálogos: solo se cargan si la segmentación está visible (no en modo bloqueado).
  useEffect(() => {
    if (lockedUser) return;
    let active = true;
    (async () => {
      try {
        const data = await listCourses({ limit: 1000 });
        if (active) setCourseCatalog(data.map((c) => ({ id: c.id, name: c.name })));
      } catch {
        /* selector opcional; error silencioso */
      }
    })();
    (async () => {
      try {
        const data = await listGroups({ limit: 1000 });
        if (active) setGroupCatalog(data);
      } catch {
        /* selector opcional; error silencioso */
      }
    })();
    return () => {
      active = false;
    };
  }, [lockedUser]);

  // Rehidratación al editar un borrador segmentado.
  const hydratedCourses = useRef(false);
  useEffect(() => {
    if (hydratedCourses.current || lockedUser) return;
    const ids = initialAudience?.course_ids;
    if (!ids || ids.length === 0 || courseCatalog.length === 0) return;
    setCourses(courseCatalog.filter((c) => ids.includes(c.id)));
    hydratedCourses.current = true;
  }, [courseCatalog, initialAudience, lockedUser]);

  const hydratedGroups = useRef(false);
  useEffect(() => {
    if (hydratedGroups.current || lockedUser) return;
    const ids = initialAudience?.group_ids;
    if (!ids || ids.length === 0 || groupCatalog.length === 0) return;
    setGroups(groupCatalog.filter((g) => ids.includes(g.id)));
    hydratedGroups.current = true;
  }, [groupCatalog, initialAudience, lockedUser]);

  const hydratedUsers = useRef(false);
  useEffect(() => {
    if (hydratedUsers.current || lockedUser) return;
    const ids = initialAudience?.user_ids;
    if (!ids || ids.length === 0) return;
    hydratedUsers.current = true;
    // Sin flag `active`: bajo StrictMode el cleanup lo pondría en false entre los
    // dos montajes y, como el guard ya quedó en true, el segundo montaje no
    // re-pediría y se perdería el setUsers. En React 18 un setState tras
    // desmontar es no-op, así que es seguro dejar que resuelva.
    (async () => {
      const loaded = await Promise.all(
        ids.map((id) => getUser(id).catch(() => null)),
      );
      setUsers(
        loaded
          .filter((u): u is NonNullable<typeof u> => u !== null)
          .map((u) => ({
            id: u.id,
            first_name: u.first_name,
            last_name: u.last_name,
          })),
      );
    })();
  }, [initialAudience, lockedUser]);

  const hasSelectorsSelected =
    roles.length > 0 ||
    groupIds.length > 0 ||
    courseIds.length > 0 ||
    userIds.length > 0 ||
    debt !== 'any';
  const audienceValid = Boolean(
    lockedUser || everyoneMode || hasSelectorsSelected,
  );
  // En recordatorios de deuda la prosa es opcional (el bloque de datos lleva el contenido).
  const bodyValid = isDebt || body.trim().length > 0;

  // Debounced preview de audiencia.
  useEffect(() => {
    if (!audienceValid) {
      setAudiencePreview(null);
      return;
    }
    let cancelled = false;
    setAudienceLoading(true);
    setAudienceError(null);
    const t = window.setTimeout(async () => {
      try {
        const data = await previewAudience({
          channels: ['email'],
          audience,
          template: effectiveTemplate,
        });
        if (!cancelled) setAudiencePreview(data);
      } catch (err) {
        if (!cancelled) {
          setAudiencePreview(null);
          setAudienceError(
            err instanceof ApiError
              ? err.message
              : 'No se pudo calcular la audiencia.',
          );
        }
      } finally {
        if (!cancelled) setAudienceLoading(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [audience, audienceValid, effectiveTemplate]);

  const total = audiencePreview?.total ?? 0;
  // Destinatario de muestra para renderizar el bloque de deuda en el preview.
  const previewUserId =
    lockedUser?.id ?? audiencePreview?.sample?.[0]?.user_id ?? null;

  const toggleRole = (r: UserRole) => {
    setRoles((prev) =>
      prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r],
    );
  };

  const addCourse = (id: number) => {
    const opt = courseCatalog.find((c) => c.id === id);
    if (opt && !courses.some((c) => c.id === id)) {
      setCourses((prev) => [...prev, opt]);
    }
    setCourseSel('');
  };

  const addUser = (u: UserOption) => {
    if (!users.some((x) => x.id === u.id)) setUsers((prev) => [...prev, u]);
  };

  const buildPayload = (): AnnouncementCreate => ({
    subject: subject.trim() ? subject.trim() : null,
    body,
    category,
    template: effectiveTemplate,
    channels: ['email'],
    audience,
  });

  const validate = (): boolean => {
    if (!bodyValid) {
      setLocalError('El mensaje no puede estar vacío.');
      return false;
    }
    if (!audienceValid) {
      setLocalError('Selecciona al menos un criterio de audiencia o "Todos".');
      return false;
    }
    setLocalError(null);
    return true;
  };

  const handleSaveDraft = () => {
    if (!validate()) return;
    onSaveDraft(buildPayload());
  };

  const handleSend = () => {
    if (!validate()) return;
    if (total <= 0) {
      setLocalError(
        isDebt
          ? 'No hay destinatarios con deuda vigente.'
          : 'La audiencia no incluye a ninguna persona.',
      );
      return;
    }
    onRequestSend(buildPayload(), total);
  };

  const handleEmailPreview = async () => {
    if (!bodyValid) {
      setLocalError('El mensaje no puede estar vacío.');
      return;
    }
    setEmailPreviewLoading(true);
    setEmailPreviewError(null);
    try {
      const res = await previewAnnouncement({
        subject: subject.trim() ? subject.trim() : null,
        body,
        channel: 'email',
        template: effectiveTemplate,
        user_id: previewUserId,
      });
      setEmailPreview(res.content);
    } catch (err) {
      setEmailPreviewError(
        err instanceof ApiError
          ? err.message
          : 'No se pudo generar la vista previa.',
      );
    } finally {
      setEmailPreviewLoading(false);
    }
  };

  const errorMsg = localError ?? serverError;
  const bodyError = apiError?.fieldErrors?.body;

  return (
    <div className="announcement-form">
      {errorMsg && (
        <div className="alert" role="alert" style={{ marginBottom: 12 }}>
          {errorMsg}
        </div>
      )}

      {isDebt && (
        <div className="announcement-debt-note">
          <strong>Recordatorio de deuda.</strong> El saldo y el desglose de cada
          persona los agrega el sistema automáticamente. Aquí solo escribes el
          mensaje que acompaña esos datos.
        </div>
      )}

      {!isDebt && (
        <div className="field">
          <label className="field__label" htmlFor="ann-category">
            Categoría
          </label>
          <select
            id="ann-category"
            className="select"
            value={category}
            onChange={(e) => setCategory(e.target.value as AnnouncementCategory)}
          >
            {ANNOUNCEMENT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {labelAnnouncementCategory(c)}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="field">
        <label className="field__label" htmlFor="ann-subject">
          Asunto <span className="field__hint">(opcional)</span>
        </label>
        <input
          id="ann-subject"
          className="input"
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Asunto del correo"
        />
      </div>

      <div className="field">
        <label className="field__label" htmlFor="ann-body">
          Mensaje {isDebt && <span className="field__hint">(opcional)</span>}
        </label>
        <textarea
          id="ann-body"
          className="textarea"
          rows={isDebt ? 4 : 7}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Escribe el mensaje. Se respetan los saltos de línea."
          aria-invalid={bodyError ? 'true' : undefined}
        />
        <p className="field__hint">
          Texto plano. El formato del correo lo aplica el sistema.
        </p>
        {bodyError && <p className="field__error">{bodyError}</p>}
      </div>

      {/* ---- Audiencia ---- */}
      {lockedUser ? (
        <div className="field">
          <div className="field__label">Destinatario</div>
          <div className="removable-chip" style={{ cursor: 'default' }}>
            {lockedUser.name}
          </div>
        </div>
      ) : (
        <div className="announcement-audience">
          <div className="field__label">Audiencia</div>
          <div className="tab-group" role="tablist" aria-label="Tipo de audiencia">
            <button
              type="button"
              role="tab"
              aria-selected={everyoneMode}
              className={
                'tab-group__item' +
                (everyoneMode ? ' tab-group__item--active' : '')
              }
              onClick={() => setEveryoneMode(true)}
            >
              Todos los activos
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={!everyoneMode}
              className={
                'tab-group__item' +
                (!everyoneMode ? ' tab-group__item--active' : '')
              }
              onClick={() => setEveryoneMode(false)}
            >
              Segmentar
            </button>
          </div>

          {!everyoneMode && (
            <div className="announcement-audience__segment">
              <div className="field">
                <div className="field__label">Roles</div>
                <div className="checkbox-row">
                  {AUDIENCE_ROLES.map((r) => (
                    <label key={r} className="checkbox-chip">
                      <input
                        type="checkbox"
                        checked={roles.includes(r)}
                        onChange={() => toggleRole(r)}
                      />
                      {labelUserRole(r)}
                    </label>
                  ))}
                </div>
              </div>

              <div className="field">
                <div className="field__label">Grupos</div>
                <GroupPicker value={groups} onChange={setGroups} />
              </div>

              <div className="field">
                <label className="field__label" htmlFor="ann-course">
                  Cursos
                </label>
                <select
                  id="ann-course"
                  className="select"
                  value={courseSel}
                  onChange={(e) => {
                    if (e.target.value) addCourse(Number(e.target.value));
                  }}
                >
                  <option value="">Agregar curso…</option>
                  {courseCatalog
                    .filter((c) => !courses.some((s) => s.id === c.id))
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
                {courses.length > 0 && (
                  <div className="chip-list">
                    {courses.map((c) => (
                      <span key={c.id} className="removable-chip">
                        {c.name}
                        <button
                          type="button"
                          className="removable-chip__remove"
                          aria-label={`Quitar ${c.name}`}
                          onClick={() =>
                            setCourses((prev) =>
                              prev.filter((x) => x.id !== c.id),
                            )
                          }
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="field">
                <div className="field__label">Personas específicas</div>
                <UserAutocomplete
                  excludeIds={userIds}
                  onSelect={addUser}
                  placeholder="Buscar persona por nombre, correo o no. de miembro"
                  ariaLabel="Buscar persona"
                />
                {users.length > 0 && (
                  <div className="chip-list">
                    {users.map((u) => (
                      <span key={u.id} className="removable-chip">
                        {u.first_name} {u.last_name}
                        <button
                          type="button"
                          className="removable-chip__remove"
                          aria-label={`Quitar ${u.first_name} ${u.last_name}`}
                          onClick={() =>
                            setUsers((prev) => prev.filter((x) => x.id !== u.id))
                          }
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="field">
                <div className="field__label">Deuda</div>
                <div
                  className="tab-group"
                  role="tablist"
                  aria-label="Filtro de deuda"
                >
                  {(
                    [
                      { value: 'any', label: 'No filtrar' },
                      { value: 'with', label: 'Solo con deuda' },
                      { value: 'without', label: 'Solo sin deuda' },
                    ] as { value: DebtFilter; label: string }[]
                  ).map((d) => (
                    <button
                      key={d.value}
                      type="button"
                      role="tab"
                      aria-selected={debt === d.value}
                      className={
                        'tab-group__item' +
                        (debt === d.value ? ' tab-group__item--active' : '')
                      }
                      onClick={() => setDebt(d.value)}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Preview de audiencia en vivo */}
      <div className="audience-preview">
        {!audienceValid ? (
          <p className="field__hint">
            Selecciona al menos un criterio para calcular la audiencia.
          </p>
        ) : audienceLoading ? (
          <div className="loading-row">
            <SpinnerIcon size={14} /> Calculando audiencia…
          </div>
        ) : audienceError ? (
          <div className="alert" role="alert">
            {audienceError}
          </div>
        ) : audiencePreview ? (
          total === 0 ? (
            <p className="audience-preview__count">
              {isDebt
                ? lockedUser
                  ? 'Este alumno no tiene deuda vigente.'
                  : 'Ninguna persona con deuda coincide con estos criterios.'
                : 'La audiencia no incluye a ninguna persona.'}
            </p>
          ) : (
            <>
              <p className="audience-preview__count">
                Le llegará a <strong>{total}</strong>{' '}
                {total === 1 ? 'persona' : 'personas'}.
              </p>
              {!lockedUser && audiencePreview.sample.length > 0 && (
                <p className="audience-preview__sample">
                  {audiencePreview.sample
                    .map((s) => s.recipient_name || s.destination)
                    .join(', ')}
                  {total > audiencePreview.sample.length ? ', …' : ''}
                </p>
              )}
            </>
          )
        ) : null}
      </div>

      {/* ---- Acciones ---- */}
      <div className="announcement-form__actions">
        <button
          type="button"
          className="btn btn--ghost"
          onClick={handleEmailPreview}
          disabled={emailPreviewLoading || !bodyValid}
        >
          {emailPreviewLoading ? <SpinnerIcon size={14} /> : <EyeIcon size={14} />}
          Previsualizar correo
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={handleSaveDraft}
          disabled={submitting}
        >
          {submitting && <SpinnerIcon size={14} />}
          Guardar borrador
        </button>
        {canSend && (
          <button
            type="button"
            className="btn btn--primary"
            onClick={handleSend}
            disabled={submitting || !bodyValid || !audienceValid || total <= 0}
          >
            <MailIcon size={14} />
            Enviar
          </button>
        )}
      </div>

      {emailPreviewError && (
        <div className="alert" role="alert" style={{ marginTop: 12 }}>
          {emailPreviewError}
        </div>
      )}

      {/* Modal de vista previa del correo (HTML aislado en iframe) */}
      {emailPreview !== null && (
        <div className="modal-backdrop" onClick={() => setEmailPreview(null)}>
          <div
            className="modal email-preview-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Vista previa del correo"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="email-preview-modal__banner">
              Vista previa — así se verá el correo
            </div>
            <iframe
              className="email-preview-modal__frame"
              title="Vista previa del correo"
              srcDoc={emailPreview}
              sandbox=""
            />
            <div className="modal__actions">
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setEmailPreview(null)}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ¿La audiencia guardada usa selectores (segmentación) en lugar de "todos"?
function hasSelectors(a: {
  roles?: unknown[] | null;
  group_ids?: unknown[] | null;
  course_ids?: unknown[] | null;
  user_ids?: unknown[] | null;
  with_debt?: boolean | null;
}): boolean {
  return Boolean(
    (a.roles && a.roles.length) ||
      (a.group_ids && a.group_ids.length) ||
      (a.course_ids && a.course_ids.length) ||
      (a.user_ids && a.user_ids.length) ||
      a.with_debt != null,
  );
}
