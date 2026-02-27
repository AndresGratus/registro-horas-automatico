// Estado global de la aplicación
let csvData = [];
let processedData = [];
let bearerToken = '';
let userId = '';
let projectId = '8f85a7f9-bfd1-4c2d-b8e7-85bb9b2d3944'; // Diners Blu 2.0 por defecto

// Referencias a elementos del DOM
const csvFileInput = document.getElementById('csvFile');
const fileNameDisplay = document.getElementById('fileName');
const fileText = document.getElementById('fileText');
const userIdInput = document.getElementById('userId');
const projectIdInput = document.getElementById('projectId');
const bearerTokenInput = document.getElementById('bearerToken');
const getTokenBtn = document.getElementById('getTokenBtn');
const processBtn = document.getElementById('processBtn');
const progressContainer = document.getElementById('progressContainer');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const results = document.getElementById('results');
const totalRecordsEl = document.getElementById('totalRecords');
const successRecordsEl = document.getElementById('successRecords');
const errorRecordsEl = document.getElementById('errorRecords');
const errorList = document.getElementById('errorList');
const tokenStatus = document.getElementById('tokenStatus');

// Variable para la ventana popup
let popupWindow = null;

// Establecer valor por defecto del Project ID al cargar
window.addEventListener('DOMContentLoaded', function() {
    if (projectIdInput) {
        projectIdInput.value = projectId;
        projectIdInput.placeholder = 'ID del proyecto (Diners Blu 2.0)';
    }
});

// ========== PASO 1: CARGA DEL CSV ==========

csvFileInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        fileNameDisplay.textContent = `Archivo seleccionado: ${file.name}`;
        fileText.textContent = file.name;
        loadCSV(file);
    }
});

function loadCSV(file) {
    const reader = new FileReader();
    
    reader.onload = function(e) {
        const content = e.target.result;
        parseCSV(content);
    };
    
    reader.onerror = function() {
        alert('Error al leer el archivo CSV');
    };
    
    reader.readAsText(file);
}

function parseCSV(content) {
    const lines = content.split('\n').filter(line => line.trim() !== '');
    
    if (lines.length === 0) {
        alert('El archivo CSV está vacío');
        return;
    }
    
    // Obtener headers
    const headers = lines[0].split(',').map(h => h.trim());
    
    // Validar headers requeridos
    const requiredHeaders = ['minutes', 'date', 'type', 'comment'];
    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
    
    if (missingHeaders.length > 0) {
        alert(`Faltan las siguientes columnas en el CSV: ${missingHeaders.join(', ')}`);
        return;
    }
    
    // Parsear filas
    csvData = [];
    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        const row = {};
        
        headers.forEach((header, index) => {
            row[header] = values[index] || '';
        });
        
        csvData.push(row);
    }
    
    updateProcessButton();
}

// Parser mejorado para manejar comas dentro de comillas
function parseCSVLine(line) {
    const values = [];
    let currentValue = '';
    let insideQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            insideQuotes = !insideQuotes;
        } else if (char === ',' && !insideQuotes) {
            values.push(currentValue.trim());
            currentValue = '';
        } else {
            currentValue += char;
        }
    }
    
    values.push(currentValue.trim());
    return values;
}

// ========== PASO 2: OBTENCIÓN DEL TOKEN ==========

// Escuchar mensajes desde la ventana popup
window.addEventListener('message', function(event) {
    // Verificar el origen del mensaje por seguridad (opcional pero recomendado)
    // if (event.origin !== "https://oursofka.sofka.com.co") return;
    
    if (event.data.type === 'TOKEN_CAPTURED' && event.data.token) {
        // Limpiar el token (remover "Bearer " si viene con ese prefijo)
        let cleanToken = event.data.token.trim();
        if (cleanToken.startsWith('Bearer ')) {
            cleanToken = cleanToken.substring(7);
        }
        
        bearerToken = cleanToken;
        bearerTokenInput.value = cleanToken;
        
        // Si también viene el User ID, llenarlo automáticamente
        if (event.data.userId) {
            userId = event.data.userId;
            userIdInput.value = event.data.userId;
        }
        
        tokenStatus.innerHTML = '<span style="color: #28a745;">✓ Token capturado exitosamente! ' + 
            (event.data.userId ? 'User ID también capturado. ' : '') + 
            'La ventana se cerrará automáticamente...</span>';
        updateProcessButton();
        
        // No necesitamos cerrar manualmente, el script inyectado lo hará
    }
});

getTokenBtn.addEventListener('click', async function() {
    getTokenBtn.disabled = true;
    getTokenBtn.textContent = 'Abriendo ventana de login...';
    tokenStatus.innerHTML = '<span style="color: #17a2b8;">🔓 Abriendo OurSofka...</span>';
    
    try {
        // Abrir ventana popup con OurSofka
        const width = 600;
        const height = 700;
        const left = (screen.width / 2) - (width / 2);
        const top = (screen.height / 2) - (height / 2);
        
        popupWindow = window.open(
            'https://oursofka.sofka.com.co',
            'OurSofka Login',
            `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
        );
        
        if (!popupWindow) {
            throw new Error('No se pudo abrir la ventana popup. Verifica que los popups no estén bloqueados.');
        }
        
        tokenStatus.innerHTML = `
            <div style="color: #17a2b8; line-height: 1.6;">
                <strong>📋 Instrucciones:</strong><br>
                1. Inicia sesión en la ventana que se abrió<br>
                2. La extensión capturará el token automáticamente<br>
                3. La ventana se cerrará sola en 3 segundos<br>
                <small style="color: #6c757d;">Si ya iniciaste sesión antes, el token se capturará inmediatamente</small>
            </div>
        `;
        
        // Monitorear si la ventana fue cerrada manualmente
        const popupChecker = setInterval(() => {
            if (popupWindow.closed) {
                clearInterval(popupChecker);
                if (!bearerToken) {
                    tokenStatus.innerHTML = '<span style="color: #ffc107;">⚠ Ventana cerrada sin capturar token. Asegúrate de tener la extensión instalada o pega el token manualmente.</span>';
                }
                getTokenBtn.disabled = false;
                getTokenBtn.textContent = 'Capturar Token (Ventana Popup)';
            }
        }, 1000);
        
    } catch (error) {
        console.error('Error al abrir ventana popup:', error);
        tokenStatus.innerHTML = `<span style="color: #dc3545;">✗ Error: ${error.message}</span>`;
        getTokenBtn.disabled = false;
        getTokenBtn.textContent = 'Capturar Token (Ventana Popup)';
    }
});

function getCookieFromPopup(popup, name) {
    try {
        const value = `; ${popup.document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) {
            return parts.pop().split(';').shift();
        }
    } catch (e) {
        // Error de CORS esperado
    }
    return null;
}

function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
        return parts.pop().split(';').shift();
    }
    return null;
}

// ========== PASO 3: TRANSFORMACIÓN DE DATOS ==========

function transformData() {
    processedData = csvData.map((row, index) => {
        try {
            return transformRow(row);
        } catch (error) {
            return null;
        }
    }).filter(item => item !== null);
    
    return processedData;
}

function transformRow(row) {
    const data = {
        date: convertDateToTimestamp(row.date),
        idProject: projectId,
        hoursType: '',
        hours: '0',
        minutes: '0',
        description: ''
    };
    
    // Transformación especial para HoraExtra
    if (row.type === 'HoraExtra') {
        data.hoursType = 'OTRA';
        
        // Verificar si el comment tiene formato especial: 08:00-11:00/descripción
        const horaExtraMatch = row.comment.match(/^(\d{2}:\d{2})-(\d{2}:\d{2})\/(.+)$/);
        
        if (horaExtraMatch) {
            const [, startTime, endTime, description] = horaExtraMatch;
            const { hours, minutes } = calculateTimeDifference(startTime, endTime);
            
            data.hours = hours.toString();
            data.minutes = minutes.toString();
            data.description = description.trim();
        } else {
            // Si no tiene el formato especial, usar minutes y comment normal
            const { hours, minutes } = convertMinutesToHoursAndMinutes(parseInt(row.minutes) || 0);
            data.hours = hours.toString();
            data.minutes = minutes.toString();
            data.description = row.comment || '';
        }
    } else {
        // Tipo normal (no HoraExtra)
        data.hoursType = 'FACTURABLE';
        const { hours, minutes } = convertMinutesToHoursAndMinutes(parseInt(row.minutes) || 0);
        data.hours = hours.toString();
        data.minutes = minutes.toString();
        data.description = row.comment || '';
    }
    
    return data;
}

// Convertir minutos totales a horas y minutos
function convertMinutesToHoursAndMinutes(totalMinutes) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return { hours, minutes };
}

// Calcular diferencia entre dos horas (formato HH:MM)
function calculateTimeDifference(startTime, endTime) {
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);
    
    const startTotalMinutes = startHour * 60 + startMinute;
    const endTotalMinutes = endHour * 60 + endMinute;
    
    let diffMinutes = endTotalMinutes - startTotalMinutes;
    
    // Manejar caso donde endTime es menor que startTime (cruce de medianoche)
    if (diffMinutes < 0) {
        diffMinutes += 24 * 60;
    }
    
    return convertMinutesToHoursAndMinutes(diffMinutes);
}

// Convertir fecha a timestamp Unix en milisegundos
function convertDateToTimestamp(dateString) {
    // Intentar parsear la fecha (puede venir en diferentes formatos)
    let date;
    
    // Si ya es un timestamp
    if (!isNaN(dateString) && dateString.length > 10) {
        return parseInt(dateString);
    }
    
    // Si es formato YYYY-MM-DD (ISO), parsearlo correctamente evitando problemas de zona horaria
    if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const [year, month, day] = dateString.split('-').map(Number);
        // Usar mediodía (12:00) en hora local para evitar problemas de zona horaria
        date = new Date(year, month - 1, day, 12, 0, 0);
        return date.getTime();
    }
    
    // Si es formato DD/MM/YYYY
    if (dateString.includes('/')) {
        const parts = dateString.split('/');
        if (parts.length === 3) {
            // Asumiendo DD/MM/YYYY
            const day = parseInt(parts[0]);
            const month = parseInt(parts[1]);
            const year = parseInt(parts[2]);
            // Usar mediodía (12:00) en hora local
            date = new Date(year, month - 1, day, 12, 0, 0);
            return date.getTime();
        }
    }
    
    // Fallback: intentar parsear como venga, pero agregar hora del mediodía
    date = new Date(dateString);
    if (!isNaN(date.getTime())) {
        // Ajustar a mediodía del día en hora local
        date.setHours(12, 0, 0, 0);
        return date.getTime();
    }
    
    // Si todo falla, retornar timestamp actual
    return Date.now();
}

// ========== PASO 4: EJECUCIÓN DE POST SECUENCIALES ==========

async function executeSequentialPosts() {
    const totalRecords = processedData.length;
    let successCount = 0;
    let errorCount = 0;
    const errors = [];
    
    progressContainer.style.display = 'block';
    results.style.display = 'none';
    
    for (let i = 0; i < processedData.length; i++) {
        const record = processedData[i];
        const progress = Math.round(((i + 1) / totalRecords) * 100);
        
        updateProgress(progress, `Procesando ${i + 1} de ${totalRecords}`);
        
        try {
            await registerWorkDone(record);
            successCount++;
        } catch (error) {
            errorCount++;
            errors.push({
                index: i + 1,
                record: record,
                error: error.message
            });
        }
        
        // Pequeña pausa entre requests para no saturar la API
        await sleep(100);
    }
    
    // Mostrar resultados
    displayResults(totalRecords, successCount, errorCount, errors);
}

async function registerWorkDone(data) {
    const url = 'https://cloud-run-oursofka-backend-prod-central-001-krm2f3rn4a-uc.a.run.app/workdone/register';
    
    const headers = {
        'Authorization': `Bearer ${bearerToken}`,
        'Content-Type': 'application/json',
        'uid': userId,
        'ip-address': '127.0.0.1', // Se puede obtener dinámicamente si es necesario
        'origin': 'https://oursofka.sofka.com.co'
    };
    
    const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(data)
    });
    
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    return await response.json();
}

// ========== UTILIDADES ==========

function updateProgress(percentage, text) {
    progressFill.style.width = `${percentage}%`;
    progressFill.textContent = `${percentage}%`;
    progressText.textContent = text;
}

function displayResults(total, success, errors, errorDetails) {
    totalRecordsEl.textContent = total;
    successRecordsEl.textContent = success;
    errorRecordsEl.textContent = errors;
    
    errorList.innerHTML = '';
    
    if (errorDetails.length > 0) {
        const errorTitle = document.createElement('div');
        errorTitle.style.fontWeight = 'bold';
        errorTitle.style.marginBottom = '10px';
        errorTitle.textContent = 'Errores detallados:';
        errorList.appendChild(errorTitle);
        
        errorDetails.forEach(error => {
            const errorItem = document.createElement('div');
            errorItem.className = 'result-item error';
            errorItem.innerHTML = `
                <strong>Registro ${error.index}</strong><br>
                <small>Descripción: ${error.record.description}</small><br>
                <small style="color: #dc3545;">Error: ${error.error}</small>
            `;
            errorList.appendChild(errorItem);
        });
    }
    
    results.style.display = 'block';
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function updateProcessButton() {
    const hasCSV = csvData.length > 0;
    const hasToken = bearerTokenInput.value.trim() !== '';
    const hasUserId = userIdInput.value.trim() !== '';
    const hasProjectId = projectIdInput.value.trim() !== '';
    
    processBtn.disabled = !(hasCSV && hasToken && hasUserId && hasProjectId);
}

// ========== EVENT LISTENERS ==========

bearerTokenInput.addEventListener('input', function() {
    // Limpiar el token (remover "Bearer " si el usuario lo pega)
    let value = this.value.trim();
    if (value.startsWith('Bearer ')) {
        value = value.substring(7).trim();
        this.value = value;
    }
    bearerToken = value;
    updateProcessButton();
});

userIdInput.addEventListener('input', function() {
    userId = this.value.trim();
    updateProcessButton();
});

projectIdInput.addEventListener('input', function() {
    projectId = this.value.trim();
    updateProcessButton();
});

processBtn.addEventListener('click', async function() {
    if (!confirm(`¿Estás seguro de procesar ${csvData.length} registros?`)) {
        return;
    }
    
    processBtn.disabled = true;
    processBtn.textContent = 'Procesando...';
    
    try {
        // Actualizar valores
        bearerToken = bearerTokenInput.value.trim();
        userId = userIdInput.value.trim();
        projectId = projectIdInput.value.trim();
        
        // Transformar datos
        transformData();
        
        // Ejecutar POST secuenciales
        await executeSequentialPosts();
        
    } catch (error) {
        alert(`Error: ${error.message}`);
    } finally {
        processBtn.disabled = false;
        processBtn.textContent = 'Iniciar Proceso';
    }
});
