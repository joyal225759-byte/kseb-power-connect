import { useCallback, useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, Circle, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './App.css'

const API_URL = 'http://localhost:5000/api/outages'
const AUTH_URL = 'http://localhost:5000/api/auth'

// Comprehensive coordinates lookup for Kerala districts and major towns
const KERALA_COORDINATES = {
  Chalakudy: [10.307, 76.331],
  Aluva: [10.107, 76.352],
  Irinjalakuda: [10.342, 76.211],
  Thrissur: [10.527, 76.214],
  Angamaly: [10.196, 76.386],
  Kochi: [9.9816, 76.2999],
  Ernakulam: [9.9816, 76.2999],
  Thiruvananthapuram: [8.5241, 76.9366],
  Kozhikode: [11.2588, 75.7804],
  Kollam: [8.8932, 76.6141],
  Kannur: [11.8745, 75.3704],
  Palakkad: [10.7867, 76.6548],
  Kottayam: [9.5916, 76.5222],
  Malappuram: [11.0510, 76.0711],
  Kasaragod: [12.4996, 74.9869],
  Wayanad: [11.6050, 76.0828],
  Kalpetta: [11.6050, 76.0828],
  Idukki: [9.8500, 76.9700],
  Thodupuzha: [9.8959, 76.7184],
  Pathanamthitta: [9.2648, 76.7870],
  Alappuzha: [9.4981, 76.3388],
  Perumbavoor: [10.1115, 76.4764],
  Guruvayur: [10.5946, 76.0407],
  Muvattupuzha: [9.9894, 76.5790],
  Kunnamkulam: [10.6517, 76.0754],
  Cherthala: [9.6845, 76.3308],
  Kothamangalam: [10.0617, 76.6267],
}

const KERALA_TOWNS = Object.keys(KERALA_COORDINATES)

const emptyForm = {
  area: '',
  status: 'Power Cut',
  description: '',
  scheduledTime: '',
}

function getAreaCoordinates(areaName) {
  if (!areaName) return [10.34, 76.29]
  const trimmed = areaName.trim()
  if (KERALA_COORDINATES[trimmed]) {
    return KERALA_COORDINATES[trimmed]
  }
  const key = Object.keys(KERALA_COORDINATES).find(
    k => k.toLowerCase() === trimmed.toLowerCase()
  )
  if (key) return KERALA_COORDINATES[key]
  // Fallback to central Kerala coordinates
  return [10.34, 76.29]
}

function getStatusColor(status) {
  if (status === 'Power Cut') return '#ef4444'
  if (status === 'Maintenance') return '#f59e0b'
  return '#10b981'
}

function createMarkerIcon(status) {
  const color = getStatusColor(status)
  const isCut = status === 'Power Cut'

  return L.divIcon({
    className: 'custom-map-pin-container',
    html: `
      <div class="custom-map-pin ${isCut ? 'pulse-alert' : ''}" style="--pin-color: ${color};">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
          <path d="M13 2L3 14h7v8l11-12h-8l0-8z"/>
        </svg>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18],
  })
}

// Map Controller for smooth flyTo animation on area selection
function MapViewController({ targetPosition }) {
  const map = useMap()

  useEffect(() => {
    if (targetPosition && Array.isArray(targetPosition) && targetPosition.length === 2) {
      map.flyTo(targetPosition, 11, {
        duration: 1.2,
        easeLinearity: 0.25,
      })
    }
  }, [targetPosition, map])

  return null
}

function App() {
  const [areas, setAreas] = useState([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lastUpdated, setLastUpdated] = useState(null)
  const [view, setView] = useState('customer')

  // Admin auth state
  const [token, setToken] = useState(
    () => sessionStorage.getItem('ksebAdminToken') || ''
  )
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loginError, setLoginError] = useState('')

  // Admin CRUD form state
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [adminSearch, setAdminSearch] = useState('')

  const loadOutages = useCallback(async () => {
    try {
      const response = await fetch(API_URL)

      if (!response.ok) {
        throw new Error('Could not retrieve outage records from the server.')
      }

      const records = await response.json()

      const mapped = records.map(record => ({
        ...record,
        name: record.area,
        position: getAreaCoordinates(record.area),
        color: getStatusColor(record.status),
      }))

      setAreas(mapped)
      setSelected(current =>
        mapped.find(area => area._id === current?._id) || mapped[0] || null
      )
      setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
      setError('')
    } catch {
      setError('Could not connect to KSEB database. Ensure the backend server is running on port 5000.')
    } finally {
      setLoading(false)
    }
  }, [])

  const handleManualRefresh = useCallback(() => {
    setLoading(true)
    loadOutages()
  }, [loadOutages])

  useEffect(() => {
    let ignore = false

    async function initialFetch() {
      try {
        const response = await fetch(API_URL)
        if (!response.ok) throw new Error('Could not retrieve outages')
        const records = await response.json()

        if (!ignore) {
          const mapped = records.map(record => ({
            ...record,
            name: record.area,
            position: getAreaCoordinates(record.area),
            color: getStatusColor(record.status),
          }))

          setAreas(mapped)
          setSelected(mapped[0] || null)
          setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
          setError('')
        }
      } catch {
        if (!ignore) {
          setError('Could not connect to KSEB database. Ensure the backend server is running on port 5000.')
        }
      } finally {
        if (!ignore) {
          setLoading(false)
        }
      }
    }

    initialFetch()

    return () => {
      ignore = true
    }
  }, [])

  // Filtered areas for customer directory
  const filteredAreas = useMemo(() => {
    return areas.filter(area => {
      const matchesSearch =
        area.name.toLowerCase().includes(search.toLowerCase()) ||
        (area.description && area.description.toLowerCase().includes(search.toLowerCase()))
      const matchesStatus =
        statusFilter === 'ALL' || area.status === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [areas, search, statusFilter])

  // Filtered areas for admin table
  const filteredAdminAreas = useMemo(() => {
    return areas.filter(area =>
      area.name.toLowerCase().includes(adminSearch.toLowerCase()) ||
      (area.description && area.description.toLowerCase().includes(adminSearch.toLowerCase())) ||
      area.status.toLowerCase().includes(adminSearch.toLowerCase())
    )
  }, [areas, adminSearch])

  const countByStatus = useCallback(
    status => areas.filter(area => area.status === status).length,
    [areas]
  )

  async function handleLogin(event) {
    event.preventDefault()
    setLoginError('')

    try {
      const response = await fetch(`${AUTH_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Login failed. Please verify credentials.')
      }

      sessionStorage.setItem('ksebAdminToken', data.token)
      setToken(data.token)
      setPassword('')
      setView('admin')
      setNotice('Admin authentication verified. Welcome to KSEB Console.')
    } catch (err) {
      setLoginError(err.message || 'Could not log in. Check backend connection.')
    }
  }

  function handleLogout() {
    sessionStorage.removeItem('ksebAdminToken')
    setToken('')
    setUsername('')
    setPassword('')
    setLoginError('')
    setEditingId(null)
    setForm(emptyForm)
    setNotice('')
    setView('customer')
  }

  function handleChange(event) {
    const { name, value } = event.target
    setForm(current => ({ ...current, [name]: value }))
  }

  function editArea(area) {
    setEditingId(area._id)
    setForm({
      area: area.area,
      status: area.status,
      description: area.description || '',
      scheduledTime: area.scheduledTime || '',
    })
    setNotice('')
    setError('')
    window.scrollTo({ top: 320, behavior: 'smooth' })
  }

  function cancelEdit() {
    setEditingId(null)
    setForm(emptyForm)
    setNotice('')
  }

  function handleUnauthorized(status) {
    if (status === 401 || status === 403) {
      sessionStorage.removeItem('ksebAdminToken')
      setToken('')
      setLoginError('Your admin session has expired or is invalid. Please log in again.')
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')

    try {
      const url = editingId ? `${API_URL}/${editingId}` : API_URL
      const method = editingId ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      })

      const data = await response.json()

      if (!response.ok) {
        handleUnauthorized(response.status)
        throw new Error(data.message || 'Could not save the outage record.')
      }

      setNotice(
        editingId
          ? `Outage record for "${form.area}" updated successfully.`
          : `New outage record for "${form.area}" published to live database.`
      )
      setEditingId(null)
      setForm(emptyForm)
      await loadOutages()
    } catch (err) {
      setError(err.message || 'Could not save the record.')
    } finally {
      setSaving(false)
    }
  }

  async function deleteArea(id, areaName) {
    if (!window.confirm(`Delete outage record for "${areaName}"? This cannot be undone.`)) {
      return
    }

    setError('')
    setNotice('')

    try {
      const response = await fetch(`${API_URL}/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const data = await response.json()

      if (!response.ok) {
        handleUnauthorized(response.status)
        throw new Error(data.message || 'Could not delete the record.')
      }

      if (editingId === id) {
        setEditingId(null)
        setForm(emptyForm)
      }

      setNotice(`Outage record for "${areaName}" removed successfully.`)
      await loadOutages()
    } catch (err) {
      setError(err.message || 'Could not delete the record.')
    }
  }

  return (
    <div className="app-shell">
      {/* Top Banner / Gov Bar */}
      <div className="gov-bar">
        <div className="gov-bar-inner">
          <div className="gov-tag">
            <span className="gov-flag">⚡</span>
            <span>Government of Kerala · Kerala State Electricity Board Ltd.</span>
          </div>
          <div className="gov-links">
            <a href="tel:1912" className="gov-phone">
              <span className="phone-pulse"></span>
              24×7 Centralized Helpline: <strong>1912</strong>
            </a>
            <span className="gov-motto">സേവനം നമ്മുടെ കടമ</span>
          </div>
        </div>
      </div>

      {/* Main Navigation Topbar */}
      <header className="topbar">
        <div className="brand">
          <div className="brand-logo">
            <div className="logo-emblem">⚡</div>
          </div>
          <div className="brand-text">
            <div className="brand-title">
              KSEB <span>Power Connect</span>
            </div>
            <div className="brand-subtitle">
              കേരള സംസ്ഥാന വൈദ്യുതി ബോർഡ് · Outage & Maintenance Portal
            </div>
          </div>
        </div>

        <div className="topbar-right">
          <div className="portal-status-badge">
            <span className="status-ping"></span>
            <span>LIVE GRID MONITOR</span>
          </div>

          <div className="view-toggle">
            <button
              className={`view-btn ${view === 'customer' ? 'active' : ''}`}
              onClick={() => {
                setView('customer')
                setError('')
                setNotice('')
              }}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z"/>
              </svg>
              Customer View
            </button>

            <button
              className={`view-btn ${view === 'admin' ? 'active' : ''}`}
              onClick={() => {
                setView('admin')
                setLoginError('')
                setError('')
                setNotice('')
              }}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>
              </svg>
              Admin Console
              {token && <span className="auth-pill">Active</span>}
            </button>
          </div>

          {view === 'admin' && token && (
            <button className="logout-btn" onClick={handleLogout} title="Log out from Admin Console">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
              </svg>
              Sign out
            </button>
          )}
        </div>
      </header>

      {/* Main Portal Container */}
      <main className="dashboard-container">
        {/* Hero Section */}
        <section className="hero-banner">
          <div className="hero-content">
            <div className="hero-eyebrow">
              <span className="badge-kerala">KERALA POWER DISTRIBUTION</span>
              {lastUpdated && <span className="last-sync">Updated: {lastUpdated}</span>}
            </div>

            <h1 className="hero-title">
              {view === 'admin' ? (
                <>
                  Outage Management & <br />
                  <span>Section Control Center</span>
                </>
              ) : (
                <>
                  Real-time Electricity Status & <br />
                  <span>Outage Tracker across Kerala</span>
                </>
              )}
            </h1>

            <p className="hero-description">
              {view === 'admin'
                ? 'Create, modify, and monitor electrical outage schedules, emergency breakdowns, and planned maintenance records directly linked to MongoDB Atlas.'
                : 'Check electricity continuity, planned transformer maintenance, and estimated power restoration schedules in your division.'}
            </p>

            <div className="hero-actions">
              <button className="hero-btn-refresh" onClick={handleManualRefresh} disabled={loading}>
                <svg
                  className={loading ? 'spin-icon' : ''}
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path d="M23 4v6h-6"></path>
                  <path d="M1 20v-6h6"></path>
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                </svg>
                {loading ? 'Refreshing Grid Data...' : 'Refresh Status'}
              </button>

              <div className="emergency-chip">
                <span>Emergency Breakdown?</span>
                <a href="tel:1912">Dial 1912</a>
              </div>
            </div>
          </div>

          <div className="hero-visual">
            <div className="hero-card-stat">
              <div className="hero-stat-circle">
                <svg viewBox="0 0 24 24" width="28" height="28" fill="#0b805c">
                  <path d="M13 2L3 14h7v8l11-12h-8l0-8z"/>
                </svg>
              </div>
              <div className="hero-stat-text">
                <div className="hero-stat-label">Total Monitored Divisions</div>
                <div className="hero-stat-value">{areas.length} Areas</div>
              </div>
            </div>

            <div className="hero-card-badge">
              <div className="badge-icon">✓</div>
              <div>
                <strong>KSEB 24×7 Rapid Response</strong>
                <p>Overhead line & substation surveillance</p>
              </div>
            </div>
          </div>
        </section>

        {/* Global Notifications */}
        {error && (
          <div className="alert-banner alert-danger">
            <div className="alert-icon">⚠️</div>
            <div className="alert-text">
              <strong>Connection Warning:</strong> {error}
            </div>
            <button className="alert-close" onClick={() => setError('')}>×</button>
          </div>
        )}

        {notice && (
          <div className="alert-banner alert-success">
            <div className="alert-icon">✓</div>
            <div className="alert-text">
              <strong>Notification:</strong> {notice}
            </div>
            <button className="alert-close" onClick={() => setNotice('')}>×</button>
          </div>
        )}

        {/* Status Metrics Cards */}
        {view === 'customer' && (
          <section className="metrics-grid">
            <div
              className={`metric-card ${statusFilter === 'ALL' ? 'metric-card-selected' : ''}`}
              onClick={() => setStatusFilter('ALL')}
            >
              <div className="metric-header">
                <span className="metric-label">All Monitored Areas</span>
                <span className="metric-icon icon-neutral">⚡</span>
              </div>
              <div className="metric-value">{areas.length}</div>
              <div className="metric-footer">
                <span className="metric-hint">Click to show all areas</span>
              </div>
            </div>

            <div
              className={`metric-card card-red ${statusFilter === 'Power Cut' ? 'metric-card-selected' : ''}`}
              onClick={() => setStatusFilter(current => (current === 'Power Cut' ? 'ALL' : 'Power Cut'))}
            >
              <div className="metric-header">
                <span className="metric-label">Active Power Cuts</span>
                <span className="metric-icon icon-red">!</span>
              </div>
              <div className="metric-value text-red">{countByStatus('Power Cut')}</div>
              <div className="metric-footer">
                <span className="metric-sub text-red">Unscheduled or emergency</span>
                <span className="filter-pill">{statusFilter === 'Power Cut' ? 'Filtered' : 'Filter'}</span>
              </div>
            </div>

            <div
              className={`metric-card card-yellow ${statusFilter === 'Maintenance' ? 'metric-card-selected' : ''}`}
              onClick={() => setStatusFilter(current => (current === 'Maintenance' ? 'ALL' : 'Maintenance'))}
            >
              <div className="metric-header">
                <span className="metric-label">Scheduled Maintenance</span>
                <span className="metric-icon icon-yellow">◷</span>
              </div>
              <div className="metric-value text-yellow">{countByStatus('Maintenance')}</div>
              <div className="metric-footer">
                <span className="metric-sub text-yellow">Planned line/substation work</span>
                <span className="filter-pill">{statusFilter === 'Maintenance' ? 'Filtered' : 'Filter'}</span>
              </div>
            </div>

            <div
              className={`metric-card card-green ${statusFilter === 'Available' ? 'metric-card-selected' : ''}`}
              onClick={() => setStatusFilter(current => (current === 'Available' ? 'ALL' : 'Available'))}
            >
              <div className="metric-header">
                <span className="metric-label">Normal Power Supply</span>
                <span className="metric-icon icon-green">✓</span>
              </div>
              <div className="metric-value text-green">{countByStatus('Available')}</div>
              <div className="metric-footer">
                <span className="metric-sub text-green">Grid running normally</span>
                <span className="filter-pill">{statusFilter === 'Available' ? 'Filtered' : 'Filter'}</span>
              </div>
            </div>
          </section>
        )}

        {/* CUSTOMER VIEW */}
        {view === 'customer' ? (
          <section className="portal-grid">
            {/* Left: Leaflet Interactive Map */}
            <div className="map-card-wrapper">
              <div className="card-header">
                <div>
                  <span className="card-eyebrow">GEOGRAPHIC DISTRIBUTION</span>
                  <h2 className="card-title">Interactive Outage Map</h2>
                </div>
                <div className="map-header-badges">
                  <span className="badge-count">
                    {filteredAreas.length} of {areas.length} Locations
                  </span>
                </div>
              </div>

              <div className="leaflet-map-frame">
                <MapContainer
                  center={[10.34, 76.29]}
                  zoom={9}
                  scrollWheelZoom={true}
                  className="kseb-leaflet-container"
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />

                  <MapViewController targetPosition={selected?.position} />

                  {/* Radius Zones */}
                  {filteredAreas.map(area => (
                    <Circle
                      key={`circle-${area._id}`}
                      center={area.position}
                      radius={1200}
                      pathOptions={{
                        color: area.color,
                        fillColor: area.color,
                        fillOpacity: 0.22,
                        weight: 2,
                      }}
                    />
                  ))}

                  {/* Marker Pins */}
                  {filteredAreas.map(area => (
                    <Marker
                      key={`marker-${area._id}`}
                      position={area.position}
                      icon={createMarkerIcon(area.status)}
                      eventHandlers={{
                        click: () => setSelected(area),
                      }}
                    >
                      <Popup className="kseb-map-popup">
                        <div className="popup-content">
                          <div className="popup-header">
                            <strong className="popup-title">{area.name}</strong>
                            <span
                              className={`status-pill ${
                                area.status === 'Power Cut'
                                  ? 'pill-red'
                                  : area.status === 'Maintenance'
                                  ? 'pill-yellow'
                                  : 'pill-green'
                              }`}
                            >
                              {area.status}
                            </span>
                          </div>
                          <p className="popup-desc">
                            {area.description || 'Normal electrical distribution supply.'}
                          </p>
                          <div className="popup-time">
                            <strong>Schedule:</strong> {area.scheduledTime || 'Normal continuous'}
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>
              </div>

              {/* Map Footer Legend */}
              <div className="map-legend-bar">
                <div className="legend-item">
                  <span className="legend-indicator dot-red"></span>
                  <span>Power Cut (Interrupted)</span>
                </div>
                <div className="legend-item">
                  <span className="legend-indicator dot-yellow"></span>
                  <span>Scheduled Maintenance</span>
                </div>
                <div className="legend-item">
                  <span className="legend-indicator dot-green"></span>
                  <span>Normal Supply</span>
                </div>
                <div className="legend-note">
                  *Click any marker or area to focus
                </div>
              </div>
            </div>

            {/* Right: Area Search, Directory & Details */}
            <aside className="sidebar-wrapper">
              <div className="sidebar-card">
                <div className="card-header">
                  <div>
                    <span className="card-eyebrow">DISTRICT & TOWN DIRECTORY</span>
                    <h2 className="card-title">Find Your Area</h2>
                  </div>
                </div>

                {/* Search Bar */}
                <div className="search-input-wrapper">
                  <svg className="search-icon" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                    <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
                  </svg>
                  <input
                    className="kseb-search-input"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search town, division, or reason..."
                  />
                  {search && (
                    <button className="clear-search-btn" onClick={() => setSearch('')}>
                      ×
                    </button>
                  )}
                </div>

                {/* Filter Chips */}
                <div className="filter-chips-row">
                  <button
                    className={`filter-chip ${statusFilter === 'ALL' ? 'active' : ''}`}
                    onClick={() => setStatusFilter('ALL')}
                  >
                    All ({areas.length})
                  </button>
                  <button
                    className={`filter-chip chip-red ${statusFilter === 'Power Cut' ? 'active' : ''}`}
                    onClick={() => setStatusFilter('Power Cut')}
                  >
                    Power Cut ({countByStatus('Power Cut')})
                  </button>
                  <button
                    className={`filter-chip chip-yellow ${statusFilter === 'Maintenance' ? 'active' : ''}`}
                    onClick={() => setStatusFilter('Maintenance')}
                  >
                    Maintenance ({countByStatus('Maintenance')})
                  </button>
                  <button
                    className={`filter-chip chip-green ${statusFilter === 'Available' ? 'active' : ''}`}
                    onClick={() => setStatusFilter('Available')}
                  >
                    Normal ({countByStatus('Available')})
                  </button>
                </div>

                {/* Scrollable Area Directory */}
                <div className="area-directory-list">
                  {loading && (
                    <div className="state-placeholder">
                      <div className="skeleton-loader"></div>
                      <p>Querying real-time records from KSEB servers...</p>
                    </div>
                  )}

                  {!loading && filteredAreas.map(area => {
                    const isSelected = selected?._id === area._id
                    return (
                      <button
                        key={area._id}
                        className={`area-list-item ${isSelected ? 'selected-item' : ''}`}
                        onClick={() => setSelected(area)}
                      >
                        <div className="area-status-dot" style={{ backgroundColor: area.color }}></div>
                        <div className="area-info">
                          <div className="area-name-row">
                            <span className="area-name">{area.name}</span>
                            <span
                              className={`status-pill ${
                                area.status === 'Power Cut'
                                  ? 'pill-red'
                                  : area.status === 'Maintenance'
                                  ? 'pill-yellow'
                                  : 'pill-green'
                              }`}
                            >
                              {area.status}
                            </span>
                          </div>
                          <div className="area-meta-row">
                            <span className="area-desc-snippet">
                              {area.description || 'Normal power supply'}
                            </span>
                            {area.scheduledTime && (
                              <span className="area-time-badge">{area.scheduledTime}</span>
                            )}
                          </div>
                        </div>
                        <span className="area-chevron">›</span>
                      </button>
                    )
                  })}

                  {!loading && filteredAreas.length === 0 && (
                    <div className="state-placeholder empty-search">
                      <span className="empty-icon">🔍</span>
                      <h4>No matching areas found</h4>
                      <p>Try searching for a different Kerala town or clear your filters.</p>
                      <button
                        className="btn-reset-filters"
                        onClick={() => {
                          setSearch('')
                          setStatusFilter('ALL')
                        }}
                      >
                        Reset All Filters
                      </button>
                    </div>
                  )}
                </div>

                {/* Selected Area Details Card */}
                <div className="selected-details-container">
                  {selected ? (
                    <div
                      className={`details-box ${
                        selected.status === 'Power Cut'
                          ? 'box-red'
                          : selected.status === 'Maintenance'
                          ? 'box-yellow'
                          : 'box-green'
                      }`}
                    >
                      <div className="details-header">
                        <div>
                          <span className="details-badge">SELECTED AREA MONITOR</span>
                          <h3 className="details-title">{selected.name}</h3>
                        </div>
                        <span
                          className={`status-pill large-pill ${
                            selected.status === 'Power Cut'
                              ? 'pill-red'
                              : selected.status === 'Maintenance'
                              ? 'pill-yellow'
                              : 'pill-green'
                          }`}
                        >
                          {selected.status}
                        </span>
                      </div>

                      <div className="details-body">
                        <div className="details-row">
                          <span className="details-label">Outage Reason / Update:</span>
                          <p className="details-value">
                            {selected.description || 'Normal uninterrupted grid distribution.'}
                          </p>
                        </div>

                        <div className="details-row">
                          <span className="details-label">Time Window / Restoration:</span>
                          <p className="details-time">
                            ⏱ {selected.scheduledTime || 'Supply continuous (No outages scheduled)'}
                          </p>
                        </div>

                        <div className="safety-tip">
                          <strong>⚠️ KSEB Electrical Safety Advisory:</strong>
                          <p>
                            During thunderstorms or broken cables, stay at least 10 meters away from sagging lines. Report hazards immediately to section officers.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="details-placeholder">
                      <p>Click on any town in the list or map to view in-depth details.</p>
                    </div>
                  )}
                </div>
              </div>
            </aside>
          </section>
        ) : !token ? (
          /* ADMIN LOGIN VIEW */
          <section className="admin-login-layout">
            <div className="login-card">
              <div className="login-header">
                <div className="login-emblem">🔐</div>
                <span className="card-eyebrow">RESTRICTED KSEB ACCESS</span>
                <h2 className="login-title">Section Officer Sign In</h2>
                <p className="login-subtitle">
                  Authenticate with administrative credentials to publish or alter outage reports.
                </p>
              </div>

              <form className="kseb-form" onSubmit={handleLogin}>
                <div className="form-group">
                  <label htmlFor="admin-username">Officer ID / Username</label>
                  <div className="input-with-icon">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                    </svg>
                    <input
                      id="admin-username"
                      autoComplete="username"
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      placeholder="Enter administrator username"
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <div className="label-with-action">
                    <label htmlFor="admin-password">Secure Password</label>
                    <button
                      type="button"
                      className="toggle-pwd-btn"
                      onClick={() => setShowPassword(prev => !prev)}
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  <div className="input-with-icon">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                      <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
                    </svg>
                    <input
                      id="admin-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Enter administrative password"
                      required
                    />
                  </div>
                </div>

                {loginError && (
                  <div className="form-error-banner">
                    <span>⚠️</span>
                    <span>{loginError}</span>
                  </div>
                )}

                <button className="btn-primary-action" type="submit">
                  <span>Sign In to Admin Console</span>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                    <path d="M5 13h11.86l-5.43 5.43 1.42 1.42L21.14 12l-8.29-8.29-1.42 1.42L16.86 11H5v2z"/>
                  </svg>
                </button>

                <div className="security-notice">
                  <span className="shield-icon">🛡️</span>
                  <span>
                    Official KSEB internal system. All actions are logged and authenticated via JSON Web Tokens.
                  </span>
                </div>
              </form>
            </div>
          </section>
        ) : (
          /* ADMIN CONSOLE: MANAGE OUTAGES */
          <section className="admin-console-grid">
            {/* Form Column */}
            <div className="admin-form-card">
              <div className="card-header">
                <div>
                  <span className="card-eyebrow">
                    {editingId ? 'RECORD MODIFICATION' : 'DISPATCH NEW REPORT'}
                  </span>
                  <h2 className="card-title">
                    {editingId ? 'Update Outage Record' : 'Add Outage Record'}
                  </h2>
                </div>
                {editingId && (
                  <span className="badge-editing">EDITING MODE</span>
                )}
              </div>

              <form className="kseb-admin-form" onSubmit={handleSubmit}>
                <div className="form-group">
                  <label htmlFor="area-input">
                    Kerala Town / Division <span className="required-star">*</span>
                  </label>
                  <input
                    id="area-input"
                    name="area"
                    value={form.area}
                    onChange={handleChange}
                    placeholder="e.g. Aluva, Thrissur, Kochi, Chalakudy"
                    maxLength={100}
                    list="kerala-towns-list"
                    required
                  />
                  <datalist id="kerala-towns-list">
                    {KERALA_TOWNS.map(town => (
                      <option key={town} value={town} />
                    ))}
                  </datalist>
                  <span className="form-help">
                    Choose from standard Kerala electrical subdivisions or enter a custom locality.
                  </span>
                </div>

                <div className="form-group">
                  <label htmlFor="status-select">
                    Electrical Supply Status <span className="required-star">*</span>
                  </label>
                  <div className="select-wrapper">
                    <select
                      id="status-select"
                      name="status"
                      value={form.status}
                      onChange={handleChange}
                    >
                      <option value="Power Cut">🔴 Power Cut (Interrupted / Breakdown)</option>
                      <option value="Maintenance">🟡 Maintenance (Scheduled Work / Upgrade)</option>
                      <option value="Available">🟢 Available (Normal Continuous Supply)</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="desc-input">
                    Reason & Work Details
                  </label>
                  <textarea
                    id="desc-input"
                    name="description"
                    value={form.description}
                    onChange={handleChange}
                    placeholder="Describe line maintenance, transformer replacement, 11kV feeder repair, or tree clearance..."
                    rows={4}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="schedule-input">
                    Time Window or Restoration Target
                  </label>
                  <input
                    id="schedule-input"
                    name="scheduledTime"
                    value={form.scheduledTime}
                    onChange={handleChange}
                    placeholder="e.g. 10:00 AM – 02:00 PM or Expected by 4 PM"
                    maxLength={200}
                  />
                </div>

                <div className="admin-form-actions">
                  <button className="btn-primary-action" disabled={saving} type="submit">
                    {saving ? (
                      <>
                        <span className="spin-icon">⏳</span>
                        <span>Saving to Database...</span>
                      </>
                    ) : editingId ? (
                      <>
                        <span>Save Changes</span>
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                        </svg>
                      </>
                    ) : (
                      <>
                        <span>Publish Outage Record</span>
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                          <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                        </svg>
                      </>
                    )}
                  </button>

                  {editingId && (
                    <button className="btn-cancel-action" type="button" onClick={cancelEdit}>
                      Cancel Edit
                    </button>
                  )}
                </div>

                <div className="database-sync-note">
                  <span className="dot-live"></span>
                  <span>Changes are instantly persisted to MongoDB Atlas and published to public map.</span>
                </div>
              </form>
            </div>

            {/* Records Management Column */}
            <div className="admin-records-card">
              <div className="card-header">
                <div>
                  <span className="card-eyebrow">MONGODB ATLAS REPOSITORY</span>
                  <h2 className="card-title">Live Outage Records ({areas.length})</h2>
                </div>

                <button className="btn-refresh-pill" onClick={handleManualRefresh} type="button">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                  </svg>
                  Refresh
                </button>
              </div>

              {/* Admin Record Search Filter */}
              <div className="admin-search-wrapper">
                <input
                  className="kseb-search-input"
                  value={adminSearch}
                  onChange={e => setAdminSearch(e.target.value)}
                  placeholder="Filter records by town name, status, or cause..."
                />
              </div>

              {loading && (
                <div className="state-placeholder">
                  <p>Fetching records from MongoDB Atlas...</p>
                </div>
              )}

              <div className="admin-table-container">
                {!loading && filteredAdminAreas.map(area => (
                  <div className="admin-record-card" key={area._id}>
                    <div className="record-main-info">
                      <div className="record-title-row">
                        <strong className="record-area-name">{area.area}</strong>
                        <span
                          className={`status-pill ${
                            area.status === 'Power Cut'
                              ? 'pill-red'
                              : area.status === 'Maintenance'
                              ? 'pill-yellow'
                              : 'pill-green'
                          }`}
                        >
                          {area.status}
                        </span>
                      </div>

                      <p className="record-description">
                        {area.description || 'No detailed reason provided.'}
                      </p>

                      <div className="record-meta-tags">
                        <span className="meta-schedule">
                          ⏱ {area.scheduledTime || 'Unscheduled'}
                        </span>
                        {area.updatedAt && (
                          <span className="meta-timestamp">
                            Updated: {new Date(area.updatedAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="record-actions-row">
                      <button
                        className="btn-edit-record"
                        type="button"
                        onClick={() => editArea(area)}
                        title="Edit this record"
                      >
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                          <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                        </svg>
                        Edit
                      </button>

                      <button
                        className="btn-delete-record"
                        type="button"
                        onClick={() => deleteArea(area._id, area.area)}
                        title="Permanently remove record"
                      >
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                          <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                        </svg>
                        Delete
                      </button>
                    </div>
                  </div>
                ))}

                {!loading && filteredAdminAreas.length === 0 && (
                  <div className="state-placeholder">
                    <p>No outage records match your criteria.</p>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Safety & Demonstration Banner */}
        <section className="safety-demonstration-card">
          <div className="safety-icon-wrapper">
            <span>ℹ️</span>
          </div>
          <div className="safety-text">
            <strong>KSEB Power Connect · Academic Demonstration Project</strong>
            <p>
              This portal demonstrates real-time MERN architecture with MongoDB Atlas and Leaflet mapping for Kerala power distribution. Sample data shown is for educational simulation. In event of real emergencies, contact KSEB 24×7 customer care at <strong>1912</strong> or WhatsApp helpline at <strong>+91 9496001912</strong>.
            </p>
          </div>
        </section>
      </main>

      {/* Official Footer */}
      <footer className="portal-footer">
        <div className="footer-top">
          <div className="footer-brand">
            <div className="footer-logo">⚡</div>
            <div>
              <div className="footer-title">KSEB Power Connect</div>
              <div className="footer-motto">കേരള സംസ്ഥാന വൈദ്യുതി ബോർഡ് ലിമിറ്റഡ്</div>
            </div>
          </div>

          <div className="footer-contact-items">
            <div className="contact-item">
              <span className="contact-label">24/7 Helpline:</span>
              <a href="tel:1912" className="contact-val">1912 (Toll Free)</a>
            </div>
            <div className="contact-item">
              <span className="contact-label">WhatsApp Support:</span>
              <span className="contact-val">+91 9496001912</span>
            </div>
            <div className="contact-item">
              <span className="contact-label">HQ:</span>
              <span className="contact-val">Vydyuthi Bhavanam, Pattom, Thiruvananthapuram</span>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <p>© {new Date().getFullYear()} Kerala State Electricity Board Ltd. All rights reserved.</p>
          <div className="footer-badges">
            <span className="footer-chip">MongoDB Atlas</span>
            <span className="footer-chip">Express.js</span>
            <span className="footer-chip">React 19 + Leaflet</span>
            <span className="footer-chip">Node.js</span>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default App
