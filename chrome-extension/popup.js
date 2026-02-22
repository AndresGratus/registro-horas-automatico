const statusEl = document.getElementById('status');
const tokenDisplayEl = document.getElementById('tokenDisplay');
const tokenValueEl = document.getElementById('tokenValue');
const userIdDisplayEl = document.getElementById('userIdDisplay');
const userIdValueEl = document.getElementById('userIdValue');
const refreshBtn = document.getElementById('refreshBtn');
const copyBtn = document.getElementById('copyBtn');
const copyUserIdBtn = document.getElementById('copyUserIdBtn');

let currentToken = null;
let currentUserId = null;

// Función para actualizar la UI con el token y user ID
function updateUI(token, userId) {
  if (token) {
    currentToken = token;
    statusEl.className = 'status success';
    statusEl.textContent = '✓ Token capturado exitosamente';
    tokenDisplayEl.style.display = 'block';
    tokenValueEl.textContent = token;
    copyBtn.style.display = 'block';
  } else {
    statusEl.className = 'status error';
    statusEl.textContent = '✗ No se encontró el token. Asegúrate de iniciar sesión en OurSofka.';
    tokenDisplayEl.style.display = 'none';
    copyBtn.style.display = 'none';
  }
  
  if (userId) {
    currentUserId = userId;
    userIdDisplayEl.style.display = 'block';
    userIdValueEl.textContent = userId;
    copyUserIdBtn.style.display = 'block';
    if (token) {
      statusEl.textContent = '✓ Token y User ID capturados';
    }
  } else {
    userIdDisplayEl.style.display = 'none';
    copyUserIdBtn.style.display = 'none';
  }
}

// Función para obtener el token y user ID
async function getData() {
  // Intentar desde storage
  chrome.storage.local.get(['bearerToken', 'tokenTimestamp', 'userId', 'userIdTimestamp'], (result) => {
    if (result.bearerToken) {
      const age = Date.now() - (result.tokenTimestamp || 0);
      const ageMinutes = Math.floor(age / 60000);
      
      updateUI(result.bearerToken, result.userId || null);
      
      if (ageMinutes > 0) {
        statusEl.textContent += ` (capturado hace ${ageMinutes} min)`;
      }
    } else {
      // Intentar obtener directamente de las cookies
      chrome.cookies.get({
        url: 'https://oursofka.sofka.com.co',
        name: 'csrfToken'
      }, (cookie) => {
        if (cookie) {
          updateUI(cookie.value, result.userId || null);
          // Guardar en storage
          chrome.storage.local.set({
            'bearerToken': cookie.value,
            'tokenTimestamp': Date.now()
          });
        } else {
          updateUI(null, result.userId || null);
        }
      });
    }
  });
}

// Botón de refrescar
refreshBtn.addEventListener('click', () => {
  refreshBtn.disabled = true;
  refreshBtn.textContent = 'Actualizando...';
  
  // Intentar obtener directamente de las cookies
  chrome.cookies.get({
    url: 'https://oursofka.sofka.com.co',
    name: 'csrfToken'
  }, (cookie) => {
    chrome.storage.local.get(['userId'], (result) => {
      if (cookie) {
        updateUI(cookie.value, result.userId || null);
        chrome.storage.local.set({
          'bearerToken': cookie.value,
          'tokenTimestamp': Date.now()
        });
      } else {
        updateUI(null, result.userId || null);
      }
      
      refreshBtn.disabled = false;
      refreshBtn.textContent = 'Actualizar Token';
    });
  });
});

// Botón de copiar token
copyBtn.addEventListener('click', () => {
  if (currentToken) {
    // Agregar el prefijo "Bearer " al copiar
    const tokenWithBearer = `Bearer ${currentToken}`;
    navigator.clipboard.writeText(tokenWithBearer).then(() => {
      const originalText = copyBtn.textContent;
      copyBtn.textContent = '✓ Copiado con Bearer!';
      setTimeout(() => {
        copyBtn.textContent = originalText;
      }, 2000);
    });
  }
});

// Botón de copiar User ID
copyUserIdBtn.addEventListener('click', () => {
  if (currentUserId) {
    navigator.clipboard.writeText(currentUserId).then(() => {
      const originalText = copyUserIdBtn.textContent;
      copyUserIdBtn.textContent = '✓ Copiado!';
      setTimeout(() => {
        copyUserIdBtn.textContent = originalText;
      }, 2000);
    });
  }
});

// Cargar datos al abrir el popup
getData();
