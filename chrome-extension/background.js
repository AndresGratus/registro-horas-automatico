// Background service worker para capturar cookies
chrome.cookies.onChanged.addListener((changeInfo) => {
  if (changeInfo.cookie.domain.includes('oursofka.sofka.com.co')) {
    if (changeInfo.cookie.name === 'csrfToken' && !changeInfo.removed) {
      // Guardar el token en storage
      chrome.storage.local.set({
        'bearerToken': changeInfo.cookie.value,
        'tokenTimestamp': Date.now()
      });
    }
  }
});

// Intentar obtener el token al iniciar
chrome.cookies.get({
  url: 'https://oursofka.sofka.com.co',
  name: 'csrfToken'
}, (cookie) => {
  if (cookie) {
    chrome.storage.local.set({
      'bearerToken': cookie.value,
      'tokenTimestamp': Date.now()
    });
  }
});
