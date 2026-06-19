import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { Navigate } from 'react-router-dom';
import Layout from '../components/Layout';
import SidePanel from '../components/SidePanel';
import ConfirmModal from '../components/ConfirmModal';
import {
  ApiError,
  createGroup,
  createGroupCategory,
  deleteGroup,
  deleteGroupCategory,
  getToken,
  listGroupCategories,
  updateGroup,
  updateGroupCategory,
} from '../api';
import type { GroupCategoryRead, GroupRead } from '../types';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  PencilIcon,
  PlusIcon,
  SpinnerIcon,
  TrashIcon,
} from '../brand';

// Ordena los grupos de una categoría: los ordinales por rank asc, el resto por nombre.
function sortGroups(groups: GroupRead[], isOrdinal: boolean): GroupRead[] {
  return [...groups].sort((a, b) => {
    if (isOrdinal) {
      const ra = a.rank ?? Number.MAX_SAFE_INTEGER;
      const rb = b.rank ?? Number.MAX_SAFE_INTEGER;
      if (ra !== rb) return ra - rb;
    }
    return a.name.localeCompare(b.name, 'es');
  });
}

function sameOrder(a: GroupRead[], b: GroupRead[]): boolean {
  return a.length === b.length && a.every((g, i) => g.id === b[i].id);
}

type CategoryPanel =
  | { mode: 'create' }
  | { mode: 'edit'; category: GroupCategoryRead };

type GroupPanel =
  | { mode: 'create'; category: GroupCategoryRead }
  | { mode: 'edit'; category: GroupCategoryRead; group: GroupRead };

export default function Groups() {
  const token = getToken();

  const [categories, setCategories] = useState<GroupCategoryRead[]>([]);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // Orden local de los grupos de la categoría ordinal seleccionada (mientras el
  // usuario reordena, antes de "Guardar orden").
  const [orderedGroups, setOrderedGroups] = useState<GroupRead[]>([]);
  const [savingOrder, setSavingOrder] = useState(false);

  const [categoryPanel, setCategoryPanel] = useState<CategoryPanel | null>(null);
  const [groupPanel, setGroupPanel] = useState<GroupPanel | null>(null);

  const [toDeleteCategory, setToDeleteCategory] =
    useState<GroupCategoryRead | null>(null);
  const [toDeleteGroup, setToDeleteGroup] = useState<GroupRead | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 4000);
  }, []);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const data = await listGroupCategories();
      setCategories(data);
      setSelectedId((prev) => {
        if (prev !== null && data.some((c) => c.id === prev)) return prev;
        return data[0]?.id ?? null;
      });
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'No se pudieron cargar las categorías. Intenta de nuevo.';
      setListError(message);
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    };
  }, []);

  const selected = useMemo(
    () => categories.find((c) => c.id === selectedId) ?? null,
    [categories, selectedId],
  );

  // Reinicia el orden local cuando cambia la selección o se recargan datos.
  useEffect(() => {
    if (selected && selected.is_ordinal) {
      setOrderedGroups(sortGroups(selected.groups, true));
    } else {
      setOrderedGroups([]);
    }
  }, [selected]);

  const totalGroups = useMemo(
    () => categories.reduce((acc, c) => acc + c.groups.length, 0),
    [categories],
  );

  const orderDirty = useMemo(() => {
    if (!selected || !selected.is_ordinal) return false;
    return !sameOrder(orderedGroups, sortGroups(selected.groups, true));
  }, [selected, orderedGroups]);

  if (!token) return <Navigate to="/login" replace />;

  const moveGroup = (index: number, dir: -1 | 1) => {
    setOrderedGroups((prev) => {
      const j = index + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
  };

  const saveOrder = async () => {
    if (!selected) return;
    setSavingOrder(true);
    setListError(null);
    try {
      await Promise.all(
        orderedGroups.map((g, i) =>
          g.rank === i + 1
            ? Promise.resolve()
            : updateGroup(g.id, {
                name: g.name,
                category_id: selected.id,
                rank: i + 1,
              }),
        ),
      );
      showToast('Orden guardado');
      await fetchCategories();
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'No se pudo guardar el orden. Intenta de nuevo.';
      setListError(message);
    } finally {
      setSavingOrder(false);
    }
  };

  const handleDeleteCategory = async () => {
    if (!toDeleteCategory) return;
    setDeleting(true);
    try {
      await deleteGroupCategory(toDeleteCategory.id);
      showToast(`Categoría "${toDeleteCategory.name}" eliminada`);
      setToDeleteCategory(null);
      await fetchCategories();
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'No se pudo eliminar la categoría.';
      setListError(message);
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!toDeleteGroup) return;
    setDeleting(true);
    try {
      await deleteGroup(toDeleteGroup.id);
      showToast(`Grupo "${toDeleteGroup.name}" eliminado`);
      setToDeleteGroup(null);
      await fetchCategories();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'No se pudo eliminar el grupo.';
      setListError(message);
    } finally {
      setDeleting(false);
    }
  };

  const actions = (
    <button
      className="btn btn--primary"
      onClick={() => setCategoryPanel({ mode: 'create' })}
    >
      <PlusIcon size={14} /> Nueva categoría
    </button>
  );

  const displayGroups = selected
    ? selected.is_ordinal
      ? orderedGroups
      : sortGroups(selected.groups, false)
    : [];

  return (
    <Layout title="Grupos" actions={actions}>
      <section className="summary-grid">
        <div className="summary-card">
          <p className="summary-card__label">Categorías</p>
          <div className="summary-card__value">{categories.length}</div>
        </div>
        <div className="summary-card">
          <p className="summary-card__label">Grupos</p>
          <div className="summary-card__value">{totalGroups}</div>
        </div>
      </section>

      {toast && (
        <section>
          <div className="alert alert--success" role="status">
            {toast}
          </div>
        </section>
      )}

      {listError && (
        <section>
          <div className="alert" role="alert">
            {listError}
          </div>
        </section>
      )}

      <section>
        {loading ? (
          <div className="table-wrapper">
            <div className="loading-row">
              <SpinnerIcon size={16} /> Cargando…
            </div>
          </div>
        ) : categories.length === 0 ? (
          <div className="table-wrapper">
            <div className="empty-state">
              <p className="empty-state__title">Aún no hay categorías</p>
              <p className="empty-state__hint">
                Crea una categoría (por ejemplo "Cintas" o "Niveles") para
                empezar a organizar a tus alumnos y clases.
              </p>
            </div>
          </div>
        ) : (
          <div className="group-layout">
            <div className="group-category-list">
              {categories.map((cat) => {
                const isActive = cat.id === selectedId;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    className={
                      'group-category-item' +
                      (isActive ? ' group-category-item--active' : '')
                    }
                    onClick={() => setSelectedId(cat.id)}
                  >
                    <span className="group-category-item__name">{cat.name}</span>
                    <span className="group-category-item__meta">
                      <span
                        className={
                          'badge ' +
                          (cat.is_ordinal
                            ? 'badge--ordinal'
                            : 'badge--qualitative')
                        }
                      >
                        {cat.is_ordinal ? 'Ordinal' : 'Cualitativa'}
                      </span>
                      <span className="group-category-item__count">
                        {cat.groups.length}{' '}
                        {cat.groups.length === 1 ? 'grupo' : 'grupos'}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            {selected && (
              <div className="group-detail">
                <div className="group-detail__header">
                  <div>
                    <h2 className="group-detail__title">{selected.name}</h2>
                    <p className="group-detail__subtitle">
                      {selected.is_ordinal
                        ? 'Categoría ordinal — usa las flechas para ordenar los grupos del más básico al más avanzado.'
                        : 'Categoría cualitativa — coincidencia exacta, sin orden.'}
                    </p>
                  </div>
                  <div className="row-actions">
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label="Editar categoría"
                      title="Editar categoría"
                      onClick={() =>
                        setCategoryPanel({ mode: 'edit', category: selected })
                      }
                    >
                      <PencilIcon size={16} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn icon-btn--danger"
                      aria-label="Eliminar categoría"
                      title="Eliminar categoría"
                      onClick={() => setToDeleteCategory(selected)}
                    >
                      <TrashIcon size={16} />
                    </button>
                  </div>
                </div>

                <div className="group-detail__toolbar">
                  {selected.is_ordinal && orderDirty && (
                    <button
                      type="button"
                      className="btn btn--primary"
                      onClick={saveOrder}
                      disabled={savingOrder}
                    >
                      {savingOrder && <SpinnerIcon size={14} />} Guardar orden
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() =>
                      setGroupPanel({ mode: 'create', category: selected })
                    }
                  >
                    <PlusIcon size={14} /> Agregar grupo
                  </button>
                </div>

                {displayGroups.length === 0 ? (
                  <div className="empty-state">
                    <p className="empty-state__title">Sin grupos</p>
                    <p className="empty-state__hint">
                      Agrega los grupos de esta categoría.
                    </p>
                  </div>
                ) : (
                  <ul className="group-row-list">
                    {displayGroups.map((g, i) => (
                      <li key={g.id} className="group-row">
                        {selected.is_ordinal && (
                          <span className="group-rank" aria-label="Posición">
                            {i + 1}
                          </span>
                        )}
                        <span className="group-row__name">{g.name}</span>
                        <span className="row-actions">
                          {selected.is_ordinal && (
                            <>
                              <button
                                type="button"
                                className="icon-btn"
                                aria-label="Subir"
                                title="Subir"
                                onClick={() => moveGroup(i, -1)}
                                disabled={i === 0 || savingOrder}
                              >
                                <ChevronUpIcon size={16} />
                              </button>
                              <button
                                type="button"
                                className="icon-btn"
                                aria-label="Bajar"
                                title="Bajar"
                                onClick={() => moveGroup(i, 1)}
                                disabled={
                                  i === displayGroups.length - 1 || savingOrder
                                }
                              >
                                <ChevronDownIcon size={16} />
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            className="icon-btn"
                            aria-label="Editar grupo"
                            title="Editar grupo"
                            onClick={() =>
                              setGroupPanel({
                                mode: 'edit',
                                category: selected,
                                group: g,
                              })
                            }
                          >
                            <PencilIcon size={16} />
                          </button>
                          <button
                            type="button"
                            className="icon-btn icon-btn--danger"
                            aria-label="Eliminar grupo"
                            title="Eliminar grupo"
                            onClick={() => setToDeleteGroup(g)}
                          >
                            <TrashIcon size={16} />
                          </button>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      {categoryPanel && (
        <CategoryForm
          panel={categoryPanel}
          onClose={() => setCategoryPanel(null)}
          onSaved={async (cat, created) => {
            setCategoryPanel(null);
            if (created) setSelectedId(cat.id);
            showToast(
              created
                ? `Categoría "${cat.name}" creada`
                : `Categoría "${cat.name}" actualizada`,
            );
            await fetchCategories();
          }}
        />
      )}

      {groupPanel && (
        <GroupForm
          panel={groupPanel}
          onClose={() => setGroupPanel(null)}
          onSaved={async (g, created) => {
            setGroupPanel(null);
            showToast(
              created ? `Grupo "${g.name}" creado` : `Grupo "${g.name}" actualizado`,
            );
            await fetchCategories();
          }}
        />
      )}

      <ConfirmModal
        open={toDeleteCategory !== null}
        title="Eliminar categoría"
        message={
          toDeleteCategory
            ? `Se eliminará "${toDeleteCategory.name}" y sus grupos. Esto solo quita las asignaciones de los estudiantes y clases; no los afecta de otra forma. ¿Continuar?`
            : ''
        }
        confirmLabel="Eliminar"
        danger
        loading={deleting}
        onConfirm={handleDeleteCategory}
        onCancel={() => !deleting && setToDeleteCategory(null)}
      />

      <ConfirmModal
        open={toDeleteGroup !== null}
        title="Eliminar grupo"
        message={
          toDeleteGroup
            ? `Se eliminará el grupo "${toDeleteGroup.name}". Esto solo quita la asignación de los estudiantes y clases que lo tengan. ¿Continuar?`
            : ''
        }
        confirmLabel="Eliminar"
        danger
        loading={deleting}
        onConfirm={handleDeleteGroup}
        onCancel={() => !deleting && setToDeleteGroup(null)}
      />
    </Layout>
  );
}

// ---------- Formulario de categoría ----------

interface CategoryFormProps {
  panel: CategoryPanel;
  onClose: () => void;
  onSaved: (cat: GroupCategoryRead, created: boolean) => void;
}

function CategoryForm({ panel, onClose, onSaved }: CategoryFormProps) {
  const isEdit = panel.mode === 'edit';
  const [name, setName] = useState(isEdit ? panel.category.name : '');
  const [isOrdinal, setIsOrdinal] = useState(
    isEdit ? panel.category.is_ordinal : false,
  );
  const [nameError, setNameError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError('El nombre es obligatorio.');
      return;
    }
    setNameError(null);
    setFormError(null);
    setSubmitting(true);
    try {
      if (isEdit) {
        const updated = await updateGroupCategory(panel.category.id, {
          name: trimmed,
          is_ordinal: isOrdinal,
        });
        onSaved(updated, false);
      } else {
        const created = await createGroupCategory({
          name: trimmed,
          is_ordinal: isOrdinal,
        });
        onSaved(created, true);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.message);
        if (err.fieldErrors.name) setNameError(err.fieldErrors.name);
      } else {
        setFormError('No se pudo guardar la categoría. Intenta de nuevo.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SidePanel
      open
      title={isEdit ? 'Editar categoría' : 'Nueva categoría'}
      subtitle="Una categoría agrupa varios grupos (cintas, niveles, edades…)."
      onClose={() => !submitting && onClose()}
      footer={
        <>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={onClose}
            disabled={submitting}
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="category-form"
            className="btn btn--primary"
            disabled={submitting}
          >
            {submitting && <SpinnerIcon size={14} />} Guardar
          </button>
        </>
      }
    >
      <form id="category-form" onSubmit={submit}>
        {formError && (
          <div className="alert" role="alert">
            {formError}
          </div>
        )}

        <div className="field">
          <label className="field__label" htmlFor="cat-name">
            Nombre
          </label>
          <input
            id="cat-name"
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={!!nameError}
            autoFocus
            placeholder="Ej. Cintas, Niveles, Edades"
          />
          <span className="field__error">{nameError ?? ''}</span>
        </div>

        <div className="switch-row">
          <div>
            <div className="switch-row__label">Categoría ordinal</div>
            <div className="switch-row__hint">
              Actívala si el orden importa (principiante → avanzado). Podrás
              ordenar los grupos manualmente.
            </div>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={isOrdinal}
              onChange={(e) => setIsOrdinal(e.target.checked)}
            />
            <span className="switch__track" />
            <span className="switch__thumb" />
          </label>
        </div>
      </form>
    </SidePanel>
  );
}

// ---------- Formulario de grupo ----------

interface GroupFormProps {
  panel: GroupPanel;
  onClose: () => void;
  onSaved: (group: GroupRead, created: boolean) => void;
}

function GroupForm({ panel, onClose, onSaved }: GroupFormProps) {
  const isEdit = panel.mode === 'edit';
  const category = panel.category;

  const [name, setName] = useState(isEdit ? panel.group.name : '');
  const [nameError, setNameError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Al crear en una categoría ordinal, el grupo nuevo toma el siguiente número
  // natural (se agrega al final). En edición se conserva el rango existente; el
  // orden se cambia desde la lista, no aquí.
  const nextRank =
    category.groups.reduce((max, g) => Math.max(max, g.rank ?? 0), 0) + 1;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError('El nombre es obligatorio.');
      return;
    }
    setNameError(null);
    setFormError(null);
    setSubmitting(true);

    const rank = category.is_ordinal
      ? isEdit
        ? panel.group.rank
        : nextRank
      : null;

    try {
      if (isEdit) {
        const updated = await updateGroup(panel.group.id, {
          name: trimmed,
          category_id: category.id,
          rank,
        });
        onSaved(updated, false);
      } else {
        const created = await createGroup({
          name: trimmed,
          category_id: category.id,
          rank,
        });
        onSaved(created, true);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.message);
        if (err.fieldErrors.name) setNameError(err.fieldErrors.name);
      } else {
        setFormError('No se pudo guardar el grupo. Intenta de nuevo.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SidePanel
      open
      title={isEdit ? 'Editar grupo' : 'Nuevo grupo'}
      subtitle={category.name}
      onClose={() => !submitting && onClose()}
      footer={
        <>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={onClose}
            disabled={submitting}
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="group-form"
            className="btn btn--primary"
            disabled={submitting}
          >
            {submitting && <SpinnerIcon size={14} />} Guardar
          </button>
        </>
      }
    >
      <form id="group-form" onSubmit={submit}>
        {formError && (
          <div className="alert" role="alert">
            {formError}
          </div>
        )}

        <div className="field">
          <label className="field__label" htmlFor="group-name">
            Nombre
          </label>
          <input
            id="group-name"
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={!!nameError}
            autoFocus
            placeholder="Ej. Cinta Blanca, Principiante"
          />
          <span className="field__error">{nameError ?? ''}</span>
          {category.is_ordinal && !isEdit && (
            <span className="field__hint">
              Se agregará al final del orden (posición {nextRank}). Podrás
              moverlo con las flechas.
            </span>
          )}
        </div>
      </form>
    </SidePanel>
  );
}
