import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { collaboratorsApi } from '../api';

const DEFAULT_COLORS = [
  '#3B82F6', '#10B981', '#8B5CF6', '#F59E0B',
  '#EF4444', '#EC4899', '#06B6D4', '#84CC16',
];

function CollaboratorsPage() {
  const [collaborators, setCollaborators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ name: '', email: '', color: DEFAULT_COLORS[0] });

  const fetchCollaborators = async () => {
    setLoading(true);
    try {
      setCollaborators(await collaboratorsApi.list());
    } catch (err) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCollaborators(); }, []);

  const resetForm = () => {
    setFormData({ name: '', email: '', color: DEFAULT_COLORS[collaborators.length % DEFAULT_COLORS.length] });
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (c) => {
    setFormData({ name: c.name, email: c.email, color: c.color });
    setEditingId(c._id);
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await collaboratorsApi.update(editingId, formData);
        toast.success('Colaborador actualizado');
      } else {
        await collaboratorsApi.create(formData);
        toast.success('Colaborador agregado');
      }
      resetForm();
      fetchCollaborators();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Desactivar este colaborador?')) return;
    try {
      await collaboratorsApi.delete(id);
      toast.success('Colaborador desactivado');
      fetchCollaborators();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-steel-900">Equipo</h1>
          <p className="text-steel-500 text-sm mt-0.5">Colaboradores registrados en el sistema</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-semibold text-sm transition-colors shadow-sm"
        >
          + Agregar
        </button>
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={resetForm}>
          <div className="bg-white rounded-2xl shadow-steel-lg w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-steel-900 mb-5">
              {editingId ? 'Editar colaborador' : 'Nuevo colaborador'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-steel-700 mb-1">Nombre</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                  required
                  className="w-full border border-concrete-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-steel-700 mb-1">Email <span className="text-steel-400 font-normal">(opcional)</span></label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
                  className="w-full border border-concrete-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                  placeholder="correo@ejemplo.com"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-steel-700 mb-2">Color</label>
                <div className="flex gap-2 flex-wrap">
                  {DEFAULT_COLORS.map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setFormData(p => ({ ...p, color }))}
                      className={`w-8 h-8 rounded-full transition-transform ${
                        formData.color === color ? 'ring-2 ring-offset-2 ring-steel-400 scale-110' : ''
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={resetForm}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-steel-600 hover:bg-concrete-100 transition-colors">
                  Cancelar
                </button>
                <button type="submit"
                  className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-sm font-semibold transition-colors">
                  {editingId ? 'Guardar' : 'Agregar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="text-center py-12 text-steel-400">Cargando...</div>
      ) : collaborators.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-steel-400 mb-4">No hay colaboradores aún</p>
          <button onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-primary-500 text-white rounded-lg font-semibold text-sm">
            Agregar el primero
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {collaborators.map(c => (
            <div
              key={c._id}
              className={`bg-white dark:bg-steel-800 rounded-xl border border-concrete-200 dark:border-steel-700 shadow-steel p-5 ${!c.isActive ? 'opacity-50' : ''}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
                    style={{ backgroundColor: c.color }}
                  >
                    {c.name?.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-steel-900 truncate">{c.name}</div>
                    <div className="text-xs text-steel-500 truncate">{c.email}</div>
                  </div>
                </div>

                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => handleEdit(c)}
                    className="p-1.5 text-steel-300 hover:text-steel-600 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  <button onClick={() => handleDelete(c._id)}
                    className="p-1.5 text-steel-300 hover:text-red-500 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>

              {!c.isActive && (
                <div className="mt-3 text-xs font-semibold text-red-400 uppercase tracking-wide">Inactivo</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default CollaboratorsPage;
