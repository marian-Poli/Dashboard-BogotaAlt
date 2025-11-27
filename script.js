/**
 * SOCIAL MEDIA ANALYTICS DASHBOARD - BOGOTA.ATL
 * Actualizado para el nuevo archivo de Google Sheets
 */

// --- CONFIGURACIÓN ---
// Nuevo ID extraído de tu enlace
const SPREADSHEET_ID = '1KUaE83XvSL1OkmzN7wprIpIV3H-lLYtDujK51zGTVmM';

// IMPORTANTE: Estos nombres deben ser IDÉNTICOS a las pestañas de tu Google Sheet.
// Si tu nueva hoja tiene nombres diferentes (ej: "Hoja 1"), cámbialos aquí.
const SHEET_NAMES = ['Bogota.Atl', 'Los_delaU', 'Grupo_Niche_Poli'];

// Variables globales
const dashboardData = []; 
const allAnalytics = {};  
let sheetsProcessed = 0;

// Cargar Google Charts
google.charts.load('current', { 'packages': ['corechart'] });
google.charts.setOnLoadCallback(initDashboard);

// Elementos del DOM
const app = document.getElementById('app');
const loader = document.getElementById('loader');
const modal = document.getElementById('post-detail-modal');

// --- TOOLTIPS (Optimizado para Web/Móvil) ---
document.addEventListener('mouseover', function(e) {
    const item = e.target.closest('.metric-item');
    if (!item || item.classList.contains('tooltip-active')) return;

    item.classList.add('tooltip-active');
    item.onmouseleave = () => item.classList.remove('tooltip-active');
});

// --- LÓGICA DE CONEXIÓN ---
function initDashboard() {
    if (!loader || !app) return console.error("Error: Elementos del DOM no encontrados");
    
    loader.style.display = 'flex';
    app.innerHTML = '';
    sheetsProcessed = 0; 
    dashboardData.length = 0; 

    SHEET_NAMES.forEach(sheetName => {
        // Codificamos la consulta para evitar errores de caracteres
        const queryString = encodeURIComponent('SELECT A, B, C');
        
        // Construcción segura de la URL para la API de Google
        const apiURL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?sheet=${sheetName}&headers=1&tq=${queryString}`;
        
        const query = new google.visualization.Query(apiURL);
        query.send(response => handleQueryResponse(response, sheetName));
    });
}

function handleQueryResponse(response, sheetName) {
    sheetsProcessed++;

    if (response.isError()) {
        console.warn(`Aviso: No se pudo leer la hoja "${sheetName}". Verifica que el nombre sea exacto.`);
        // No bloqueamos el resto si una falla
    } else {
        const dataTable = response.getDataTable();
        const rows = [];
        const numRows = dataTable.getNumberOfRows();
        
        for (let i = 0; i < numRows; i++) {
            const fecha = dataTable.getFormattedValue(i, 0); 
            const likes = dataTable.getValue(i, 1);
            const url = dataTable.getValue(i, 2);

            // Verificamos que la fila tenga fecha y likes válidos
            if (fecha && likes !== null && !isNaN(likes)) {
                rows.push({ fecha: fecha, likes: Number(likes), url: url || '#' });
            }
        }

        if (rows.length > 0) {
            const analytics = calculateMetrics(rows);
            dashboardData.push({ name: sheetName, metrics: analytics });
            allAnalytics[sheetName] = analytics;
        }
    }

    // Renderizar cuando terminen todos los intentos
    if (sheetsProcessed === SHEET_NAMES.length) {
        renderDashboard();
    }
}

function renderDashboard() {
    loader.style.display = 'none'; 
    
    if (dashboardData.length === 0) {
         showError("No se encontraron datos", "No pudimos leer ninguna hoja. <br>1. Revisa que las pestañas del Excel se llamen: " + SHEET_NAMES.join(', ') + ".<br>2. Asegúrate de que el archivo tenga acceso 'Cualquiera con el enlace'.");
         return;
    }

    // Ordenar: El que tenga más 'Likes Reconocidos' va primero (Ganador)
    dashboardData.sort((a, b) => b.metrics.totalRecognized - a.metrics.totalRecognized);
    
    dashboardData.forEach((data, index) => {
        const isWinner = index === 0;
        renderCard(data.name, data.metrics, isWinner);
    });
}

// --- CÁLCULOS MATEMÁTICOS (Estadística) ---
function calculateMetrics(data) {
    const likesArray = data.map(d => d.likes);
    const n = likesArray.length;
    
    const totalLikes = likesArray.reduce((a, b) => a + b, 0);
    const average = n > 0 ? totalLikes / n : 0;
    
    const variance = n > 0 ? likesArray.reduce((acc, val) => acc + Math.pow(val - average, 2), 0) / n : 0;
    const stdDev = Math.sqrt(variance);
    
    // Regla: Tope = Promedio + Desviación Estándar
    const maxAllowed = average + stdDev;
    let totalRecognized = 0;
    
    const processedData = data.map(item => {
        const isCapped = item.likes > maxAllowed;
        const recognizedValue = isCapped ? maxAllowed : item.likes;
        totalRecognized += recognizedValue;
        
        return {
            ...item,
            recognized: recognizedValue,
            isCapped: isCapped,
            lost: isCapped ? item.likes - maxAllowed : 0
        };
    });

    return { totalLikes, average, stdDev, maxAllowed, totalRecognized, posts: processedData };
}

// --- RENDERIZADO VISUAL ---
function renderCard(name, metrics, isWinner) {
    const card = document.createElement('article');
    card.className = `account-card ${isWinner ? 'winner-card' : ''}`;
    
    const fmtNum = (n) => new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(n);

    // Textos de ayuda
    const tRecognized = "Total válido ajustando los virales atípicos";
    const tTotal = "Total real sin ajustes";
    const tAvg = "Promedio de likes por post";
    const tMax = "Tope máximo permitido (Prom + Desv)";

    card.innerHTML = `
        <div class="card-header">
            <div class="account-name">${name} ${isWinner ? '<i class="fa-solid fa-trophy" style="color: var(--warning); margin-left: 5px;"></i>' : ''}</div>
            <i class="fa-solid fa-chart-bar account-icon"></i>
        </div>

        <div class="metrics-grid">
            <div class="metric-item full-width" data-tooltip="${tRecognized}">
                <div>
                    <span class="metric-label">Likes Reconocidos</span>
                    <span class="metric-value text-success">${fmtNum(metrics.totalRecognized)}</span>
                </div>
                <div class="metric-icon-box icon-recognized"><i class="fa-solid fa-heart-circle-check"></i></div>
            </div>

            <div class="metric-item" data-tooltip="${tTotal}">
                <div class="metric-icon-box icon-total"><i class="fa-solid fa-heart"></i></div>
                <span class="metric-value">${fmtNum(metrics.totalLikes)}</span>
                <span class="metric-label">Total Real</span>
            </div>
            
            <div class="metric-item" data-tooltip="${tAvg}">
                <div class="metric-icon-box icon-average"><i class="fa-solid fa-calculator"></i></div>
                <span class="metric-value text-purple">${fmtNum(metrics.average)}</span>
                <span class="metric-label">Promedio</span>
            </div>

            <div class="metric-item full-width" data-tooltip="${tMax}">
                <div>
                    <span class="metric-label">Tope Máximo</span>
                    <span class="metric-value text-warning">${fmtNum(metrics.maxAllowed)}</span>
                </div>
                <div class="metric-icon-box icon-max"><i class="fa-solid fa-stop-circle"></i></div>
            </div>
        </div>

        <button class="detail-button" onclick="showModal('${name}')">
            Ver Detalles <i class="fa-solid fa-table-list"></i>
        </button>
    `;
    app.appendChild(card);
}

// --- VENTANA MODAL ---
function showModal(sheetName) {
    const data = allAnalytics[sheetName];
    if (!data) return;

    document.getElementById('modal-title').textContent = `Detalle: ${sheetName}`;
    const modalBody = document.getElementById('modal-body');
    
    const fmtNum = (n) => new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(n);
    const fmtDec = (n) => new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 }).format(n);

    modalBody.innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>Fecha</th>
                    <th>Likes</th>
                    <th>Válidos</th>
                    <th>Excedente</th>
                    <th>Ver</th>
                </tr>
            </thead>
            <tbody>
                ${data.posts.map(post => `
                    <tr>
                        <td>${post.fecha}</td>
                        <td class="text-purple">${fmtNum(post.likes)}</td>
                        <td class="${post.isCapped ? 'text-warning' : 'text-success'}">
                            ${fmtDec(post.recognized)}
                        </td>
                        <td class="text-danger">
                            ${post.lost > 0 ? '-' + fmtDec(post.lost) : ''}
                        </td>
                        <td>
                            <a href="${post.url}" target="_blank" class="link-icon">
                                <i class="fa-solid fa-arrow-up-right-from-square"></i>
                            </a>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;

    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('is-open'), 10);
}

function closeModal() {
    modal.classList.remove('is-open');
    setTimeout(() => modal.style.display = 'none', 300);
}

function showError(title, msg) {
    loader.style.display = 'flex'; 
    loader.innerHTML = `
        <div style="text-align: center; color: var(--danger); padding: 20px;">
            <i class="fa-solid fa-triangle-exclamation" style="font-size: 3rem; margin-bottom: 1rem;"></i>
            <h3>${title}</h3>
            <p>${msg}</p>
        </div>
    `;
}