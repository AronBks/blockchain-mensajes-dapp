import React, { useEffect, useState } from 'react';
import Web3 from 'web3';
import RegistroContract from './RegistroMensajes.json';
import { subirArchivoIPFS } from './nftStorage';

// Toast component
function Toast({ message, type, onClose }) {
  if (!message) return null;
  return (
    <div style={{
      position: 'fixed', top: 30, right: 30, zIndex: 2000,
      background: type === 'success' ? '#22c55e' : '#dc2626',
      color: '#fff', padding: '16px 32px', borderRadius: 12,
      fontWeight: 700, fontSize: 18, boxShadow: '0 2px 12px #0003', minWidth: 220,
      display: 'flex', alignItems: 'center', gap: 16
    }}>
      {type === 'success' ? (
        <svg width="24" height="24" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#fff3"/><path d="M8 12l2 2 4-4" stroke="#fff" strokeWidth="2" strokeLinecap="round"/></svg>
      ) : (
        <svg width="24" height="24" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#fff3"/><path d="M8 12l4 4 4-8" stroke="#fff" strokeWidth="2" strokeLinecap="round"/></svg>
      )}
      <span>{message}</span>
      <button onClick={onClose} style={{marginLeft:12, background:'none', border:'none', color:'#fff', fontWeight:700, fontSize:18, cursor:'pointer'}}>×</button>
    </div>
  );
}

// Avatar component
function Avatar({ address, size = 32 }) {
  // Simple identicon using blockies or fallback
  if (!address) return null;
  // Color from address
  const color = '#' + address.slice(2, 8);
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: color + '33',
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: color, fontSize: size * 0.45, border: '2px solid ' + color
    }}>
      {address.slice(2, 4).toUpperCase()}
    </div>
  );
}

function App() {
  const [web3, setWeb3] = useState(null);
  const [account, setAccount] = useState('');
  const [contract, setContract] = useState(null);
  const [mensaje, setMensaje] = useState('');
  const [mensajes, setMensajes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [ipfsError, setIpfsError] = useState('');
  const [vista, setVista] = useState('dashboard'); // 'dashboard', 'registrar', 'consultar'
  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState([]);

  // Estado para edición
  const [editando, setEditando] = useState(null); // index del mensaje a editar
  const [nuevoContenido, setNuevoContenido] = useState('');

  // Toast state
  const [toast, setToast] = useState({ message: '', type: 'success' });
  const [archivo, setArchivo] = useState(null);
  const [archivoCID, setArchivoCID] = useState('');
  const [testCID, setTestCID] = useState('');

  useEffect(() => {
    // Inicializa web3 y contrato si hay cuentas conectadas
    const init = async (cuentas) => {
      if (window.ethereum) {
        try {
          const web3Instance = new Web3(window.ethereum);
          let accounts = cuentas;
          if (!accounts) {
            accounts = await web3Instance.eth.getAccounts();
          }
          if (!accounts || accounts.length === 0) {
            setAccount('');
            setWeb3(null);
            setContract(null);
            setMensajes([]);
            return;
          }
          setWeb3(web3Instance);
          setAccount(accounts[0]);

          const networkId = await web3Instance.eth.net.getId();
          const deployedNetwork = RegistroContract.networks[networkId];

          if (!deployedNetwork) {
            alert('Contrato no desplegado en esta red.');
            return;
          }

          const instance = new web3Instance.eth.Contract(
            RegistroContract.abi,
            deployedNetwork.address
          );
          setContract(instance);

          let datos = [];
          if (instance.methods.obtenerTodosLosMensajes) {
            try {
              datos = await instance.methods.obtenerTodosLosMensajes().call();
            } catch (e) {
              datos = [];
            }
          }
          setMensajes(datos);
        } catch (error) {
          console.error('Error al conectar Web3:', error);
        }
      } else {
        alert('Por favor instala MetaMask.');
      }
    };
    init();

    // Escuchar cambios de cuenta y red
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', (accounts) => {
        init(accounts);
      });
      window.ethereum.on('chainChanged', () => {
        window.location.reload();
      });
    }
    // Limpieza de listeners al desmontar
    return () => {
      if (window.ethereum && window.ethereum.removeListener) {
        window.ethereum.removeListener('accountsChanged', init);
        window.ethereum.removeListener('chainChanged', () => window.location.reload());
      }
    };
  }, []);

  useEffect(() => {
    if (!contract) return;
    let pollingInterval;
    const actualizarMensajes = async () => {
      if (contract.methods.obtenerTodosLosMensajes) {
        try {
          const nuevosMensajes = await contract.methods.obtenerTodosLosMensajes().call();
          setMensajes(nuevosMensajes);
        } catch (e) {}
      }
    };
    pollingInterval = setInterval(actualizarMensajes, 4000);
    return () => {
      if (pollingInterval) clearInterval(pollingInterval);
    };
  }, [contract]);


  // --- MODIFICAR función enviarMensaje para NO subir archivos ---
  const enviarMensaje = async () => {
    if (!contract) {
      setToast({ message: 'Contrato no inicializado o red incorrecta.', type: 'error' });
      return;
    }
    if (mensaje.trim() === '') {
      setIpfsError('Debes escribir un mensaje para enviar.');
      return;
    }
    setLoading(true);
    setIpfsError('');
    setToast({ message: 'Enviando mensaje a la blockchain...', type: 'success' });
    let cid = '';
    try {
      if (archivo) {
        setToast({ message: 'Subiendo archivo a IPFS...', type: 'success' });
        cid = await subirArchivoIPFS(archivo);
        setArchivoCID(cid);
        setToast({ message: 'Archivo subido a IPFS.', type: 'success' });
      }
      await contract.methods.registrarMensaje(mensaje, cid).send({ from: account });
      setTimeout(async () => {
        if (contract.methods.obtenerTodosLosMensajes) {
          const nuevosMensajes = await contract.methods.obtenerTodosLosMensajes().call();
          setMensajes(nuevosMensajes);
        }
        setMensaje('');
        setArchivo(null);
        setArchivoCID('');
        setLoading(false);
        setToast({ message: 'Mensaje registrado exitosamente.', type: 'success' });
      }, 1000);
    } catch (err) {
      setIpfsError('Error al enviar mensaje: ' + (err?.message || err));
      setLoading(false);
      setToast({ message: 'Error al enviar mensaje.', type: 'error' });
    }
  };

  // Función para confirmar mensaje pendiente
  const confirmarMensaje = async (index) => {
    if (!contract) return;
    setLoading(true);
    setToast({ message: 'Confirmando mensaje...', type: 'success' });
    try {
      await contract.methods.confirmarMensaje(index).send({ from: account });
      setTimeout(async () => {
        if (contract.methods.obtenerTodosLosMensajes) {
          const nuevosMensajes = await contract.methods.obtenerTodosLosMensajes().call();
          setMensajes(nuevosMensajes);
        }
        setLoading(false);
        setToast({ message: 'Mensaje confirmado.', type: 'success' });
      }, 1000);
    } catch (err) {
      setIpfsError('Error al confirmar mensaje: ' + (err?.message || err));
      setLoading(false);
      setToast({ message: 'Error al confirmar mensaje.', type: 'error' });
    }
  };

  // --- DISEÑO DASHBOARD ---
  // Contadores para tarjetas
  // Mostrar todos los mensajes (sin filtrar por estado)
  // Filtrar mensajes por cuenta conectada (declarar antes de usar en KPIs)
  const mensajesCuenta = mensajes.filter(m => m.remitente && account && m.remitente.toLowerCase() === account.toLowerCase());
  // Usar mensajesCuenta para KPIs
  const totalRegistros = mensajesCuenta.length;
  const confirmados = mensajesCuenta.filter(m => Number(m.estado) === 1).length;
  const pendientes = mensajesCuenta.filter(m => Number(m.estado) === 0).length;

  // Helper para abreviar la cuenta
  const abreviarCuenta = (cuenta) => {
    if (!cuenta) return '';
    return cuenta.slice(0, 6) + '...' + cuenta.slice(-4);
  };

  // Filtrado de búsqueda intuitivo para la sección Consultar
  useEffect(() => {
    if (vista !== 'consultar') return;
    if (!busqueda.trim()) {
      setResultados([]);
      return;
    }
    const query = busqueda.trim();
    // Si es número, buscar por ID exacto primero
    if (/^\d+$/.test(query)) {
      const idx = parseInt(query, 10);
      if (mensajes[idx]) {
        setResultados([{ ...mensajes[idx], _id: idx }]);
        return;
      }
      // Si no hay resultado por ID, buscar por coincidencia de texto (por si el mensaje es solo números)
      setResultados(
        mensajes
          .map((msg, idx) => ({ ...msg, _id: idx }))
          .filter((msg) => msg.contenido && msg.contenido.toLowerCase().includes(query.toLowerCase()))
      );
      return;
    }
    // Si es texto, buscar por coincidencia en contenido (case-insensitive)
    setResultados(
      mensajes
        .map((msg, idx) => ({ ...msg, _id: idx }))
        .filter((msg) => msg.contenido && msg.contenido.toLowerCase().includes(query.toLowerCase()))
    );
  }, [busqueda, mensajes, vista]);

  // Función para exportar mensajes a CSV
  function exportarMensajesCSV(mensajes) {
    if (!mensajes || mensajes.length === 0) return;
    const encabezado = ['ID', 'Contenido', 'Estado', 'Timestamp', 'Remitente'];
    const filas = mensajes.map((msg, idx) => [
      idx + 1,
      '"' + (msg.contenido || '').replace(/"/g, '""') + '"',
      Number(msg.estado) === 1 ? 'Confirmado' : 'Pendiente',
      msg.timestamp ? new Date(parseInt(msg.timestamp) * 1000).toLocaleString() : '',
      msg.remitente
    ]);
    const csv = [encabezado, ...filas].map(row => row.join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'historial_mensajes_blockchain.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ minHeight: '100vh', background: '#fff8f2', display: 'flex' }}>
      {/* Sidebar overlay for mobile */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)}></div>
      )}
      {/* Sidebar */}
      <nav className={`sidebar${sidebarOpen ? ' open' : ''}`} style={{ display: sidebarOpen ? 'block' : 'none' }}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none"><rect width="32" height="32" rx="8" fill="#fff3"/><path d="M10 18l4-8 4 8" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M16 22v-4" stroke="#fff" strokeWidth="2" strokeLinecap="round"/></svg>
            Registro Seguro
          </div>
          <div className="sidebar-desc">Gestión de Registros Blockchain</div>
        </div>
        <div className="sidebar-nav">
          <div className="sidebar-nav-title">Navegación Principal</div>
          <ul>
            <li className={vista === 'dashboard' ? 'active' : ''} onClick={() => setVista('dashboard')}>
              <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="2" fill="#fff"/><rect x="14" y="3" width="7" height="7" rx="2" fill="#fff3"/><rect x="14" y="14" width="7" height="7" rx="2" fill="#fff"/><rect x="3" y="14" width="7" height="7" rx="2" fill="#fff3"/></svg>
              Dashboard
            </li>
            <li className={vista === 'registrar' ? 'active' : ''} onClick={() => setVista('registrar')}>
              <span style={{fontSize:18}}>＋</span>Registrar Datos
            </li>
            <li className={vista === 'consultar' ? 'active' : ''} onClick={() => setVista('consultar')}>
              <span style={{fontSize:18}}>🔍</span>Consultar
            </li>
            <li className={vista === 'historial' ? 'active' : ''} onClick={() => setVista('historial')}><span style={{fontSize:18}}>⏱️</span>Historial</li>
            <li className={vista === 'vision' ? 'active' : ''} onClick={() => setVista('vision')}>
              <span style={{fontSize:18}}>📊</span>Visión General
            </li>
            <li className={vista === 'configuracion' ? 'active' : ''} onClick={() => setVista('configuracion')}><span style={{fontSize:18}}>⚙️</span>Configuración</li>
          </ul>
        </div>
        <div className="sidebar-network">
          <div style={{ color: '#ffe5b4', fontWeight: 600, fontSize: 14, marginBottom: 8 }}>Estado de Red</div>
          <div><span className="dot green"></span>Ethereum Testnet</div>
          <div><span className="dot blue"></span>Gas: 20 Gwei</div>
        </div>
      </nav>
      {/* Main content */}
      <div className="main" style={{ flex: 1, padding: 0, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        {/* Header SIEMPRE arriba */}
        <div className="dashboard-header" style={{ position: 'sticky', top: 0, zIndex: 10, background: '#ffb366', minHeight: 60, display: 'flex', alignItems: 'center', padding: '0 24px', boxShadow: '0 2px 8px #0001' }}>
          <div className="dashboard-title" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="sidebar-hamburger" onClick={() => setSidebarOpen(!sidebarOpen)} style={{ marginRight: 10, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <rect y="6" width="28" height="3" rx="1.5" fill="#f97416"/>
                <rect y="13" width="28" height="3" rx="1.5" fill="#f97416"/>
                <rect y="20" width="28" height="3" rx="1.5" fill="#f97416"/>
              </svg>
            </button>
            {vista === 'dashboard' ? 'Dashboard' : vista === 'registrar' ? 'Registrar Datos' : 'Consultar'}
          </div>
          {account ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, background: '#e9f9ef',
              borderRadius: 12, padding: '8px 18px', fontWeight: 600, color: '#16a34a', fontSize: '1rem', border: '1px solid #b6f2d6'
            }}>
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="10" fill="#22c55e"/><path d="M6 10.5l2.5 2.5L14 8.5" stroke="#fff" strokeWidth="2" strokeLinecap="round"/></svg>
              <span style={{ color: '#222', fontWeight: 600 }}>{abreviarCuenta(account)}</span>
            </div>
          ) : (
            <button className="dashboard-btn" onClick={async () => {
              if (window.ethereum) {
                try {
                  await window.ethereum.request({ method: 'eth_requestAccounts' });
                } catch (err) {
                  if (err && err.code === -32002) {
                    alert('MetaMask ya está solicitando conexión. Busca la ventana emergente o desbloquea MetaMask.');
                  } else if (err && err.code === 4001) {
                  } else {
                    alert('Error al conectar con MetaMask: ' + (err && err.message ? err.message : 'Desconocido'));
                  }
                }
              } else {
                alert('Por favor instala MetaMask.');
              }
            }}>
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><rect width="20" height="20" rx="4" fill="#fff"/><path d="M5 12h14M12 5v14" stroke="#111" strokeWidth="2" strokeLinecap="round"/></svg>
              Conectar MetaMask
            </button>
          )}
        </div>

        {/* Contenido principal según vista */}
        {vista === 'consultar' && (
          <div style={{ maxWidth: 900, margin: '40px auto', background: '#fff', borderRadius: 18, boxShadow: '0 2px 12px #0001', padding: '40px 40px 32px 40px', border: '1px solid #eee', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
              <svg width="32" height="32" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#f1f5f9"/><path d="M11 17a6 6 0 100-12 6 6 0 000 12zm7 7l-4.35-4.35" stroke="#2563eb" strokeWidth="2" strokeLinecap="round"/></svg>
              <span style={{ fontWeight: 700, fontSize: 32 }}>Consultar Registros</span>
            </div>
            <div style={{ color: '#888', fontSize: 20, marginBottom: 32 }}>Busca registros por ID o por texto en la blockchain</div>
            <div style={{ fontWeight: 600, fontSize: 22, marginBottom: 12 }}>Buscar</div>
            <input
              type="text"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Introduce el ID o texto a buscar..."
              style={{ fontSize: 22, padding: '18px 16px', borderRadius: 10, border: '1px solid #e5e7eb', background: '#fafbfc', marginBottom: 24, width: 400, maxWidth: '100%' }}
              autoFocus
            />
            <div style={{ fontWeight: 600, fontSize: 22, marginBottom: 12 }}>Resultados</div>
            {busqueda.trim() !== '' && (
              <ul className="activity-list" style={{ width: '100%' }}>
                {resultados.length === 0 && (
                  <li className="activity-item" style={{ justifyContent: 'center', color: '#888' }}>No hay resultados para tu búsqueda.</li>
                )}
                {resultados.map((msg) => (
                  <li key={msg._id} className="activity-item">
                    <div className="activity-main">
                      <span className="activity-icon activity-success">
                        <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#dcfce7"/><path d="M8 12l2 2 4-4" stroke="#16a34a" strokeWidth="2" strokeLinecap="round"/></svg>
                      </span>
                      <span className="activity-label">ID:</span>
                      <span style={{ fontWeight: 700, marginRight: 8 }}>{msg._id}</span>
                      <span className="activity-label">Mensaje:</span>
                      <span>{msg.contenido}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span className="activity-status status-success">confirmado</span><br />
                      <span className="activity-meta">{msg.timestamp ? new Date(parseInt(msg.timestamp) * 1000).toLocaleString() : ''}</span><br />
                      <span className="activity-meta">De: {msg.remitente}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {vista === 'historial' && (
          <div style={{ maxWidth: 1100, margin: '32px auto', background: '#fff', borderRadius: 18, boxShadow: '0 2px 12px #0001', padding: '40px 40px 32px 40px', border: '1px solid #eee' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
              <span style={{ fontSize: 32, color: '#f97416' }}>⏱️</span>
              <span style={{ fontWeight: 700, fontSize: 36 }}>Historial Completo</span>
              <button onClick={() => exportarMensajesCSV(mensajes)} style={{marginLeft:'auto',padding:'10px 22px',borderRadius:8,background:'#2563eb',color:'#fff',fontWeight:700,border:'none',fontSize:18,cursor:'pointer',boxShadow:'0 1px 4px #0001',display:'flex',alignItems:'center',gap:8}}>
                <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><path d="M12 4v12m0 0l-4-4m4 4l4-4" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><rect x="4" y="18" width="16" height="2" rx="1" fill="#fff"/></svg>
                Exportar CSV
              </button>
            </div>
            <div style={{ color: '#888', fontSize: 20, marginBottom: 32 }}>Todos los registros almacenados en la blockchain</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px #0001', fontSize: 18 }}>
                <thead>
                  <tr style={{ background: '#fff7f0', color: '#f97416', fontWeight: 700 }}>
                    <th style={{ padding: '14px 12px', textAlign: 'left', borderBottom: '2px solid #ffe5b4' }}>ID</th>
                    <th style={{ padding: '14px 12px', textAlign: 'left', borderBottom: '2px solid #ffe5b4' }}>Datos</th>
                    <th style={{ padding: '14px 12px', textAlign: 'left', borderBottom: '2px solid #ffe5b4' }}>Estado</th>
                    <th style={{ padding: '14px 12px', textAlign: 'left', borderBottom: '2px solid #ffe5b4' }}>Timestamp</th>
                    <th style={{ padding: '14px 12px', textAlign: 'left', borderBottom: '2px solid #ffe5b4' }}>Remitente</th>
                    <th style={{ padding: '14px 12px', textAlign: 'left', borderBottom: '2px solid #ffe5b4' }}>Archivo</th>
                    <th style={{ padding: '14px 12px', textAlign: 'left', borderBottom: '2px solid #ffe5b4' }}>Avatar</th>
                  </tr>
                </thead>
                <tbody>
                  {mensajes.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', color: '#bbb', padding: 32 }}>No hay registros en la blockchain.</td>
                    </tr>
                  )}
                  {mensajes.map((msg, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #ffe5b4' }}>
                      <td style={{ padding: '12px 10px', color: '#f97416', fontWeight: 700 }}>#{idx + 1}</td>
                      <td style={{ padding: '12px 10px', color: '#222' }}>{msg.contenido}</td>
                      <td style={{ padding: '12px 10px' }}>
                        {Number(msg.estado) === 1 ? (
                          <span style={{display:'inline-flex',alignItems:'center',gap:6,fontWeight:600,color:'#22c55e',background:'#dcfce7',borderRadius:16,padding:'4px 16px',fontSize:16}}>
                            confirmado
                          </span>
                        ) : (
                          <span style={{display:'inline-flex',alignItems:'center',gap:6,fontWeight:600,color:'#eab308',background:'#fef9c3',borderRadius:16,padding:'4px 16px',fontSize:16}}>
                            pendiente
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '12px 10px', color: '#666' }}>{msg.timestamp ? new Date(parseInt(msg.timestamp) * 1000).toLocaleString() : ''}</td>
                      <td style={{ padding: '12px 10px', color: '#666', fontFamily: 'monospace', fontSize: 15 }}>{msg.remitente}</td>
                      <td style={{ padding: '12px 10px' }}>{msg.archivoHash && (
                        <a href={`https://files.lighthouse.storage/viewFile/${msg.archivoHash}`} target="_blank" rel="noopener noreferrer" style={{color:'#2563eb', fontWeight:600, textDecoration:'underline'}}>Ver archivo</a>
                      )}</td>
                      <td style={{ padding: '12px 10px' }}><Avatar address={msg.remitente} size={32} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {vista === 'dashboard' && (
          <>
            {/* Summary Cards */}
            <div className="summary-cards">
              <div className="summary-card summary-total">
                <span className="summary-icon">
                  <svg width="32" height="32" fill="none" viewBox="0 0 24 24"><rect width="24" height="24" rx="8" fill="#eff6ff"/><path d="M8 8h8v8H8z" fill="#2563eb"/></svg>
                </span>
                <div>
                  <div className="summary-value">{totalRegistros}</div>
                  <div className="summary-label">Registros Totales</div>
                </div>
              </div>
              <div className="summary-card summary-confirm">
                <span className="summary-icon">
                  <svg width="32" height="32" fill="none" viewBox="0 0 24 24"><rect width="24" height="24" rx="8" fill="#dcfce7"/><path d="M8 12l3 3 5-5" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </span>
                <div>
                  <div className="summary-value">{confirmados}</div>
                  <div className="summary-label">Confirmados</div>
                </div>
              </div>
              <div className="summary-card summary-pending">
                <span className="summary-icon">
                  <svg width="32" height="32" fill="none" viewBox="0 0 24 24"><rect width="24" height="24" rx="8" fill="#fef9c3"/><path d="M12 8v4l3 3" stroke="#eab308" strokeWidth="2" strokeLinecap="round"/></svg>
                </span>
                <div>
                  <div className="summary-value">{pendientes}</div>
                  <div className="summary-label">Pendientes</div>
                </div>
              </div>
              <div className="summary-card summary-network">
                <span className="summary-icon">
                  <svg width="32" height="32" fill="none" viewBox="0 0 24 24"><rect width="24" height="24" rx="8" fill="#f3e8ff"/><path d="M12 8a4 4 0 100 8 4 4 0 000-8z" fill="#a21caf"/></svg>
                </span>
                <div>
                  <div className="summary-value">Testnet</div>
                  <div className="summary-label">Red Activa</div>
                </div>
              </div>
            </div>
            {/* Actividad Reciente */}
            <div style={{ maxWidth: 900, margin: '32px auto', background: '#fff', borderRadius: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.04)', padding: 32 }}>
              <div style={{ fontSize: '1.4rem', fontWeight: 'bold', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="24" height="24" fill="none" viewBox="0 0 24 24"><path d="M3 12h3l3 8 4-16 3 8h5" stroke="#222" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Actividad Reciente
              </div>
              <div style={{ color: '#888', fontSize: 16, marginBottom: 18 }}>Últimos mensajes registrados en la blockchain</div>
              <ul className="activity-list">
                {mensajesCuenta.length === 0 && (
                  <li className="activity-item" style={{ justifyContent: 'center', color: '#888' }}>No hay mensajes registrados aún.</li>
                )}
                {mensajesCuenta.map((msg, index) => (
                  <li key={index} className="activity-item">
                    <div className="activity-main">
                      <span className="activity-icon activity-success">
                        {Number(msg.estado) === 1 ? (
                          <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#dcfce7"/><path d="M8 12l2 2 4-4" stroke="#16a34a" strokeWidth="2" strokeLinecap="round"/></svg>
                        ) : (
                          <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#fef9c3"/><path d="M12 8v4l3 3" stroke="#eab308" strokeWidth="2" strokeLinecap="round"/></svg>
                        )}
                      </span>
                      <span className="activity-label">Mensaje registrado:</span>
                      <span style={{
                        display: 'inline-block',
                        maxWidth: 400,
                        whiteSpace: 'pre-line',
                        wordBreak: 'break-word',
                        overflowWrap: 'break-word',
                        background: '#f8fafc',
                        borderRadius: 8,
                        padding: '6px 10px',
                        marginLeft: 6,
                        fontSize: 17,
                        maxHeight: 90,
                        overflowY: 'auto',
                        boxShadow: '0 1px 4px #0001',
                      }}>{msg.contenido}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      {Number(msg.estado) === 1 ? (
                        <span className="activity-status status-success">confirmado</span>
                      ) : (
                        <span className="activity-status status-pending">pendiente {account && (<button onClick={() => confirmarMensaje(mensajes.length-1-index)} disabled={loading} style={{marginLeft:8,padding:'2px 10px',borderRadius:8,border:'none',background:'#f97416',color:'#fff',fontWeight:600,cursor:loading?'not-allowed':'pointer'}}>Confirmar</button>)}</span>
                      )}
                      <br />
                      <span className="activity-meta">{msg.timestamp ? new Date(parseInt(msg.timestamp) * 1000).toLocaleString() : ''}</span><br />
                      <span className="activity-meta">De: {msg.remitente}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}

        {vista === 'registrar' && (
          <div style={{ maxWidth: 1100, margin: '32px auto', background: '#fff', borderRadius: 18, boxShadow: '0 2px 12px #0001', padding: '40px 40px 32px 40px', border: '1px solid #eee' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
              <span style={{ fontSize: 32, color: '#2563eb' }}>＋</span>
              <span style={{ fontWeight: 700, fontSize: 36 }}>Registrar Nuevos Datos</span>
            </div>
            <div style={{ color: '#888', fontSize: 20, marginBottom: 32 }}>Envía información al contrato inteligente en la blockchain</div>
            <div style={{ fontWeight: 600, fontSize: 22, marginBottom: 12 }}>Datos del Registro</div>
            <form
              style={{ display: 'flex', flexDirection: 'column', gap: 18, marginBottom: 24 }}
              onSubmit={async (e) => {
                e.preventDefault();
                await enviarMensaje();
              }}
            >
              <input
                type="text"
                value={mensaje}
                onChange={(e) => setMensaje(e.target.value)}
                placeholder="Introduce los datos a almacenar..."
                className="input"
                disabled={loading || !account || !contract}
                style={{ fontSize: 22, padding: '18px 16px', borderRadius: 10, border: '1px solid #e5e7eb', background: '#fafbfc' }}
                autoFocus
              />
              {/* Input drag & drop moderno para archivo */}
              <div
                onDrop={e => {
                  e.preventDefault();
                  if (loading || !account || !contract) return;
                  const file = e.dataTransfer.files[0];
                  if (file) setArchivo(file);
                }}
                onDragOver={e => e.preventDefault()}
                style={{
                  border: '2px dashed #2563eb',
                  borderRadius: 12,
                  padding: '32px 0',
                  background: archivo ? '#e0f2fe' : '#f8fafc',
                  textAlign: 'center',
                  color: '#2563eb',
                  fontWeight: 600,
                  fontSize: 20,
                  cursor: loading || !account || !contract ? 'not-allowed' : 'pointer',
                  marginBottom: 8,
                  transition: 'background 0.2s',
                  outline: archivo ? '2px solid #2563eb' : 'none',
                  position: 'relative',
                }}
                tabIndex={0}
                onClick={() => {
                  if (loading || !account || !contract) return;
                  document.getElementById('fileInputDragDrop').click();
                }}
                onKeyDown={e => {
                  if ((e.key === 'Enter' || e.key === ' ') && !(loading || !account || !contract)) {
                    document.getElementById('fileInputDragDrop').click();
                  }
                }}
                aria-label="Subir archivo a IPFS"
              >
                <svg width="48" height="48" fill="none" viewBox="0 0 24 24" style={{marginBottom:10}}><rect width="24" height="24" rx="8" fill="#2563eb22"/><path d="M12 17V7M12 7l-4 4M12 7l4 4" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                {archivo ? `Archivo seleccionado: ${archivo.name}` : 'Arrastra un archivo aquí o haz clic para seleccionar'}
                <input
                  id="fileInputDragDrop"
                  type="file"
                  style={{ display: 'none' }}
                  onChange={e => {
                    if (e.target.files[0]) setArchivo(e.target.files[0]);
                  }}
                  disabled={loading || !account || !contract}
                  accept="image/*,.pdf,.txt,.doc,.docx,.zip,.rar,.csv,.json,.xlsx,.ppt,.pptx"
                />
              </div>
              {/* Fin input drag & drop */}
              <button
                type="submit"
                className="button"
                disabled={loading || !account || !contract || mensaje.trim() === ''}
                style={{
                  fontSize: 22,
                  padding: '18px 0',
                  borderRadius: 12,
                  background: loading || !account || !contract || mensaje.trim() === '' ? '#e5e7eb' : '#f97416',
                  color: '#fff',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 12,
                  border: 'none',
                  cursor: loading || !account || !contract || mensaje.trim() === '' ? 'not-allowed' : 'pointer',
                  boxShadow: '0 2px 8px rgba(249,116,22,0.08)'
                }}
              >
                <svg width="28" height="28" fill="none" viewBox="0 0 24 24"><path d="M2 12l19-7-7 19-2.5-8.5L2 12z" stroke="#fff" strokeWidth="2" strokeLinejoin="round"/></svg>
                {loading ? 'Enviando...' : 'Enviar a Blockchain'}
              </button>
              {(!account || !contract) && (
                <div style={{ background: '#fafbfc', border: '1px solid #e5e7eb', borderRadius: 10, padding: '18px 16px', color: '#222', display: 'flex', alignItems: 'center', gap: 12, fontSize: 20 }}>
                  <svg width="28" height="28" fill="none" viewBox="0 0 24 24"><rect width="24" height="24" rx="8" stroke="#222" strokeWidth="1.5"/><path d="M8 12h8M8 16h8M8 8h8" stroke="#222" strokeWidth="2" strokeLinecap="round"/></svg>
                  Conecta tu wallet para interactuar con la blockchain
                </div>
              )}
              {ipfsError && <div style={{ color: 'red', marginBottom: 8 }}>{ipfsError}</div>}
            </form>
            <div style={{ fontWeight: 600, fontSize: 22, marginBottom: 12, marginTop: 24 }}>Mensajes Registrados</div>
            <ul className="activity-list">
              {mensajesCuenta.length === 0 && (
                <li className="activity-item" style={{ justifyContent: 'center', color: '#888' }}>No hay mensajes registrados aún.</li>
              )}
              {[...mensajesCuenta].reverse().map((msg, index) => (
                <li key={index} className="activity-item">
                  <div className="activity-main">
                    <span className="activity-icon activity-success">
                      <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#dcfce7"/><path d="M8 12l2 2 4-4" stroke="#16a34a" strokeWidth="2" strokeLinecap="round"/></svg>
                    </span>
                    <span className="activity-label">Mensaje registrado:</span>
                    <span style={{
                      display: 'inline-block',
                      maxWidth: 400,
                      whiteSpace: 'pre-line',
                      wordBreak: 'break-word',
                      overflowWrap: 'break-word',
                      background: '#f8fafc',
                      borderRadius: 8,
                      padding: '6px 10px',
                      marginLeft: 6,
                      fontSize: 17,
                      maxHeight: 90,
                      overflowY: 'auto',
                      boxShadow: '0 1px 4px #0001',
                    }}>{msg.contenido}</span>
                    {msg.archivoHash && (
                      <a href={`https://files.lighthouse.storage/viewFile/${msg.archivoHash}`} target="_blank" rel="noopener noreferrer" style={{marginLeft:12, color:'#2563eb', fontWeight:600, textDecoration:'underline'}}>Ver archivo</a>
                    )}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {Number(msg.estado) === 1 ? (
                      <span className="activity-status status-success">confirmado</span>
                    ) : (
                      <>
                        <span className="activity-status status-pending">pendiente</span>
                        {account && (
                          <button onClick={() => confirmarMensaje(mensajes.length-1-index)} disabled={loading} style={{marginLeft:8,padding:'2px 10px',borderRadius:8,border:'none',background:'#f97416',color:'#fff',fontWeight:600,cursor:loading?'not-allowed':'pointer'}}>Confirmar</button>
                        )}
                      </>
                    )}
                    <br />
                    <span className="activity-meta">{new Date(parseInt(msg.timestamp) * 1000).toLocaleString()}</span><br />
                    <span className="activity-meta">De: {msg.remitente}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {vista === 'vision' && (
          <div style={{ maxWidth: 1100, margin: '32px auto', background: '#fff', borderRadius: 18, boxShadow: '0 2px 12px #0001', padding: '40px 40px 32px 40px', border: '1px solid #eee' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
              <span style={{ fontSize: 32, color: '#2563eb' }}>📊</span>
              <span style={{ fontWeight: 700, fontSize: 36 }}>Visión General</span>
            </div>
            <div style={{ color: '#888', fontSize: 20, marginBottom: 32 }}>Resumen visual de la actividad y salud de la red</div>
            {/* KPIs visuales */}
            <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', marginBottom: 32 }}>
              <div style={{ background: '#e9f9ef', borderRadius: 16, padding: 24, minWidth: 200, flex: 1 }}>
                <div style={{ fontSize: 32 }}>✅</div>
                <div style={{ fontWeight: 700, fontSize: 28, color: '#16a34a' }}>{confirmados}</div>
                <div style={{ color: '#222', fontWeight: 600 }}>Transacciones Exitosas</div>
              </div>
              <div style={{ background: '#fee2e2', borderRadius: 16, padding: 24, minWidth: 200, flex: 1 }}>
                <div style={{ fontSize: 32 }}>❌</div>
                <div style={{ fontWeight: 700, fontSize: 28, color: '#dc2626' }}>0</div>
                <div style={{ color: '#222', fontWeight: 600 }}>Transacciones Fallidas</div>
              </div>
              <div style={{ background: '#fef9c3', borderRadius: 16, padding: 24, minWidth: 200, flex: 1 }}>
                <div style={{ fontSize: 32 }}>🕒</div>
                <div style={{ fontWeight: 700, fontSize: 28, color: '#eab308' }}>{pendientes}</div>
                <div style={{ color: '#222', fontWeight: 600 }}>Pendientes actuales</div>
              </div>
              <div style={{ background: '#dbeafe', borderRadius: 16, padding: 24, minWidth: 200, flex: 1 }}>
                <div style={{ fontSize: 32 }}>⏱️</div>
                <div style={{ fontWeight: 700, fontSize: 28, color: '#2563eb' }}>{
                  mensajes.length > 1
                    ? ((mensajes.reduce((acc, m, i, arr) => i > 0 ? acc + (Number(m.timestamp) - Number(arr[i-1].timestamp)) : acc, 0) / (mensajes.length - 1)) / 60).toFixed(2) + ' min'
                    : 'N/A'
                }</div>
                <div style={{ color: '#222', fontWeight: 600 }}>Tiempo promedio entre registros</div>
              </div>
              <div style={{ background: '#cffafe', borderRadius: 16, padding: 24, minWidth: 200, flex: 1 }}>
                <div style={{ fontSize: 32 }}>⛽</div>
                <div style={{ fontWeight: 700, fontSize: 28, color: '#06b6d4' }}>20 Gwei</div>
                <div style={{ color: '#222', fontWeight: 600 }}>Gas promedio</div>
              </div>
              <div style={{ background: '#f3f4f6', borderRadius: 16, padding: 24, minWidth: 200, flex: 1 }}>
                <div style={{ fontSize: 32 }}>📌</div>
                <div style={{ fontWeight: 700, fontSize: 18, color: '#6b7280' }}>{
                  mensajes.length > 0
                    ? (Math.floor((Date.now()/1000 - Number(mensajes[mensajes.length-1].timestamp)))) + 's'
                    : 'N/A'
                }</div>
                <div style={{ color: '#222', fontWeight: 600 }}>Hace la última transacción</div>
              </div>
            </div>
            {/* Salud de la red */}
            <div style={{ marginTop: 24, marginBottom: 12, fontWeight: 700, fontSize: 22 }}>Salud de la Red</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 24 }}>
              <span style={{ fontSize: 32 }}>
                {pendientes === 0 ? '🟢' : pendientes < 3 ? '🟠' : '🔴'}
              </span>
              <span style={{ fontWeight: 600, fontSize: 20 }}>
                {pendientes === 0 ? 'Red saludable' : pendientes < 3 ? 'Red con leve congestión' : 'Red congestionada'}
              </span>
            </div>
            {/* Modo avanzado */}
            <details style={{ marginTop: 24 }}>
              <summary style={{ fontWeight: 700, fontSize: 18, cursor: 'pointer' }}>Modo Avanzado / Dev</summary>
              <div style={{ marginTop: 16 }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Últimos 5 registros:</div>
                <ul style={{ fontFamily: 'monospace', fontSize: 15, color: '#444' }}>
                  {[...mensajes].slice(-5).reverse().map((msg, i) => (
                    <li key={i} style={{ marginBottom: 6 }}>
                      Hash: <span style={{ color: '#2563eb' }}>{msg.transactionHash || 'N/A'}</span> | Fecha: {msg.timestamp ? new Date(parseInt(msg.timestamp) * 1000).toLocaleString() : 'N/A'}
                    </li>
                  ))}
                </ul>
              </div>
            </details>
          </div>
        )}

        {vista === 'configuracion' && (
          <div style={{ maxWidth: 700, margin: '40px auto', background: '#fff', borderRadius: 18, boxShadow: '0 2px 12px #0001', padding: '40px 40px 32px 40px', border: '1px solid #eee', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
              <svg width="32" height="32" fill="none" viewBox="0 0 24 24"><rect width="24" height="24" rx="8" fill="#f3f4f6"/><path d="M12 6v6l4 2" stroke="#2563eb" strokeWidth="2" strokeLinecap="round"/></svg>
              <span style={{ fontWeight: 700, fontSize: 32 }}>Configuración</span>
            </div>
            <div style={{ color: '#888', fontSize: 20, marginBottom: 32 }}>Ajustes y controles avanzados de la DApp</div>
            <div style={{ width: '100%', marginBottom: 24 }}>
              <div style={{ fontWeight: 600, fontSize: 20, marginBottom: 10 }}>Cuenta conectada</div>
              <div style={{ background: '#f8fafc', borderRadius: 10, padding: '14px 18px', fontSize: 18, display: 'flex', alignItems: 'center', gap: 12, border: '1px solid #e5e7eb' }}>
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="10" fill="#22c55e"/><path d="M6 10.5l2.5 2.5L14 8.5" stroke="#fff" strokeWidth="2" strokeLinecap="round"/></svg>
                <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{account || 'No conectada'}</span>
              </div>
              <button onClick={async () => {
                if (window.ethereum) {
                  try {
                    // Solicita a MetaMask abrir el panel de cuentas
                    await window.ethereum.request({ method: 'wallet_requestPermissions', params: [{ eth_accounts: {} }] });
                    // Luego solicita cuentas (esto abre el panel si no está abierto)
                    await window.ethereum.request({ method: 'eth_requestAccounts' });
                    window.location.reload();
                  } catch (err) {
                    alert('Error al cambiar de cuenta: ' + (err && err.message ? err.message : 'Desconocido'));
                  }
                }
              }} style={{ marginTop: 14, padding: '10px 24px', borderRadius: 8, background: '#2563eb', color: '#fff', fontWeight: 700, border: 'none', fontSize: 18, cursor: 'pointer', boxShadow: '0 1px 4px #0001' }}>
                Cambiar/Cargar cuenta
              </button>
            </div>
            <div style={{ width: '100%', marginBottom: 24 }}>
              <div style={{ fontWeight: 600, fontSize: 20, marginBottom: 10 }}>Red y contrato</div>
              <div style={{ background: '#f8fafc', borderRadius: 10, padding: '14px 18px', fontSize: 17, border: '1px solid #e5e7eb', marginBottom: 8 }}>
                <div><b>Red:</b> Ethereum Local/Test</div>
                <div><b>Contrato:</b> {contract ? contract._address : 'No conectado'}</div>
              </div>
              <button onClick={async () => {
                if (window.ethereum) {
                  try {
                    // Cambiar a la red de prueba de Ethereum (Rinkeby, Ropsten, etc.)
                    await window.ethereum.request({
                      method: 'wallet_switchEthereumChain',
                      params: [{ chainId: '0x4' }], // Cambiar a la red Rinkeby (ejemplo)
                    });
                  } catch (err) {
                    alert('Error al cambiar de red: ' + (err && err.message ? err.message : 'Desconocido'));
                  }
                }
              }} style={{ padding: '10px 24px', borderRadius: 8, background: '#2563eb', color: '#fff', fontWeight: 700, border: 'none', fontSize: 18, cursor: 'pointer', boxShadow: '0 1px 4px #0001' }}>
                Cambiar a Red de Prueba
              </button>
            </div>
            <div style={{ width: '100%', marginBottom: 24 }}>
              <div style={{ fontWeight: 600, fontSize: 20, marginBottom: 10 }}>Configuración de IPFS</div>
              <div style={{ background: '#f8fafc', borderRadius: 10, padding: '14px 18px', fontSize: 17, border: '1px solid #e5e7eb' }}>
                <div><b>Proveedor IPFS:</b> Infura</div>
                <div><b>API Key:</b> {process.env.REACT_APP_INFURA_API_KEY}</div>
                <div><b>Secret:</b> {process.env.REACT_APP_INFURA_SECRET}</div>
              </div>
            </div>
            <div style={{ width: '100%', marginTop: 24, textAlign: 'center', fontSize: 14, color: '#888' }}>
              <div>Desarrollado por Tu Nombre</div>
              <div>Contacto: tuemail@example.com</div>
            </div>
          </div>
        )}

      </div>
      {/* Responsive: estilos básicos */}
      <style>{`
        @media (max-width: 900px) {
          .main { padding: 0 !important; }
          .summary-cards { flex-direction: column !important; gap: 18px !important; }
          .activity-list { font-size: 15px !important; }
        }
        @media (max-width: 600px) {
          .main { padding: 0 !important; }
          .sidebar { display: none !important; }
          .dashboard-header { flex-direction: column !important; gap: 10px !important; }
          .summary-cards { flex-direction: column !important; gap: 10px !important; }
          .activity-list { font-size: 13px !important; }
          table { font-size: 13px !important; }
        }
      `}</style>
    </div>
  );
}

export default App;