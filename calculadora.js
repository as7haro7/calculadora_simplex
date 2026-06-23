// ============================================
// CALCULADORA SÍMPLEX LIBRE
// Implementación con método Gran M (Max/Min)
// ============================================

let PROBLEMA = {
    tipoObj: 'max',
    c: [],
    A: [],
    b: [],
    tipos: [],
    nVars: 0,
    nRest: 0
};

const M = 10000;
let tabla = [];
let variablesBase = [];
let nombresColumnas = [];
let iteraciones = [];
let iteracionActual = -1;

document.getElementById('btnGenerar').addEventListener('click', () => {
    const nVars = parseInt(document.getElementById('numVars').value);
    const nRest = parseInt(document.getElementById('numRest').value);
    const tipo = document.getElementById('tipoObj').value;

    if (nVars < 1 || nRest < 1) return alert('Valores inválidos');

    PROBLEMA.nVars = nVars;
    PROBLEMA.nRest = nRest;
    PROBLEMA.tipoObj = tipo;

    generarCuadricula(nVars, nRest, tipo);
});

function generarCuadricula(nVars, nRest, tipo) {
    const tObj = document.getElementById('tablaObj');
    const tRest = document.getElementById('tablaRest');
    
    // Generar Función Objetivo
    let htmlObj = '<tr>';
    for(let i=1; i<=nVars; i++) {
        htmlObj += `<td><input type="number" id="c_${i}" value="0"> <b>x${i}</b></td>`;
        if(i < nVars) htmlObj += `<td>+</td>`;
    }
    htmlObj += '</tr>';
    tObj.innerHTML = htmlObj;

    // Generar Restricciones
    let htmlRest = '';
    for(let i=1; i<=nRest; i++) {
        htmlRest += '<tr>';
        for(let j=1; j<=nVars; j++) {
            htmlRest += `<td><input type="number" id="a_${i}_${j}" value="0"> <b>x${j}</b></td>`;
            if(j < nVars) htmlRest += `<td>+</td>`;
        }
        htmlRest += `<td>
            <select id="tipo_${i}">
                <option value="<=">≤</option>
                <option value=">=">≥</option>
                <option value="=">=</option>
            </select>
        </td>`;
        htmlRest += `<td><input type="number" id="b_${i}" value="0"></td>`;
        htmlRest += '</tr>';
    }
    tRest.innerHTML = htmlRest;

    document.getElementById('matrixSection').style.display = 'block';
    document.getElementById('resultadosSection').style.display = 'none';
}

document.getElementById('btnResolver').addEventListener('click', () => {
    leerProblema();
    document.getElementById('resultadosSection').style.display = 'block';
    reiniciar();
    document.getElementById('resultadosSection').scrollIntoView({ behavior: 'smooth' });
});

function leerProblema() {
    PROBLEMA.c = [];
    PROBLEMA.A = [];
    PROBLEMA.b = [];
    PROBLEMA.tipos = [];

    const nVars = PROBLEMA.nVars;
    const nRest = PROBLEMA.nRest;

    for(let j=1; j<=nVars; j++) {
        let val = parseFloat(document.getElementById(`c_${j}`).value) || 0;
        PROBLEMA.c.push(val);
    }

    for(let i=1; i<=nRest; i++) {
        let fila = [];
        for(let j=1; j<=nVars; j++) {
            let val = parseFloat(document.getElementById(`a_${i}_${j}`).value) || 0;
            fila.push(val);
        }
        PROBLEMA.A.push(fila);
        PROBLEMA.tipos.push(document.getElementById(`tipo_${i}`).value);
        PROBLEMA.b.push(parseFloat(document.getElementById(`b_${i}`).value) || 0);
    }
}

function inicializarTabla() {
    const { nVars, nRest, tipoObj, A, b, c, tipos } = PROBLEMA;
    
    // Contar variables de holgura, exceso y artificiales
    let nHolguras = 0;
    let nExceso = 0;
    let nArtificiales = 0;

    for (let i = 0; i < nRest; i++) {
        if (tipos[i] === '<=') nHolguras++;
        else if (tipos[i] === '>=') { nExceso++; nArtificiales++; }
        else if (tipos[i] === '=') nArtificiales++;
    }

    const totalCols = nVars + nHolguras + nExceso + nArtificiales + 1; // +1 para RHS
    tabla = Array.from({ length: nRest + 1 }, () => Array(totalCols).fill(0));
    nombresColumnas = [];
    variablesBase = [];

    // Nombres
    for (let j = 1; j <= nVars; j++) nombresColumnas.push(`x${j}`);
    for (let j = 1; j <= nHolguras; j++) nombresColumnas.push(`s${j}`);
    for (let j = 1; j <= nExceso; j++) nombresColumnas.push(`e${j}`);
    for (let j = 1; j <= nArtificiales; j++) nombresColumnas.push(`a${j}`);
    nombresColumnas.push('RHS');

    let idxCol = nVars;
    let idxH = 1, idxE = 1, idxA = 1;
    let baseIdx = [];

    // Llenar Matriz
    for (let i = 0; i < nRest; i++) {
        for (let j = 0; j < nVars; j++) tabla[i][j] = A[i][j];
        
        if (tipos[i] === '<=') {
            const pos = nVars + idxH - 1;
            tabla[i][pos] = 1;
            variablesBase.push(`s${idxH}`);
            baseIdx.push(pos);
            idxH++;
        } else if (tipos[i] === '>=') {
            const posE = nVars + nHolguras + idxE - 1;
            const posA = nVars + nHolguras + nExceso + idxA - 1;
            tabla[i][posE] = -1;
            tabla[i][posA] = 1;
            variablesBase.push(`a${idxA}`);
            baseIdx.push(posA);
            idxE++; idxA++;
        } else if (tipos[i] === '=') {
            const posA = nVars + nHolguras + nExceso + idxA - 1;
            tabla[i][posA] = 1;
            variablesBase.push(`a${idxA}`);
            baseIdx.push(posA);
            idxA++;
        }
        
        tabla[i][totalCols - 1] = b[i]; // RHS
    }

    // Función Objetivo
    const filaZ = nRest;
    const multObj = tipoObj === 'max' ? -1 : 1;
    for (let j = 0; j < nVars; j++) {
        tabla[filaZ][j] = c[j] * multObj;
    }

    // Penalizaciones Gran M para artificiales
    for (let j = 0; j < nArtificiales; j++) {
        const posA = nVars + nHolguras + nExceso + j;
        tabla[filaZ][posA] = tipoObj === 'max' ? M : -M; // En minimización la penalización es +M en Z original, al pasar al otro lado es -M? 
        // Espera: Min Z = cx + Ma.  Z - cx - Ma = 0. Entonces coef Z = -M.
        // Max Z = cx - Ma. Z - cx + Ma = 0. Entonces coef Z = +M.
        tabla[filaZ][posA] = M; 
    }

    // Hacer ceros en Z bajo las columnas de variables básicas (artificiales)
    for (let i = 0; i < nRest; i++) {
        if (tipos[i] === '>=' || tipos[i] === '=') {
            for (let j = 0; j < totalCols; j++) {
                tabla[filaZ][j] -= M * tabla[i][j];
            }
        }
    }

    iteraciones = [];
    guardarIteracion("Inicialización", "Tabla inicial lista para el algoritmo Símplex.");
}

function guardarIteracion(titulo, explicacion, entrante = null, saliente = null, pivot = null) {
    iteraciones.push({
        tabla: tabla.map(fila => [...fila]),
        base: [...variablesBase],
        titulo, explicacion, entrante, saliente, pivot
    });
}

function encontrarColumnaPivote() {
    let min = -0.0001;
    let colPiv = -1;
    const filaZ = PROBLEMA.nRest;
    const cols = tabla[0].length - 1; // Sin RHS

    for (let j = 0; j < cols; j++) {
        if (tabla[filaZ][j] < min) {
            min = tabla[filaZ][j];
            colPiv = j;
        }
    }
    return colPiv; // Para minimización también buscamos negativos porque hemos mantenido la misma lógica (Multiplicamos C por 1 en vez de -1? No, la regla de parada es >= 0 en fila Z).
}

function encontrarFilaPivote(colPiv) {
    let minRazon = Infinity;
    let filaPiv = -1;
    const cols = tabla[0].length - 1;

    for (let i = 0; i < PROBLEMA.nRest; i++) {
        if (tabla[i][colPiv] > 0.0001) {
            const razon = tabla[i][cols] / tabla[i][colPiv];
            if (razon < minRazon) {
                minRazon = razon;
                filaPiv = i;
            }
        }
    }
    return { fila: filaPiv, razon: minRazon };
}

function pivotar(filaPiv, colPiv) {
    const pivote = tabla[filaPiv][colPiv];
    const cols = tabla[0].length;

    for (let j = 0; j < cols; j++) tabla[filaPiv][j] /= pivote;

    for (let i = 0; i <= PROBLEMA.nRest; i++) {
        if (i !== filaPiv) {
            const factor = tabla[i][colPiv];
            for (let j = 0; j < cols; j++) {
                tabla[i][j] -= factor * tabla[filaPiv][j];
            }
        }
    }
    variablesBase[filaPiv] = nombresColumnas[colPiv];
}

function esOptimo() {
    const filaZ = PROBLEMA.nRest;
    const cols = tabla[0].length - 1;
    for (let j = 0; j < cols; j++) {
        if (tabla[filaZ][j] < -0.0001) return false;
    }
    return true;
}

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

    pivotar(filaPiv, colPiv);
    iteracionActual++;

    guardarIteracion(`Iteración ${iteracionActual}`, `Entra: ${varEntrante}, Sale: ${varSaliente}`, varEntrante, varSaliente, { fila: filaPiv, col: colPiv });
    mostrarIteracion();
}

function reiniciar() {
    iteracionActual = -1;
    iteraciones = [];
    document.getElementById('simplexTable').innerHTML = '';
    document.getElementById('statusText').textContent = 'Presiona "Siguiente Iteración" para comenzar.';
    document.getElementById('btnPrev').disabled = true;
}

function mostrarIteracion() {
    if (iteracionActual < 0 || iteracionActual >= iteraciones.length) return;
    const iter = iteraciones[iteracionActual];

    document.getElementById('statusText').textContent = iter.explicacion;
    document.getElementById('btnPrev').disabled = iteracionActual === 0;

    renderTabla(iter);
}

function renderTabla(iter) {
    const t = iter.tabla;
    let html = '<thead><tr><th>Base</th>';
    for (let j = 0; j < nombresColumnas.length; j++) html += `<th>${nombresColumnas[j]}</th>`;
    html += '</tr></thead><tbody>';

    for (let i = 0; i < PROBLEMA.nRest; i++) {
        html += '<tr>';
        html += `<td><b>${iter.base[i]}</b></td>`;
        for (let j = 0; j < t[i].length; j++) {
            let cls = '';
            if (iter.pivot && iter.pivot.fila === i && iter.pivot.col === j) cls = 'pivot-cell';
            if (iter.entrante && nombresColumnas[j] === iter.entrante && iter.pivot && iter.pivot.col === j) cls = 'entering';
            if (iter.saliente && iter.base[i] === iter.saliente && iter.pivot && iter.pivot.fila === i) cls = 'leaving';
            const val = Math.abs(t[i][j]) < 0.0001 ? 0 : t[i][j].toFixed(2);
            html += `<td class="${cls}">${val}</td>`;
        }
        html += '</tr>';
    }

    html += '<tr class="z-row"><td><b>Z</b></td>';
    for (let j = 0; j < t[PROBLEMA.nRest].length; j++) {
        const val = Math.abs(t[PROBLEMA.nRest][j]) < 0.0001 ? 0 : t[PROBLEMA.nRest][j].toFixed(2);
        html += `<td>${val}</td>`;
    }
    html += '</tr></tbody>';

    document.getElementById('simplexTable').innerHTML = html;
}

document.getElementById('btnNext').addEventListener('click', siguienteIteracion);
document.getElementById('btnPrev').addEventListener('click', () => {
    if (iteracionActual > 0) {
        iteracionActual--;
        mostrarIteracion();
    }
});
document.getElementById('btnReset').addEventListener('click', reiniciar);
