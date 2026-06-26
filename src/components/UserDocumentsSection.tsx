import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  DocumentCategory,
  DocumentRead,
  DocumentVisibility,
} from '../types';
import {
  ApiError,
  deleteDocument,
  getDocumentDownload,
  listUserDocuments,
  updateDocumentVisibility,
  uploadUserDocument,
} from '../api';
import {
  DownloadIcon,
  FileIcon,
  SpinnerIcon,
  TrashIcon,
  UploadIcon,
} from '../brand';
import ConfirmModal from './ConfirmModal';
import {
  DOCUMENT_CATEGORIES,
  DOCUMENT_VISIBILITIES,
  formatFileSize,
  labelDocumentCategory,
  labelDocumentVisibility,
} from '../utils/documentLabels';

interface UserDocumentsSectionProps {
  userId: number;
  // En edición se puede subir, cambiar visibilidad y eliminar; en "ver
  // detalles" solo se listan y se descargan.
  editable: boolean;
}

export default function UserDocumentsSection({
  userId,
  editable,
}: UserDocumentsSectionProps) {
  const [docs, setDocs] = useState<DocumentRead[]>([]);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Subida
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState<DocumentCategory>('other');
  const [uploading, setUploading] = useState(false);

  // Cambios de visibilidad en curso (por id de documento)
  const [savingVisibility, setSavingVisibility] = useState<number | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const [toDelete, setToDelete] = useState<DocumentRead | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const data = await listUserDocuments(userId);
      setDocs(data);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'No se pudieron cargar los documentos.';
      setListError(message);
      setDocs([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  const resetUpload = () => {
    setFile(null);
    setCategory('other');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setActionError(null);
    try {
      // Se sube solo con la categoría; el documento queda privado por defecto y
      // la visibilidad se cambia explícitamente después desde la lista.
      const created = await uploadUserDocument(userId, category, file);
      setDocs((list) => [created, ...list]);
      resetUpload();
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'No se pudo subir el documento.';
      setActionError(message);
    } finally {
      setUploading(false);
    }
  };

  const handleVisibilityChange = async (
    doc: DocumentRead,
    next: DocumentVisibility,
  ) => {
    if (next === doc.visibility) return;
    setSavingVisibility(doc.id);
    setActionError(null);
    try {
      const updated = await updateDocumentVisibility(doc.id, {
        visibility: next,
      });
      setDocs((list) => list.map((d) => (d.id === doc.id ? updated : d)));
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'No se pudo cambiar la visibilidad.';
      setActionError(message);
    } finally {
      setSavingVisibility(null);
    }
  };

  const handleDownload = async (doc: DocumentRead) => {
    setDownloadingId(doc.id);
    setActionError(null);
    try {
      const { url } = await getDocumentDownload(doc.id);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'No se pudo descargar el documento.';
      setActionError(message);
    } finally {
      setDownloadingId(null);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    setActionError(null);
    try {
      await deleteDocument(toDelete.id);
      setDocs((list) => list.filter((d) => d.id !== toDelete.id));
      setToDelete(null);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'No se pudo eliminar el documento.';
      setActionError(message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section className="form-section" style={{ marginTop: 24 }}>
      <h4 className="form-section__title">Documentos</h4>

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
      ) : docs.length === 0 ? (
        <p
          className="empty-state__title"
          style={{ marginTop: 8, marginBottom: 8, fontSize: 14 }}
        >
          Sin documentos adjuntos.
        </p>
      ) : (
        <div className="doc-list">
          {docs.map((doc) => (
            <div key={doc.id} className="doc-row">
              <div className="doc-row__main">
                <div className="doc-row__name">
                  <FileIcon size={15} />
                  {doc.file_name}
                </div>
                <div className="doc-row__meta">
                  {labelDocumentCategory(doc.category)} ·{' '}
                  {formatFileSize(doc.size_bytes)}
                  {!editable && ` · ${labelDocumentVisibility(doc.visibility)}`}
                </div>
                {editable && (
                  <select
                    className="select doc-row__visibility"
                    value={doc.visibility}
                    disabled={savingVisibility === doc.id}
                    onChange={(e) =>
                      handleVisibilityChange(
                        doc,
                        e.target.value as DocumentVisibility,
                      )
                    }
                    aria-label="Visibilidad del documento"
                  >
                    {DOCUMENT_VISIBILITIES.map((v) => (
                      <option key={v} value={v}>
                        {labelDocumentVisibility(v)}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="row-actions">
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => handleDownload(doc)}
                  disabled={downloadingId === doc.id}
                  title="Descargar"
                  aria-label="Descargar"
                >
                  {downloadingId === doc.id ? (
                    <SpinnerIcon size={14} />
                  ) : (
                    <DownloadIcon size={14} />
                  )}
                </button>
                {editable && (
                  <button
                    type="button"
                    className="icon-btn icon-btn--danger"
                    onClick={() => setToDelete(doc)}
                    title="Eliminar"
                    aria-label="Eliminar"
                  >
                    <TrashIcon size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {editable && (
        <div className="doc-upload">
          <div className="doc-upload__file">
            <input
              ref={fileInputRef}
              type="file"
              style={{ display: 'none' }}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <UploadIcon size={14} />
              Seleccionar archivo
            </button>
            {file && (
              <span className="doc-upload__file-name">
                {file.name} · {formatFileSize(file.size)}
              </span>
            )}
          </div>

          {file && (
            <>
              <div className="field">
                <label className="field__label" htmlFor="doc-category">
                  Categoría
                </label>
                <select
                  id="doc-category"
                  className="select"
                  value={category}
                  onChange={(e) =>
                    setCategory(e.target.value as DocumentCategory)
                  }
                  disabled={uploading}
                >
                  {DOCUMENT_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {labelDocumentCategory(c)}
                    </option>
                  ))}
                </select>
              </div>

              <p
                className="field__hint"
                style={{ color: 'var(--color-text-muted)', marginBottom: 12 }}
              >
                Se subirá como privado. Cámbialo a "Toda la academia" desde la
                lista si debe ser visible para todos.
              </p>

              <div className="form-actions form-actions--end">
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={resetUpload}
                  disabled={uploading}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={handleUpload}
                  disabled={uploading}
                >
                  {uploading && <SpinnerIcon />}
                  Subir
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <ConfirmModal
        open={!!toDelete}
        title="Eliminar documento"
        message={
          toDelete
            ? `¿Eliminar "${toDelete.file_name}"? Esta acción no se puede deshacer.`
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
