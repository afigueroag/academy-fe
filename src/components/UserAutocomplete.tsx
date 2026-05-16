import { useEffect, useRef, useState } from 'react';
import type { UserRead, UserRole } from '../types';
import { ApiError, listUsers } from '../api';
import { SearchIcon, SpinnerIcon } from '../brand';

interface UserAutocompleteProps {
  role: UserRole;
  excludeIds?: number[];
  onSelect: (user: { id: number; first_name: string; last_name: string }) => void;
  placeholder?: string;
  ariaLabel?: string;
  autoFocus?: boolean;
}

export default function UserAutocomplete({
  role,
  excludeIds = [],
  onSelect,
  placeholder = 'Buscar por nombre',
  ariaLabel = 'Buscar',
  autoFocus = false,
}: UserAutocompleteProps) {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [results, setResults] = useState<UserRead[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(query.trim()), 250);
    return () => window.clearTimeout(t);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!debounced) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        const data = await listUsers({
          role,
          search: debounced,
          status: 'active',
        });
        if (!cancelled) {
          setResults(data);
          setActiveIdx(0);
        }
      } catch (err) {
        if (!cancelled) {
          setResults([]);
          if (err instanceof ApiError) {
            // silent inside dropdown — error is non-blocking
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [debounced, role]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const visible = results.filter((u) => !excludeIds.includes(u.id));

  const pick = (u: UserRead) => {
    onSelect({ id: u.id, first_name: u.first_name, last_name: u.last_name });
    setQuery('');
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActiveIdx((i) => Math.min(i + 1, Math.max(0, visible.length - 1)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter' && open && visible[activeIdx]) {
      e.preventDefault();
      pick(visible[activeIdx]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div className="autocomplete" ref={wrapRef}>
      <div className="search-input" style={{ width: '100%' }}>
        <SearchIcon size={16} />
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          aria-label={ariaLabel}
          autoFocus={autoFocus}
        />
      </div>
      {open && (loading || debounced) && (
        <div className="autocomplete__dropdown" role="listbox">
          {loading && (
            <div className="autocomplete__loading">
              <SpinnerIcon size={14} /> Buscando…
            </div>
          )}
          {!loading && visible.length === 0 && debounced && (
            <div className="autocomplete__empty">Sin resultados</div>
          )}
          {!loading &&
            visible.map((u, i) => (
              <button
                key={u.id}
                type="button"
                role="option"
                aria-selected={i === activeIdx}
                className={
                  'autocomplete__item' +
                  (i === activeIdx ? ' autocomplete__item--active' : '')
                }
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(u)}
              >
                {u.first_name} {u.last_name}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
