// ============================================
// MÉTODO SÍMPLEX - PIL ANDINA 2026
// Implementación completa con método Gran M
// ============================================

// Datos del problema (Variables Let para permitir cambios de escenario)
let PROBLEMA = {
    // Función objetivo: Max Z = 850x1 + 1200x2 + 920x3 + 1350x4 + 880x5 + 1280x6
    c: [850, 1200, 920, 1350, 880, 1280],
    nombresVars: ['x₁', 'x₂', 'x₃', 'x₄', 'x₅', 'x₆'],

    // Restricciones (matriz A, vector b, tipo)
    A: [
        [1, 1, 0, 0, 0, 0],   // R1: Cap El Alto <= 400
        [0, 0, 1, 1, 0, 0],   // R2: Cap Cochabamba <= 1000
        [0, 0, 0, 0, 1, 1],   // R3: Cap Santa Cruz <= 600
        [1, 0, 1, 0, 1, 0],   // R4: Leche cruda <= 1500
        [1, 0, 1, 0, 1, 0],   // R5: Demanda leche >= 900
        [0, 1, 0, 1, 0, 1],   // R6: Demanda yogur >= 400
    ],
    b: [400, 1000, 600, 1500, 900, 400],
    tipos: ['<=', '<=', '<=', '<=', '>=', '>='],
    nombresRestricciones: [
        'Cap. El Alto', 'Cap. Cochabamba', 'Cap. Santa Cruz',
        'Leche cruda', 'Dem. leche', 'Dem. yogur'
    ]
};

const ESCENARIOS = {
    actual: {
        b: [400, 1000, 600, 1500, 900, 400],
        c: [850, 1200, 920, 1350, 880, 1280]
    },
    recuperacion: { // El Alto al 70% (aprox 1100), mejores ganancias
        b: [1100, 1000, 600, 2000, 900, 400],
        c: [950, 1300, 920, 1350, 880, 1280]
    },
    peor: { // Bloqueos totales El Alto (50 ton)
        b: [50, 1200, 600, 1500, 900, 400],
        c: [800, 1100, 950, 1400, 900, 1300]
    }
};

// Variables de la tabla Símplex expandida
// Orden: x1..x6, s1..s6, e5, e6, a1, a2 (holguras, exceso, artificiales)
let tabla = [];
let variablesBase = [];
let nombresColumnas = [];
let iteraciones = [];
let iteracionActual = -1;
const M = 10000; // Método Gran M

// Inicializar tabla del Símplex
function inicializarTabla() {
    // Columnas: x1..x6, s1..s4, s5(exceso), s6(exceso), a1, a2, RHS
    // Total: 6 + 4 + 2 + 2 + 1 = 15 columnas
    nombresColumnas = [
        'x₁', 'x₂', 'x₃', 'x₄', 'x₅', 'x₆',
        's₁', 's₂', 's₃', 's₄', 'e₅', 'e₆', 'a₁', 'a₂', 'RHS'
    ];

    const numFilas = 6; // 6 restricciones
    const numCols = 15;

    tabla = Array.from({ length: numFilas + 1 }, () => Array(numCols).fill(0));

    // Llenar matriz A
    for (let i = 0; i < 6; i++) {
        for (let j = 0; j < 6; j++) {
            tabla[i][j] = PROBLEMA.A[i][j];
        }
    }

    // Variables de holgura (s1..s4 para <=)
    for (let i = 0; i < 4; i++) {
        tabla[i][6 + i] = 1;
    }

    // Variables de exceso y artificiales para >=
    tabla[4][10] = -1; // e5
    tabla[4][12] = 1;  // a1
    tabla[5][11] = -1; // e6
    tabla[5][13] = 1;  // a2

    // RHS
    for (let i = 0; i < 6; i++) {
        tabla[i][14] = PROBLEMA.b[i];
    }

    // Fila Z (última fila): Z - 850x1 - 1200x2 - ... = 0
    // Con Gran M: penalizamos a1 y a2 con -M (maximización)
    for (let j = 0; j < 6; j++) {
        tabla[6][j] = -PROBLEMA.c[j];
    }
    tabla[6][12] = M;  // a1
    tabla[6][13] = M;  // a2

    // Base inicial: s1, s2, s3, s4, a1, a2
    variablesBase = ['s₁', 's₂', 's₃', 's₄', 'a₁', 'a₂'];

    // Ajustar fila Z para que las variables básicas tengan coef 0
    // Como a1 y a2 están en la base, hay que eliminar sus coeficientes en Z
    // Z = Z - M*a1 - M*a2, pero a1 y a2 son básicas
    // Restamos M*(fila 4) + M*(fila 5) de la fila Z
    for (let j = 0; j < 15; j++) {
        tabla[6][j] = tabla[6][j] - M * tabla[4][j] - M * tabla[5][j];
    }

    iteraciones = [];
    iteracionActual = -1;
    guardarIteracion("Inicialización", "Se construye la tabla con variables de holgura (s₁..s₄), exceso (e₅, e₆) y artificiales (a₁, a₂). Se aplica el método de la Gran M penalizando a₁ y a₂ con M=10000 en la función objetivo.");
}

function guardarIteracion(titulo, explicacion, entrante = null, saliente = null, pivot = null) {
    iteraciones.push({
        tabla: tabla.map(fila => [...fila]),
        base: [...variablesBase],
        titulo, explicacion, entrante, saliente, pivot
    });
}

// Encontrar columna pivote (variable entrante) - coeficiente más negativo en Z
function encontrarColumnaPivote() {
    let min = -0.0001;
    let colPiv = -1;
    for (let j = 0; j < 14; j++) {
        if (tabla[6][j] < min) {
            min = tabla[6][j];
            colPiv = j;
        }
    }
    return colPiv;
}

// Encontrar fila pivote (variable saliente) - razón mínima
function encontrarFilaPivote(colPiv) {
    let minRazon = Infinity;
    let filaPiv = -1;
    for (let i = 0; i < 6; i++) {
        if (tabla[i][colPiv] > 0.0001) {
            const razon = tabla[i][14] / tabla[i][colPiv];
            if (razon < minRazon) {
                minRazon = razon;
                filaPiv = i;
            }
        }
    }
    return { fila: filaPiv, razon: minRazon };
}

// Realizar pivoteo
function pivotar(filaPiv, colPiv) {
    const pivote = tabla[filaPiv][colPiv];

    // Dividir fila pivote
    for (let j = 0; j < 15; j++) {
        tabla[filaPiv][j] /= pivote;
    }

    // Hacer ceros en la columna pivote
    for (let i = 0; i < 7; i++) {
        if (i !== filaPiv) {
            const factor = tabla[i][colPiv];
            for (let j = 0; j < 15; j++) {
                tabla[i][j] -= factor * tabla[filaPiv][j];
            }
        }
    }

    // Actualizar base
    variablesBase[filaPiv] = nombresColumnas[colPiv];
}

// Verificar optimalidad
function esOptimo() {
    for (let j = 0; j < 14; j++) {
        if (tabla[6][j] < -0.0001) return false;
    }
    return true;
}

// Avanzar una iteración
function siguienteIteracion() {
    if (iteracionActual === -1) {
        inicializarTabla();
        iteracionActual = 0;
        mostrarIteracion();
        return;
    }

    if (esOptimo()) {
        alert('🎉 ¡Solución óptima alcanzada!');
        return;
    }

    const colPiv = encontrarColumnaPivote();
    if (colPiv === -1) {
        alert('Solución óptima alcanzada');
        return;
    }

    const { fila: filaPiv, razon } = encontrarFilaPivote(colPiv);
    if (filaPiv === -1) {
        alert('Problema no acotado');
        return;
    }

    const varEntrante = nombresColumnas[colPiv];
    const varSaliente = variablesBase[filaPiv];

    // Realizar pivote
    pivotar(filaPiv, colPiv);
    iteracionActual++;

    const explicacion = `• Variable ENTRANTE: ${varEntrante} (coeficiente más negativo en Z: ${tabla[6][colPiv]?.toFixed(2) || 'ajustado'})\n• Variable SALIENTE: ${varSaliente} (razón mínima: ${razon.toFixed(2)})\n• Elemento PIVOTE: fila ${filaPiv + 1}, columna ${colPiv + 1}\n• Se realizan operaciones de fila para hacer ceros en la columna pivote.\n• Nueva base: [${variablesBase.join(', ')}]`;

    guardarIteracion(`Iteración ${iteracionActual}`, explicacion, varEntrante, varSaliente, { fila: filaPiv, col: colPiv });
    mostrarIteracion();
}

function iteracionAnterior() {
    if (iteracionActual > 0) {
        iteracionActual--;
        mostrarIteracion();
    }
}

function reiniciar() {
    iteracionActual = -1;
    iteraciones = [];
    document.getElementById('simplexTable').innerHTML = '';
    document.getElementById('statusText').textContent = 'Presiona "Siguiente Iteración" para comenzar.';
    document.getElementById('pivotInfo').textContent = '-';
    document.getElementById('explanation').textContent = '-';
    document.getElementById('iterCount').textContent = '0';
    document.getElementById('iterTotal').textContent = '?';
}

// Mostrar iteración actual
function mostrarIteracion() {
    if (iteracionActual < 0 || iteracionActual >= iteraciones.length) return;

    const iter = iteraciones[iteracionActual];

    // Status
    document.getElementById('statusText').textContent =
        `Iteración: ${iteracionActual}\nBase actual: [${iter.base.join(', ')}]\nTítulo: ${iter.titulo}`;

    // Pivot info
    if (iter.entrante && iter.saliente) {
        document.getElementById('pivotInfo').innerHTML =
            `📥 Entra: <b>${iter.entrante}</b> &nbsp;|&nbsp; 📤 Sale: <b>${iter.saliente}</b>`;
    } else {
        document.getElementById('pivotInfo').textContent = iter.titulo;
    }

    // Explicación
    document.getElementById('explanation').textContent = iter.explicacion;

    // Tabla
    renderTabla(iter);

    // Contador
    document.getElementById('iterCount').textContent = iteracionActual;
    document.getElementById('iterTotal').textContent = iteracionActual + 1;

    // Botones
    document.getElementById('btnPrev').disabled = iteracionActual === 0;

    // Si es óptimo, mostrar solución
    if (esOptimo() && iteracionActual === iteraciones.length - 1) {
        mostrarSolucionFinal(iter);
    }
}

function renderTabla(iter) {
    const t = iter.tabla;
    let html = '<thead><tr><th>Base</th>';
    for (let j = 0; j < nombresColumnas.length; j++) {
        html += `<th>${nombresColumnas[j]}</th>`;
    }
    html += '</tr></thead><tbody>';

    for (let i = 0; i < 6; i++) {
        html += '<tr>';
        html += `<td><b>${iter.base[i]}</b></td>`;
        for (let j = 0; j < 15; j++) {
            let cls = '';
            if (iter.pivot && iter.pivot.fila === i && iter.pivot.col === j) cls = 'pivot-cell';
            if (iter.entrante && nombresColumnas[j] === iter.entrante && iter.pivot && iter.pivot.col === j) cls = 'entering';
            if (iter.saliente && iter.base[i] === iter.saliente && iter.pivot && iter.pivot.fila === i) cls = 'leaving';
            const val = Math.abs(t[i][j]) < 0.0001 ? 0 : t[i][j].toFixed(2);
            html += `<td class="${cls}">${val}</td>`;
        }
        html += '</tr>';
    }

    // Fila Z
    html += '<tr class="z-row"><td><b>Z</b></td>';
    for (let j = 0; j < 15; j++) {
        const val = Math.abs(t[6][j]) < 0.0001 ? 0 : t[6][j].toFixed(2);
        html += `<td>${val}</td>`;
    }
    html += '</tr></tbody>';

    document.getElementById('simplexTable').innerHTML = html;
}

function mostrarSolucionFinal(iter) {
    // Extraer valores de las variables de decisión (x1..x6)
    const valores = [0, 0, 0, 0, 0, 0];
    for (let i = 0; i < 6; i++) {
        const idx = nombresColumnas.indexOf(iter.base[i]);
        if (idx >= 0 && idx < 6) {
            valores[idx] = iter.tabla[i][14];
        }
    }
    
    // Actualizar Ganancia Máxima
    const ganancia = iter.tabla[6][14] || 0;
    const prodTotal = valores.reduce((a,b)=>a+b, 0);
    document.querySelector('.solution-card .big-number').innerHTML = `${Math.round(ganancia).toLocaleString('es-BO')} <small>Bs/mes</small>`;
    document.querySelector('.solution-card p b').innerText = `${Math.round(prodTotal)} ton/mes`;
    
    // Actualizar tabla de plan de producción
    const tbody = document.querySelector('#solucion .solution-table tbody');
    if (tbody) {
        const filas = tbody.querySelectorAll('tr');
        valores.forEach((v, i) => {
            if(filas[i]) {
                filas[i].cells[3].innerText = Math.round(v);
                if (v > 0) {
                    filas[i].cells[4].className = 'status-on';
                    filas[i].cells[4].innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Producir`;
                } else {
                    filas[i].cells[4].className = 'status-off';
                    filas[i].cells[4].innerText = 'No producir';
                }
            }
        });
    }

    actualizarGraficos(valores);
}

let miChartPlantas = null;
let miChartProductos = null;

function actualizarGraficos(valores) {
    const elAltoTot = valores[0] + valores[1];
    const cbbaTot = valores[2] + valores[3];
    const sczTot = valores[4] + valores[5];
    
    if(miChartPlantas) miChartPlantas.destroy();
    if(miChartProductos) miChartProductos.destroy();
    
    const ctxPlantas = document.getElementById('chartPlantas');
    const ctxProd = document.getElementById('chartProductos');
    if(!ctxPlantas || !ctxProd) return;

    miChartPlantas = new Chart(ctxPlantas, {
        type: 'doughnut',
        data: {
            labels: ['El Alto', 'Cochabamba', 'Santa Cruz'],
            datasets: [{
                data: [elAltoTot, cbbaTot, sczTot],
                backgroundColor: ['#ff6b35', '#0066cc', '#00c853'],
                borderWidth: 3,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            animation: { animateScale: true, animateRotate: true, duration: 1000 },
            plugins: { legend: { position: 'bottom' }, title: { display: false } }
        }
    });

    miChartProductos = new Chart(ctxProd, {
        type: 'bar',
        data: {
            labels: ['El Alto', 'Cochabamba', 'Santa Cruz'],
            datasets: [
                { label: 'Leche fluida', data: [valores[0], valores[2], valores[4]], backgroundColor: '#00a8e8' },
                { label: 'Yogur', data: [valores[1], valores[3], valores[5]], backgroundColor: '#ff6b35' }
            ]
        },
        options: {
            responsive: true,
            animation: { duration: 1000 },
            plugins: { legend: { position: 'bottom' } },
            scales: {
                x: { stacked: true },
                y: { stacked: true, beginAtZero: true, title: { display: true, text: 'Toneladas' } }
            }
        }
    });
}

// ============ ANÁLISIS DE SENSIBILIDAD ============
function actualizarSensibilidad() {
    const elAlto = parseInt(document.getElementById('rElAlto').value);
    const cbba = parseInt(document.getElementById('rCbba').value);
    const scz = parseInt(document.getElementById('rScz').value);
    const dem = parseInt(document.getElementById('rDem').value);

    document.getElementById('vElAlto').textContent = elAlto;
    document.getElementById('vCbba').textContent = cbba;
    document.getElementById('vScz').textContent = scz;
    document.getElementById('vDem').textContent = dem;

    // Cálculo aproximado basado en precios sombra
    const base = 1971000;
    const delta = (elAlto - 400) * 350 + (cbba - 1000) * 920 + (scz - 600) * 880 + (dem - 900) * (-70);
    const nueva = base + delta;

    document.getElementById('sensGanancia').textContent = nueva.toLocaleString('es-BO') + ' Bs';

    let interp = '';
    if (cbba > 1000) interp = '📈 Ampliar Cochabamba es MUY rentable (920 Bs/ton adicional).';
    else if (cbba < 1000) interp = '📉 Reducir Cochabamba disminuye la ganancia rápidamente.';
    else if (elAlto > 400) interp = '✅ Más capacidad en El Alto ayuda, pero menos que Cochabamba.';
    else interp = '⚖️ La Planta Cochabamba sigue siendo el activo más valioso (precio sombra 920 Bs/ton).';

    document.getElementById('sensInterpretacion').textContent = interp;
}

// ============ GRÁFICOS INICIALES ============
function crearGraficos() {
    // Inicializar con la solución por defecto si no ha corrido el algoritmo
    actualizarGraficos([0, 400, 900, 100, 600, 0]);
}

// ============ CAMBIO DE ESCENARIOS ============
function cambiarEscenario(e) {
    const esc = e.target.value;
    if (ESCENARIOS[esc]) {
        PROBLEMA.b = [...ESCENARIOS[esc].b];
        PROBLEMA.c = [...ESCENARIOS[esc].c];
        
        // Actualizar UI básica
        document.querySelector('.constraint:nth-child(1)').innerHTML = `<span class="tag-constraint">R1</span> x₁ + x₂ ≤ ${PROBLEMA.b[0]} <small class="tooltip-container" data-tooltip="Máxima cantidad de leche que puede procesar El Alto al día">(Cap. El Alto)</small>`;
        
        // Reiniciar tablas y detener animaciones
        reiniciar();
        
        // Ejecutar hasta el final para mostrar los nuevos resultados directamente
        let maxIter = 20;
        while (!esOptimo() && maxIter > 0) {
            siguienteIteracion();
            maxIter--;
        }
    }
}

// ============ AUTO-PLAY ============
let autoPlayInterval = null;
function toggleAutoPlay() {
    const btn = document.getElementById('btnAuto');
    if (autoPlayInterval) {
        clearInterval(autoPlayInterval);
        autoPlayInterval = null;
        btn.textContent = '⏩ Auto-play';
    } else {
        btn.textContent = '⏸ Pausar';
        autoPlayInterval = setInterval(() => {
            if (esOptimo() && iteracionActual >= 0) {
                clearInterval(autoPlayInterval);
                autoPlayInterval = null;
                btn.textContent = '⏩ Auto-play';
                return;
            }
            siguienteIteracion();
        }, 1500);
    }
}

// ============ EVENT LISTENERS ============
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btnNext').addEventListener('click', siguienteIteracion);
    document.getElementById('btnPrev').addEventListener('click', iteracionAnterior);
    document.getElementById('btnReset').addEventListener('click', reiniciar);
    document.getElementById('btnAuto').addEventListener('click', toggleAutoPlay);
    
    const selEscenario = document.getElementById('selEscenario');
    if (selEscenario) selEscenario.addEventListener('change', cambiarEscenario);

    // Sliders de sensibilidad
    ['rElAlto', 'rCbba', 'rScz', 'rDem'].forEach(id => {
        document.getElementById(id).addEventListener('input', actualizarSensibilidad);
    });

    crearGraficos();
});

// Smooth scroll
document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
        e.preventDefault();
        document.querySelector(a.getAttribute('href')).scrollIntoView({ behavior: 'smooth' });
    });
});