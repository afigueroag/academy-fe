import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  DiscountAppliesTo,
  DiscountCreate,
  DiscountRead,
  DiscountType,
  DiscountValueType,
} from '../types';
import {
  ApiError,
  createDiscount,
  deleteDiscount,
  listDiscounts,
  updateDiscount,
} from '../api';
import { useAuth } from '../auth';
import { CheckIcon, CloseIcon, PencilIcon, PlusIcon, SpinnerIcon, TrashIcon } from '../brand';
import { formatMoney, fromCents, toCents } from '../utils/money';
import {
  DISCOUNT_APPLIES_TO,
  DISCOUNT_TYPES,
  DISCOUNT_VALUE_TYPES,
  labelDiscountAppliesTo,
  labelDiscountType,
  labelDiscountValueType,
} from '../utils/discountLabels';
import ConfirmModal from './ConfirmModal';

interface StudentDiscountsSectionProps {
  userId: number;
  // En edición se puede crear/editar/activar/eliminar; en "ver detalles" solo
  // se listan en modo lectura.
  editable?: boolean;
}

interface EditorState {
  // discount en edición, o null al crear uno nuevo.
  discount: DiscountRead | null;
  type: DiscountType;
  value_type: DiscountValueType;
  // Valor: monto en moneda si es fijo, porcentaje (0–100) si es porcentual.
  value: string;
  applies_to: DiscountAppliesTo;
  description: string;
  is_active: boolean;
}

function emptyEditor(): EditorState {
  return {
    discount: null,
    type: 'family_discount',
    value_type: 'fixed',
    value: '',
    applies_to: 'tuition',
    description: '',
    is_active: true,
  };
}

function editorFromDiscount(d: DiscountRead): EditorState {
  return {
    discount: d,
    type: d.type,
    value_type: d.value_type,
    value:
      d.value_type === 'fixed'
        ? String(fromCents(d.amount) ?? '')
        : String(d.percentage ?? ''),
    applies_to: d.applies_to,
    description: d.description ?? '',
    is_active: d.is_active,
  };
}

function discountValueLabel(d: DiscountRead, currency: string | null): string {
  return d.value_type === 'fixed'
    ? formatMoney(d.amount, currency)
    : `${d.percentage ?? 0}%`;
}

export default function StudentDiscountsSection({
  userId,
  editable = true,
}: StudentDiscountsSectionProps) {
  const { me } = useAuth();
  const currency = me?.academy.currency ?? null;

  const [discounts, setDiscounts] = useState<DiscountRead[]>([]);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [editor, setEditor] = useState<EditorState | null>(null);
  const [saving, setSaving] = useState(false);
  const [valueError, setValueError] = useState<string | null>(null);

  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [toDelete, setToDelete] = useState<DiscountRead | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 4000);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    };
  }, []);

  const fetchDiscounts = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const data = await listDiscounts({ user_id: userId });
      setDiscounts(data);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'No se pudieron cargar los descuentos.';
      setListError(message);
      setDiscounts([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchDiscounts();
  }, [fetchDiscounts]);

  const openCreate = () => {
    setActionError(null);
    setValueError(null);
    setEditor(emptyEditor());
  };

  const openEdit = (d: DiscountRead) => {
    setActionError(null);
    setValueError(null);
    setEditor(editorFromDiscount(d));
  };

  const closeEditor = () => {
    setEditor(null);
    setValueError(null);
  };

  const setField = <K extends keyof EditorState>(k: K, v: EditorState[K]) => {
    setEditor((e) => (e ? { ...e, [k]: v } : e));
  };

  const buildPayload = (e: EditorState): DiscountCreate | null => {
    if (e.value_type === 'fixed') {
      const amount = toCents(e.value);
      if (amount === null || amount < 0) {
        setValueError('Monto inválido');
        return null;
      }
      return {
        user_id: userId,
        type: e.type,
        value_type: 'fixed',
        percentage: null,
        amount,
        applies_to: e.applies_to,
        description: e.description.trim() || null,
      };
    }
    const pct = parseFloat(e.value);
    if (e.value === '' || Number.isNaN(pct) || pct < 0 || pct > 100) {
      setValueError('Entre 0 y 100');
      return null;
    }
    return {
      user_id: userId,
      type: e.type,
      value_type: 'percentage',
      percentage: Math.round(pct),
      amount: null,
      applies_to: e.applies_to,
      description: e.description.trim() || null,
    };
  };

  const handleSave = async () => {
    if (!editor) return;
    const base = buildPayload(editor);
    if (!base) return;
    setSaving(true);
    setActionError(null);
    try {
      if (editor.discount) {
        const updated = await updateDiscount(editor.discount.id, {
          ...base,
          is_active: editor.is_active,
        });
        setDiscounts((list) =>
          list.map((d) => (d.id === updated.id ? updated : d)),
        );
        showToast('Descuento actualizado');
      } else {
        const created = await createDiscount(base);
        setDiscounts((list) => [created, ...list]);
        showToast('Descuento creado');
      }
      closeEditor();
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'No se pudo guardar el descuento.';
      setActionError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (d: DiscountRead) => {
    setTogglingId(d.id);
    setActionError(null);
    try {
      const updated = await updateDiscount(d.id, {
        user_id: d.user_id,
        type: d.type,
        value_type: d.value_type,
        percentage: d.percentage,
        amount: d.amount,
        applies_to: d.applies_to,
        description: d.description,
        is_active: !d.is_active,
      });
      setDiscounts((list) => list.map((x) => (x.id === d.id ? updated : x)));
      showToast(updated.is_active ? 'Descuento activado' : 'Descuento desactivado');
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'No se pudo cambiar el estado del descuento.';
      setActionError(message);
    } finally {
      setTogglingId(null);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    setActionError(null);
    try {
      await deleteDiscount(toDelete.id);
      setDiscounts((list) => list.filter((d) => d.id !== toDelete.id));
      showToast('Descuento eliminado');
      setToDelete(null);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'No se pudo eliminar el descuento.';
      setActionError(message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section className="form-section" style={{ marginTop: 24 }}>
      <h4 className="form-section__title">Descuentos</h4>

      {toast && (
        <div
          className="alert alert--success"
          role="status"
          style={{ marginBottom: 12 }}
        >
          {toast}
        </div>
      )}

      {actionError && (
        <div className="alert" role="alert" style={{ marginBottom: 12 }}>
          {actionError}
        </div>
      )}

      {loading ? (
        <div className="loading-row">
          <SpinnerIcon size={16} /> Cargando…
        </div>
      ) : listError ? (
        <div className="alert" role="alert">
          {listError}
        </div>
      ) : discounts.length === 0 ? (
        <p
          className="empty-state__title"
          style={{ marginTop: 8, marginBottom: 8, fontSize: 14 }}
        >
          Sin descuentos configurados.
        </p>
      ) : (
        <div className="doc-list">
          {discounts.map((d) => (
            <div key={d.id} className="doc-row">
              <div className="doc-row__main">
                <div className="doc-row__name">
                  {labelDiscountType(d.type)} · {discountValueLabel(d, currency)}
                </div>
                <div className="doc-row__meta">
                  {labelDiscountAppliesTo(d.applies_to)}
                  {d.description ? ` · ${d.description}` : ''}
                </div>
                <span
                  className={`badge badge--${d.is_active ? 'active' : 'inactive'}`}
                >
                  {d.is_active ? 'Activo' : 'Inactivo'}
                </span>
              </div>
              {editable && (
                <div className="row-actions">
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => handleToggleActive(d)}
                    disabled={togglingId === d.id}
                    title={d.is_active ? 'Desactivar' : 'Activar'}
                    aria-label={d.is_active ? 'Desactivar' : 'Activar'}
                  >
                    {togglingId === d.id ? (
                      <SpinnerIcon size={14} />
                    ) : d.is_active ? (
                      <CloseIcon size={14} />
                    ) : (
                      <CheckIcon size={14} />
                    )}
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => openEdit(d)}
                    title="Editar"
                    aria-label="Editar"
                  >
                    <PencilIcon size={14} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn icon-btn--danger"
                    onClick={() => setToDelete(d)}
                    title="Eliminar"
                    aria-label="Eliminar"
                  >
                    <TrashIcon size={14} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {editable && (editor ? (
        <div className="discount-editor">
          <div className="field--row">
            <div className="field">
              <label className="field__label" htmlFor="disc-type">
                Tipo
              </label>
              <select
                id="disc-type"
                className="select"
                value={editor.type}
                onChange={(e) => setField('type', e.target.value as DiscountType)}
              >
                {DISCOUNT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {labelDiscountType(t)}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label className="field__label" htmlFor="disc-applies">
                Aplica a
              </label>
              <select
                id="disc-applies"
                className="select"
                value={editor.applies_to}
                onChange={(e) =>
                  setField('applies_to', e.target.value as DiscountAppliesTo)
                }
              >
                {DISCOUNT_APPLIES_TO.map((a) => (
                  <option key={a} value={a}>
                    {labelDiscountAppliesTo(a)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="field">
            <span className="field__label">Tipo de valor</span>
            <div className="tab-group" role="tablist">
              {DISCOUNT_VALUE_TYPES.map((vt) => (
                <button
                  key={vt}
                  type="button"
                  role="tab"
                  aria-selected={editor.value_type === vt}
                  className={
                    'tab-group__item' +
                    (editor.value_type === vt ? ' tab-group__item--active' : '')
                  }
                  onClick={() => {
                    setField('value_type', vt);
                    setField('value', '');
                    setValueError(null);
                  }}
                >
                  {labelDiscountValueType(vt)}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label className="field__label" htmlFor="disc-value">
              {editor.value_type === 'fixed'
                ? 'Monto del descuento'
                : 'Porcentaje (%)'}{' '}
              <span style={{ color: 'var(--color-danger)' }}>*</span>
            </label>
            <input
              id="disc-value"
              className="input"
              type="number"
              step={editor.value_type === 'fixed' ? '0.01' : '1'}
              min="0"
              max={editor.value_type === 'percentage' ? '100' : undefined}
              value={editor.value}
              onChange={(e) => {
                setField('value', e.target.value);
                if (valueError) setValueError(null);
              }}
              aria-invalid={!!valueError}
              placeholder={editor.value_type === 'fixed' ? '0.00' : '0'}
            />
            <span className="field__error">{valueError ?? ''}</span>
          </div>

          <div className="field">
            <label className="field__label" htmlFor="disc-desc">
              Descripción
            </label>
            <textarea
              id="disc-desc"
              className="textarea"
              value={editor.description}
              onChange={(e) => setField('description', e.target.value)}
              placeholder="opcional"
            />
          </div>

          {editor.discount && (
            <div className="switch-row">
              <div>
                <div className="switch-row__label">Descuento activo</div>
                <div className="switch-row__hint">
                  Si se desactiva, el backend deja de aplicarlo.
                </div>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={editor.is_active}
                  onChange={(e) => setField('is_active', e.target.checked)}
                />
                <span className="switch__track" aria-hidden="true" />
                <span className="switch__thumb" aria-hidden="true" />
              </label>
            </div>
          )}

          <div className="form-actions form-actions--end" style={{ marginTop: 8 }}>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={closeEditor}
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={handleSave}
              disabled={saving}
            >
              {saving && <SpinnerIcon />}
              {editor.discount ? 'Guardar descuento' : 'Agregar descuento'}
            </button>
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 12 }}>
          <button type="button" className="btn btn--ghost" onClick={openCreate}>
            <PlusIcon size={14} />
            Agregar descuento
          </button>
        </div>
      ))}

      <ConfirmModal
        open={!!toDelete}
        title="Eliminar descuento"
        message={
          toDelete
            ? `¿Eliminar el descuento ${labelDiscountType(toDelete.type)} (${discountValueLabel(
                toDelete,
                currency,
              )})? Esta acción no se puede deshacer.`
            : ''
        }
        confirmLabel="Eliminar"
        danger
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => !deleting && setToDelete(null)}
      />
    </section>
  );
}
