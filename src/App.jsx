import { useState, useEffect } from 'react'
import { supabase } from './supabase.js'
import './App.css'

const TMDB_KEY = import.meta.env.VITE_TMDB_KEY
const IMG = 'https://image.tmdb.org/t/p/w300'

function StarRating({ value, onChange, readonly }) {
  return (
    <div className="stars">
      {[1,2,3,4,5].map(s => (
        <span key={s} className={`star ${s <= value ? 'filled' : ''} ${readonly ? '' : 'clickable'}`}
          onClick={() => !readonly && onChange?.(s)}>★</span>
      ))}
    </div>
  )
}

export default function App() {
  const [movies, setMovies] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('all')
  const [search, setSearch] = useState('')
  const [tmdbResults, setTmdbResults] = useState([])
  const [tmdbSearch, setTmdbSearch] = useState('')
  const [searching, setSearching] = useState(false)
  const [showAdd, setShowAdd] = useState(false)

  useEffect(() => {
    fetchMovies()
    const ch = supabase.channel('movies')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'movies' }, fetchMovies)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

  async function fetchMovies() {
    setLoading(true)
    const { data } = await supabase.from('movies').select('*').order('created_at', { ascending: false })
    setMovies(data || [])
    setLoading(false)
  }

  async function searchTMDB(q) {
    if (!q.trim()) return setTmdbResults([])
    setSearching(true)
    const res = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=${TMDB_KEY}&language=pt-BR&query=${encodeURIComponent(q)}`)
    const data = await res.json()
    setTmdbResults(data.results?.slice(0, 8) || [])
    setSearching(false)
  }

  async function addMovie(m) {
    await supabase.from('movies').insert([{
      title: m.title,
      year: m.release_date?.slice(0, 4) || '',
      genre: '',
      poster: m.poster_path ? IMG + m.poster_path : '',
      rating: 0,
      watched: false,
      added_by: '',
      notes: m.overview?.slice(0, 200) || '',
      tmdb_id: m.id
    }])
    setTmdbResults([])
    setTmdbSearch('')
    setShowAdd(false)
  }

  async function toggleWatched(movie) {
    await supabase.from('movies').update({ watched: !movie.watched }).eq('id', movie.id)
  }

  async function setRating(movie, rating) {
    await supabase.from('movies').update({ rating }).eq('id', movie.id)
  }

  async function deleteMovie(id) {
    if (confirm('Remover?')) await supabase.from('movies').delete().eq('id', id)
  }

  const filtered = movies.filter(m => {
    if (tab === 'watched' && !m.watched) return false
    if (tab === 'watchlist' && m.watched) return false
    if (search && !m.title.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const stats = {
    total: movies.length,
    watched: movies.filter(m => m.watched).length,
    avg: movies.filter(m => m.rating > 0).length
      ? (movies.filter(m => m.rating > 0).reduce((a, m) => a + m.rating, 0) / movies.filter(m => m.rating > 0).length).toFixed(1)
      : '—'
  }

  return (
    <div className="app">
      <header className="header">
        <div className="logo">🎬 MovieBox</div>
        <div className="stats-bar">
          <span>📽️ {stats.total}</span>
          <span>✅ {stats.watched}</span>
          <span>⭐ {stats.avg}</span>
        </div>
        <button className="btn-add" onClick={() => setShowAdd(true)}>+ Adicionar</button>
      </header>

      <div className="controls">
        <div className="tabs">
          {[['all','Todos'],['watched','Assistidos'],['watchlist','Quero Ver']].map(([v,l]) => (
            <button key={v} className={`tab ${tab===v?'active':''}`} onClick={() => setTab(v)}>{l}</button>
          ))}
        </div>
        <input className="search" placeholder="Filtrar..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? <div className="loading">Carregando...</div> :
       filtered.length === 0 ? <div className="empty">Nenhum filme 🍿 — clique em + Adicionar para buscar</div> : (
        <div className="grid">
          {filtered.map(movie => (
            <div key={movie.id} className={`card ${movie.watched?'watched':'watchlist'}`}>
              {movie.poster
                ? <img className="poster" src={movie.poster} alt={movie.title} />
                : <div className="poster-placeholder">🎬</div>}
              <div className="card-body">
                <div className="card-title">{movie.title}</div>
                {movie.year && <div className="card-meta">{movie.year}</div>}
                <StarRating value={movie.rating} onChange={r => setRating(movie, r)} />
                <div className="card-actions">
                  <button className={`btn-watch ${movie.watched?'is-watched':''}`} onClick={() => toggleWatched(movie)}>
                    {movie.watched ? '✅' : '👁️ Marcar'}
                  </button>
                  <button className="btn-del" onClick={() => deleteMovie(movie.id)}>🗑️</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
          <h2>Buscar Filme</h2>
            <div className="search-box">
              <input
                placeholder="Digite o nome do filme..."
                value={tmdbSearch}
                onChange={e => { setTmdbSearch(e.target.value); searchTMDB(e.target.value) }}
                autoFocus
              />
              {searching && <div className="searching">Buscando...</div>}
            </div>
            <div className="tmdb-results">
              {tmdbResults.map(m => (
                <div key={m.id} className="tmdb-item" onClick={() => addMovie(m)}>
                  {m.poster_path
                    ? <img src={IMG + m.poster_path} alt={m.title} />
                    : <div className="no-poster">🎬</div>}
                  <div>
                    <div className="tmdb-title">{m.title}</div>
                    <div className="tmdb-year">{m.release_date?.slice(0,4)}</div>
                  </div>
                </div>
              ))}
            </div>
            <button className="btn-cancel" onClick={() => setShowAdd(false)}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  )
}
