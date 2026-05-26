import { useState, useEffect } from 'react'
import { supabase } from './supabase.js'
import './App.css'

const GENRES = ['Ação','Aventura','Animação','Comédia','Crime','Drama','Fantasia','Terror','Romance','Sci-Fi','Thriller','Documentário']
const STARS = [1,2,3,4,5]

function StarRating({ value, onChange, readonly }) {
  return (
    <div className="stars">
      {STARS.map(s => (
        <span
          key={s}
          className={`star ${s <= value ? 'filled' : ''} ${readonly ? '' : 'clickable'}`}
          onClick={() => !readonly && onChange && onChange(s)}
        >★</span>
      ))}
    </div>
  )
}

export default function App() {
  const [movies, setMovies] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('all') // all | watched | watchlist
  const [filterGenre, setFilterGenre] = useState('')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editMovie, setEditMovie] = useState(null)
  const [form, setForm] = useState({ title: '', year: '', genre: '', poster: '', rating: 0, watched: false, added_by: '', notes: '' })

  useEffect(() => {
    fetchMovies()
    const channel = supabase
      .channel('movies')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'movies' }, () => fetchMovies())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  async function fetchMovies() {
    setLoading(true)
    const { data } = await supabase.from('movies').select('*').order('created_at', { ascending: false })
    setMovies(data || [])
    setLoading(false)
  }

  async function saveMovie() {
    if (!form.title.trim()) return
    if (editMovie) {
      await supabase.from('movies').update(form).eq('id', editMovie.id)
    } else {
      await supabase.from('movies').insert([form])
    }
    setShowForm(false)
    setEditMovie(null)
    setForm({ title: '', year: '', genre: '', poster: '', rating: 0, watched: false, added_by: '', notes: '' })
  }

  async function deleteMovie(id) {
    if (confirm('Remover filme?')) await supabase.from('movies').delete().eq('id', id)
  }

  async function toggleWatched(movie) {
    await supabase.from('movies').update({ watched: !movie.watched }).eq('id', movie.id)
  }

  function openEdit(movie) {
    setEditMovie(movie)
    setForm({ title: movie.title, year: movie.year || '', genre: movie.genre || '', poster: movie.poster || '', rating: movie.rating || 0, watched: movie.watched, added_by: movie.added_by || '', notes: movie.notes || '' })
    setShowForm(true)
  }

  const filtered = movies.filter(m => {
    if (tab === 'watched' && !m.watched) return false
    if (tab === 'watchlist' && m.watched) return false
    if (filterGenre && m.genre !== filterGenre) return false
    if (search && !m.title.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const stats = {
    total: movies.length,
    watched: movies.filter(m => m.watched).length,
    watchlist: movies.filter(m => !m.watched).length,
    avgRating: movies.filter(m => m.rating > 0).length
      ? (movies.filter(m => m.rating > 0).reduce((a, m) => a + m.rating, 0) / movies.filter(m => m.rating > 0).length).toFixed(1)
      : '—'
  }

  return (
    <div className="app">
      <header className="header">
        <div className="logo">🎬 MovieBox</div>
        <div className="stats-bar">
          <span>📽️ {stats.total} filmes</span>
          <span>✅ {stats.watched} assistidos</span>
          <span>📋 {stats.watchlist} na lista</span>
          <span>⭐ {stats.avgRating} média</span>
        </div>
        <button className="btn-add" onClick={() => { setEditMovie(null); setForm({ title: '', year: '', genre: '', poster: '', rating: 0, watched: false, added_by: '', notes: '' }); setShowForm(true) }}>
          + Adicionar
        </button>
      </header>

      <div className="controls">
        <div className="tabs">
          {[['all','Todos'],['watched','Assistidos'],['watchlist','Quero Ver']].map(([v,l]) => (
            <button key={v} className={`tab ${tab === v ? 'active' : ''}`} onClick={() => setTab(v)}>{l}</button>
          ))}
        </div>
        <div className="filters">
          <input className="search" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
          <select value={filterGenre} onChange={e => setFilterGenre(e.target.value)}>
            <option value="">Todos os gêneros</option>
            {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="loading">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="empty">Nenhum filme encontrado 🍿</div>
      ) : (
        <div className="grid">
          {filtered.map(movie => (
            <div key={movie.id} className={`card ${movie.watched ? 'watched' : 'watchlist'}`}>
              {movie.poster ? (
                <img className="poster" src={movie.poster} alt={movie.title} onError={e => e.target.style.display='none'} />
              ) : (
                <div className="poster-placeholder">🎬</div>
              )}
              <div className="card-body">
                <div className="card-title">{movie.title}</div>
                <div className="card-meta">
                  {movie.year && <span>{movie.year}</span>}
                  {movie.genre && <span className="badge">{movie.genre}</span>}
                  {movie.added_by && <span className="added-by">👤 {movie.added_by}</span>}
                </div>
                {movie.rating > 0 && <StarRating value={movie.rating} readonly />}
                {movie.notes && <div className="notes">{movie.notes}</div>}
                <div className="card-actions">
                  <button className={`btn-watch ${movie.watched ? 'is-watched' : ''}`} onClick={() => toggleWatched(movie)}>
                    {movie.watched ? '✅ Assistido' : '👁️ Marcar'}
                  </button>
                  <button className="btn-edit" onClick={() => openEdit(movie)}>✏️</button>
                  <button className="btn-del" onClick={() => deleteMovie(movie.id)}>🗑️</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal">
            <h2>{editMovie ? 'Editar Filme' : 'Adicionar Filme'}</h2>
            <div className="form-grid">
              <input placeholder="Título *" value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
              <input placeholder="Ano" value={form.year} onChange={e => setForm({...form, year: e.target.value})} />
              <select value={form.genre} onChange={e => setForm({...form, genre: e.target.value})}>
                <option value="">Gênero</option>
                {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
              <input placeholder="URL do poster" value={form.poster} onChange={e => setForm({...form, poster: e.target.value})} />
              <input placeholder="Adicionado por" value={form.added_by} onChange={e => setForm({...form, added_by: e.target.value})} />
              <div className="form-rating">
                <span>Nota:</span>
                <StarRating value={form.rating} onChange={v => setForm({...form, rating: v})} />
              </div>
              <textarea placeholder="Anotações..." value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} />
              <label className="checkbox-label">
                <input type="checkbox" checked={form.watched} onChange={e => setForm({...form, watched: e.target.checked})} />
                Já assisti
              </label>
            </div>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setShowForm(false)}>Cancelar</button>
              <button className="btn-save" onClick={saveMovie}>Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
