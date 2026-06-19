import { useEffect, useState } from 'react';
import type { GroupCategoryRead, GroupPublic, GroupRead } from '../types';
import { ApiError, listGroupCategories } from '../api';
import { SpinnerIcon } from '../brand';

// Ordena los grupos de una categoría: ordinales por rank asc, el resto por nombre.
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

interface GroupPickerProps {
  value: GroupPublic[];
  onChange: (groups: GroupPublic[]) => void;
}

// Selector reutilizable de grupos: carga categorías+grupos y los presenta como
// chips agrupados por categoría. Permite seleccionar varios, incluso de la misma
// categoría.
export default function GroupPicker({ value, onChange }: GroupPickerProps) {
  const [categories, setCategories] = useState<GroupCategoryRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await listGroupCategories();
        if (active) setCategories(data);
      } catch (err) {
        if (active) {
          setError(
            err instanceof ApiError
              ? err.message
              : 'No se pudieron cargar los grupos.',
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const selectedIds = new Set(value.map((g) => g.id));

  const toggle = (cat: GroupCategoryRead, g: GroupRead) => {
    if (selectedIds.has(g.id)) {
      onChange(value.filter((x) => x.id !== g.id));
    } else {
      const picked: GroupPublic = {
        id: g.id,
        name: g.name,
        category_id: cat.id,
        rank: g.rank,
        category: { id: cat.id, name: cat.name, is_ordinal: cat.is_ordinal },
      };
      onChange([...value, picked]);
    }
  };

  if (loading) {
    return (
      <div className="loading-row">
        <SpinnerIcon size={16} /> Cargando grupos…
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert" role="alert">
        {error}
      </div>
    );
  }

  const withGroups = categories.filter((c) => c.groups.length > 0);

  if (withGroups.length === 0) {
    return (
      <p className="field__hint">
        No hay grupos definidos. Créalos en el módulo Grupos.
      </p>
    );
  }

  return (
    <div className="group-picker">
      {withGroups.map((cat) => (
        <div className="group-picker__category" key={cat.id}>
          <div className="group-picker__category-name">
            {cat.name}
            <span
              className={
                'badge ' +
                (cat.is_ordinal ? 'badge--ordinal' : 'badge--qualitative')
              }
            >
              {cat.is_ordinal ? 'Ordinal' : 'Cualitativa'}
            </span>
          </div>
          <div className="group-picker__chips">
            {sortGroups(cat.groups, cat.is_ordinal).map((g) => {
              const isSelected = selectedIds.has(g.id);
              return (
                <button
                  type="button"
                  key={g.id}
                  className={
                    'group-chip' + (isSelected ? ' group-chip--selected' : '')
                  }
                  onClick={() => toggle(cat, g)}
                  aria-pressed={isSelected}
                >
                  {g.name}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// Chips read-only para vistas de detalle. Muestra "Categoría: Grupo" para dar
// contexto. Devuelve un <span> para poder usarse dentro de un detail-item.
export function GroupChips({ groups }: { groups: GroupPublic[] }) {
  if (groups.length === 0) {
    return (
      <span className="detail-item__value detail-item__value--empty">—</span>
    );
  }
  return (
    <span className="group-chips">
      {groups.map((g) => (
        <span className="group-chip group-chip--readonly" key={g.id}>
          {g.category?.name ? `${g.category.name}: ` : ''}
          {g.name}
        </span>
      ))}
    </span>
  );
}
