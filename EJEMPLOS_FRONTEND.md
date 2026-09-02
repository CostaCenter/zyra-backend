# Ejemplos de Integración Frontend - Sistema de Acceso a Complejos

## 🎯 Casos de Uso Comunes

### 1. Login y Mostrar Complejos del Usuario

```javascript
// Login
const login = async (telefono, password) => {
  const response = await fetch('http://localhost:3000/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ telefono, password })
  });

  const data = await response.json();
  
  if (data.success) {
    // Guardar token
    localStorage.setItem('token', data.token);
    
    // Guardar usuario con sus complejos
    localStorage.setItem('user', JSON.stringify(data.user));
    
    // Mostrar complejos disponibles
    console.log('Complejos disponibles:');
    data.user.complejos.forEach(complejo => {
      console.log(`
        - ${complejo.nombre} (${complejo.ubicacion})
        - Tu rol: ${complejo.usuario_complejo.rol_en_complejo}
        - Acceso desde: ${new Date(complejo.usuario_complejo.creado_at).toLocaleDateString()}
      `);
    });
    
    return data;
  }
};
```

### 2. Selector de Complejo en el Dashboard

```javascript
// Componente React - ComplejoSelector
import React, { useState, useEffect } from 'react';

const ComplejoSelector = () => {
  const [complejos, setComplejos] = useState([]);
  const [complejoActivo, setComplejoActivo] = useState(null);

  useEffect(() => {
    // Cargar complejos del localStorage
    const user = JSON.parse(localStorage.getItem('user'));
    setComplejos(user.complejos || []);
    
    // Si solo hay un complejo, seleccionarlo automáticamente
    if (user.complejos?.length === 1) {
      setComplejoActivo(user.complejos[0]);
    }
  }, []);

  const handleSelectComplejo = (complejo) => {
    setComplejoActivo(complejo);
    localStorage.setItem('complejoActivo', JSON.stringify(complejo));
    // Recargar dashboard con el complejo seleccionado
    window.location.reload();
  };

  return (
    <div className="complejo-selector">
      <h3>Mis Complejos</h3>
      {complejos.map(complejo => (
        <div 
          key={complejo.id} 
          className={`complejo-card ${complejoActivo?.id === complejo.id ? 'active' : ''}`}
          onClick={() => handleSelectComplejo(complejo)}
        >
          <img src={complejo.photo} alt={complejo.nombre} />
          <div className="complejo-info">
            <h4>{complejo.nombre}</h4>
            <p>{complejo.ubicacion}</p>
            <span className="rol-badge">
              {complejo.usuario_complejo.rol_en_complejo}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};
```

### 3. Gestión de Usuarios con Acceso (Panel de Admin)

```javascript
// adminPanel.js
const GestionAccesos = () => {
  const [usuarios, setUsuarios] = useState([]);
  const [complejoId, setComplejoId] = useState(null);
  const [loading, setLoading] = useState(false);

  // Cargar usuarios con acceso
  const cargarUsuarios = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    
    try {
      const response = await fetch(`http://localhost:3000/api/complejos/${complejoId}/acceso`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      if (data.success) {
        setUsuarios(data.data);
      }
    } catch (error) {
      console.error('Error al cargar usuarios:', error);
    } finally {
      setLoading(false);
    }
  };

  // Otorgar acceso a nuevo usuario
  const otorgarAcceso = async (userId, rol = 'ACCESO') => {
    const token = localStorage.getItem('token');
    
    try {
      const response = await fetch(`http://localhost:3000/api/complejos/${complejoId}/acceso`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId, rol })
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert('Acceso otorgado exitosamente');
        cargarUsuarios(); // Recargar lista
      } else {
        alert(data.message);
      }
    } catch (error) {
      console.error('Error al otorgar acceso:', error);
      alert('Error al otorgar acceso');
    }
  };

  // Revocar acceso
  const revocarAcceso = async (userId) => {
    if (!confirm('¿Estás seguro de revocar el acceso a este usuario?')) {
      return;
    }
    
    const token = localStorage.getItem('token');
    
    try {
      const response = await fetch(`http://localhost:3000/api/complejos/${complejoId}/acceso/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert('Acceso revocado exitosamente');
        cargarUsuarios(); // Recargar lista
      } else {
        alert(data.message);
      }
    } catch (error) {
      console.error('Error al revocar acceso:', error);
      alert('Error al revocar acceso');
    }
  };

  useEffect(() => {
    if (complejoId) {
      cargarUsuarios();
    }
  }, [complejoId]);

  return (
    <div className="gestion-accesos">
      <h2>Gestión de Accesos</h2>
      
      {loading ? (
        <p>Cargando...</p>
      ) : (
        <div className="usuarios-list">
          {usuarios.map(usuario => (
            <div key={usuario.id} className="usuario-card">
              <img src={usuario.photo} alt={usuario.name} />
              <div className="usuario-info">
                <h4>{usuario.name || usuario.nick}</h4>
                <p>{usuario.telefono}</p>
                <span className={`rol-badge ${usuario.usuario_complejo.rol_en_complejo.toLowerCase()}`}>
                  {usuario.usuario_complejo.rol_en_complejo}
                </span>
              </div>
              
              {usuario.usuario_complejo.rol_en_complejo !== 'DUEÑO' && (
                <button 
                  onClick={() => revocarAcceso(usuario.id)}
                  className="btn-revocar"
                >
                  Revocar Acceso
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      
      <button onClick={() => {/* Modal para agregar usuario */}}>
        + Agregar Usuario
      </button>
    </div>
  );
};
```

### 4. Formulario para Invitar Usuarios

```javascript
// InvitarUsuario.jsx
const InvitarUsuario = ({ complejoId, onSuccess }) => {
  const [telefono, setTelefono] = useState('');
  const [rol, setRol] = useState('ACCESO');
  const [buscando, setBuscando] = useState(false);
  const [usuarioEncontrado, setUsuarioEncontrado] = useState(null);

  // Buscar usuario por teléfono
  const buscarUsuario = async () => {
    setBuscando(true);
    const token = localStorage.getItem('token');
    
    try {
      // Nota: Necesitarás crear este endpoint o usar el existente
      const response = await fetch(`http://localhost:3000/api/usuarios/buscar?telefono=${telefono}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (data.success && data.user) {
        setUsuarioEncontrado(data.user);
      } else {
        alert('Usuario no encontrado');
      }
    } catch (error) {
      console.error('Error al buscar usuario:', error);
      alert('Error al buscar usuario');
    } finally {
      setBuscando(false);
    }
  };

  // Otorgar acceso
  const invitarUsuario = async () => {
    if (!usuarioEncontrado) return;
    
    const token = localStorage.getItem('token');
    
    try {
      const response = await fetch(`http://localhost:3000/api/complejos/${complejoId}/acceso`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: usuarioEncontrado.id,
          rol: rol
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert(`Usuario invitado como ${rol}`);
        setTelefono('');
        setUsuarioEncontrado(null);
        onSuccess?.();
      } else {
        alert(data.message);
      }
    } catch (error) {
      console.error('Error al invitar usuario:', error);
      alert('Error al invitar usuario');
    }
  };

  return (
    <div className="invitar-usuario-form">
      <h3>Invitar Usuario</h3>
      
      <div className="form-group">
        <label>Teléfono del usuario:</label>
        <input
          type="tel"
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          placeholder="3001234567"
        />
        <button onClick={buscarUsuario} disabled={buscando}>
          {buscando ? 'Buscando...' : 'Buscar'}
        </button>
      </div>

      {usuarioEncontrado && (
        <div className="usuario-encontrado">
          <img src={usuarioEncontrado.photo} alt={usuarioEncontrado.name} />
          <div>
            <h4>{usuarioEncontrado.name || usuarioEncontrado.nick}</h4>
            <p>{usuarioEncontrado.telefono}</p>
          </div>

          <div className="form-group">
            <label>Rol a asignar:</label>
            <select value={rol} onChange={(e) => setRol(e.target.value)}>
              <option value="ACCESO">Acceso</option>
              <option value="EMPLEADO">Empleado</option>
              <option value="ADMIN">Administrador</option>
            </select>
          </div>

          <button onClick={invitarUsuario} className="btn-primary">
            Invitar como {rol}
          </button>
        </div>
      )}
    </div>
  );
};
```

### 5. Verificar Permisos en el Frontend

```javascript
// utils/permissions.js

// Obtener rol del usuario en el complejo activo
export const getComplejoRol = () => {
  const complejoActivo = JSON.parse(localStorage.getItem('complejoActivo'));
  return complejoActivo?.usuario_complejo?.rol_en_complejo || null;
};

// Verificar si el usuario puede gestionar accesos
export const puedeGestionarAccesos = () => {
  const rol = getComplejoRol();
  return ['DUEÑO', 'ADMIN'].includes(rol);
};

// Verificar si el usuario puede modificar configuración
export const puedeModificarConfiguracion = () => {
  const rol = getComplejoRol();
  return ['DUEÑO', 'ADMIN'].includes(rol);
};

// Verificar si el usuario solo tiene acceso de lectura
export const soloLectura = () => {
  const rol = getComplejoRol();
  return ['ACCESO', 'EMPLEADO'].includes(rol);
};

// Componente para condicionar renderizado
export const RequiereRol = ({ roles, children, fallback = null }) => {
  const rol = getComplejoRol();
  
  if (roles.includes(rol)) {
    return children;
  }
  
  return fallback;
};

// Uso en componentes
// <RequiereRol roles={['DUEÑO', 'ADMIN']}>
//   <button>Configuración</button>
// </RequiereRol>
```

### 6. Hooks Personalizados para React

```javascript
// hooks/useComplejoAcceso.js
import { useState, useEffect } from 'react';

export const useComplejoAcceso = (complejoId) => {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const cargarUsuarios = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    
    try {
      const response = await fetch(`http://localhost:3000/api/complejos/${complejoId}/acceso`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const data = await response.json();
      
      if (data.success) {
        setUsuarios(data.data);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (complejoId) {
      cargarUsuarios();
    }
  }, [complejoId]);

  return { usuarios, loading, error, reload: cargarUsuarios };
};

// hooks/useUserComplejos.js
export const useUserComplejos = () => {
  const [complejos, setComplejos] = useState([]);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user'));
    setComplejos(user?.complejos || []);
  }, []);

  return complejos;
};
```

## 🎨 Estilos Sugeridos (CSS)

```css
/* Selector de Complejo */
.complejo-selector {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 1rem;
  padding: 1rem;
}

.complejo-card {
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  padding: 1rem;
  cursor: pointer;
  transition: all 0.3s ease;
}

.complejo-card:hover {
  border-color: #4CAF50;
  box-shadow: 0 4px 8px rgba(0,0,0,0.1);
}

.complejo-card.active {
  border-color: #4CAF50;
  background-color: #f1f8f4;
}

.rol-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: 600;
}

.rol-badge.dueño {
  background-color: #FFD700;
  color: #000;
}

.rol-badge.admin {
  background-color: #FF6B6B;
  color: #fff;
}

.rol-badge.acceso {
  background-color: #4ECDC4;
  color: #fff;
}

.rol-badge.empleado {
  background-color: #95E1D3;
  color: #000;
}

/* Gestión de usuarios */
.usuarios-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.usuario-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
}

.usuario-card img {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  object-fit: cover;
}

.btn-revocar {
  margin-left: auto;
  padding: 0.5rem 1rem;
  background-color: #f44336;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.btn-revocar:hover {
  background-color: #d32f2f;
}
```

## 📝 Notas Importantes

1. **Token de Autenticación**: Todos los endpoints requieren el header `Authorization: Bearer {token}`

2. **Manejo de Errores**: Siempre verificar `data.success` antes de procesar la respuesta

3. **LocalStorage**: Guardar el complejo activo para mantener el contexto entre páginas

4. **Permisos**: Verificar el rol antes de mostrar opciones de administración

5. **UX**: Mostrar feedback visual claro cuando se otorgan/revocan accesos

---

**Para más información, consulta:**
- `ACCESO_COMPLEJOS.md` - Documentación completa del sistema
- `CAMBIOS_REALIZADOS.md` - Lista de todos los cambios realizados
