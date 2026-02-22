// Content script que se ejecuta en la página de OurSofka

// Verificar que el contexto de la extensión es válido
if (!chrome.runtime?.id) {
  // Si el contexto está invalidado (por ejemplo, después de recargar la extensión),
  // no ejecutar nada y recargar la página silenciosamente
  // No ejecutar el resto del código
} else {
  let tokenAlreadySent = false;
  let tokenAlreadySaved = false;
  let userIdAlreadySaved = false;
  let monitoringInterval = null;

// Función para capturar el User ID (uid)
function captureUserId() {
  try {
    // Intentar obtener csrfId de cookies
    const uid = getCookie('csrfId');
    
    if (uid) {
      // Guardar en storage solo si no se ha guardado antes
      if (!userIdAlreadySaved) {
        try {
          chrome.storage.local.set({
            'userId': uid,
            'userIdTimestamp': Date.now()
          });
          userIdAlreadySaved = true;
        } catch (e) {
          // Ignorar si el storage no está disponible
        }
      }
      // SIEMPRE retornar el uid si existe, no solo la primera vez
      return uid;
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

// Intentar capturar el token de diferentes lugares
function captureToken(silent = false) {
  try {
    // 1. Intentar desde cookies
    const csrfToken = getCookie('csrfToken');
    
    // También intentar capturar el User ID
    captureUserId();
    
    if (csrfToken) {
      // Solo enviar mensaje al background si es la primera vez
      if (!tokenAlreadySaved) {
        try {
          chrome.runtime.sendMessage({
            type: 'TOKEN_FOUND',
            token: csrfToken
          }).catch(() => {
            // Ignorar error si el background script no está disponible
          });
        } catch (e) {
          // Ignorar errores de contexto invalidado
        }
        
        // También guardar en storage local para acceso rápido
        try {
          chrome.storage.local.set({
            'bearerToken': csrfToken,
            'tokenTimestamp': Date.now()
          });
        } catch (e) {
          // Ignorar si el storage no está disponible
        }
        
        tokenAlreadySaved = true;
      }
      
      // SI esta ventana fue abierta por otra (popup), enviar el token a la ventana padre
      if (window.opener && !window.opener.closed && !tokenAlreadySent) {
        // Obtener el User ID
        const userId = captureUserId();
        
        window.opener.postMessage({
          type: 'TOKEN_CAPTURED',
          token: csrfToken,
          userId: userId || null
        }, '*');
        
        tokenAlreadySent = true;
        
        // Mostrar notificación visual
        showSuccessNotification();
        
        // Detener monitoreo una vez que el token fue enviado
        if (monitoringInterval) {
          clearInterval(monitoringInterval);
        }
      }
      
      return csrfToken;
    }
    
    // 2. Intentar desde localStorage
    const localToken = localStorage.getItem('token') || 
                       localStorage.getItem('csrfToken') ||
                       localStorage.getItem('authToken');
    
    if (localToken && !tokenAlreadySaved) {
      try {
        chrome.storage.local.set({
          'bearerToken': localToken,
          'tokenTimestamp': Date.now()
        });
      } catch (e) {
        // Ignorar si el storage no está disponible
      }
      
      tokenAlreadySaved = true;
      
      // Enviar también si viene de localStorage
      if (window.opener && !window.opener.closed && !tokenAlreadySent) {
        const userId = captureUserId();
        
        window.opener.postMessage({
          type: 'TOKEN_CAPTURED',
          token: localToken,
          userId: userId || null
        }, '*');
        tokenAlreadySent = true;
        showSuccessNotification();
        
        // Detener monitoreo
        if (monitoringInterval) {
          clearInterval(monitoringInterval);
        }
      }
      
      return localToken;
    }
    
    return null;
  } catch (error) {
    // Si hay cualquier error (como contexto invalidado), detener el monitoreo y no hacer nada más
    if (error.message && error.message.includes('Extension context invalidated')) {
      if (monitoringInterval) {
        clearInterval(monitoringInterval);
        monitoringInterval = null;
      }
    }
    return null;
  }
}

// Mostrar notificación de éxito
function showSuccessNotification() {
  // Crear overlay
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(102, 126, 234, 0.95);
    z-index: 999999;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: Arial, sans-serif;
  `;
  
  const message = document.createElement('div');
  message.style.cssText = `
    background: white;
    padding: 40px;
    border-radius: 15px;
    text-align: center;
    box-shadow: 0 10px 40px rgba(0,0,0,0.3);
  `;
  
  message.innerHTML = `
    <div style="font-size: 60px; color: #28a745; margin-bottom: 20px;">✓</div>
    <h2 style="margin: 0 0 10px 0; color: #333;">Token Capturado</h2>
    <p style="margin: 0; color: #666;">Esta ventana se cerrará en <span id="countdown">3</span> segundos...</p>
  `;
  
  overlay.appendChild(message);
  document.body.appendChild(overlay);
  
  // Countdown
  let seconds = 3;
  const countdownEl = document.getElementById('countdown');
  const interval = setInterval(() => {
    seconds--;
    if (countdownEl) {
      countdownEl.textContent = seconds;
    }
    if (seconds <= 0) {
      clearInterval(interval);
      window.close();
    }
  }, 1000);
}

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop().split(';').shift();
  }
  return null;
}

// Capturar token cuando la página carga
if (document.readyState === 'complete') {
  captureToken();
} else {
  window.addEventListener('load', captureToken);
}

// Determinar si esta ventana es un popup (abierta desde la app)
const isPopupWindow = window.opener && !window.opener.closed;

if (isPopupWindow) {
  // Si es un popup, monitorear cada 500ms hasta encontrar el token
  monitoringInterval = setInterval(() => captureToken(true), 500);
} else {
  // Si es una pestaña normal, monitorear cada 5 minutos (solo para actualizar el token guardado)
  monitoringInterval = setInterval(() => captureToken(true), 300000); // 5 minutos = 300000ms
}

// Exponer función global para que la aplicación principal pueda obtener el token
window.getOurSofkaToken = function() {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get(['bearerToken'], (result) => {
        resolve(result.bearerToken || null);
      });
    } catch (e) {
      // Si el contexto está invalidado, resolver con null
      resolve(null);
    }
  });
};

} // Fin del bloque if (verificación de contexto válido)
