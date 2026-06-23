// ============================================================
// CONFIGURACIÓN
// ============================================================
// 1. Cambia esto por la URL real de tu Worker en Cloudflare
//    (la obtienes después de publicarlo, ej:
//    https://bravo-reels-worker.tu-subdominio.workers.dev)
const WORKER_URL = "https://bravo-reels-worker.TU-SUBDOMINIO.workers.dev";

const DIA_NOMBRES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MES_NOMBRES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];

// ============================================================
// ESTADO
// ============================================================
const state = {
  rawText: "",
  reels: [],        // [{ numero, tema, copyout }]
  cliente: "",
  fechaInicio: "",
  reelsPorDia: 1,
  dias: [1,2,3,4,5],
  horarios: ["10:00"],
  schedule: []       // [{ numero, tema, copyout, fecha: Date, hora }]
};

// ============================================================
// NAVEGACIÓN DE PASOS
// ============================================================
function showStep(n) {
  document.querySelectorAll(".panel").forEach(p => p.classList.add("hidden"));
  document.getElementById(`panel-${n}`).classList.remove("hidden");

  document.querySelectorAll(".step-item").forEach(item => {
    const step = parseInt(item.dataset.step, 10);
    item.classList.remove("active", "done");
    if (step === n) item.classList.add("active");
    else if (step < n) item.classList.add("done");
  });
}

// ============================================================
// PASO 1 — CARGA DE ARCHIVO O TEXTO
// ============================================================
const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("fileInput");
const browseBtn = document.getElementById("browseBtn");
const fileNameDisplay = document.getElementById("fileNameDisplay");
const rawTextInput = document.getElementById("rawTextInput");
const processBtn = document.getElementById("processBtn");
const step1Error = document.getElementById("step1Error");

let loadedFile = null;

browseBtn.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", () => {
  if (fileInput.files[0]) handleFile(fileInput.files[0]);
});

["dragover", "dragenter"].forEach(evt =>
  dropzone.addEventListener(evt, e => {
    e.preventDefault();
    dropzone.classList.add("dragover");
  })
);
["dragleave", "drop"].forEach(evt =>
  dropzone.addEventListener(evt, e => {
    e.preventDefault();
    dropzone.classList.remove("dragover");
  })
);
dropzone.addEventListener("drop", e => {
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
});

function handleFile(file) {
  loadedFile = file;
  fileNameDisplay.textContent = `Archivo cargado: ${file.name}`;
}

function showStep1Error(msg) {
  step1Error.textContent = msg;
  step1Error.classList.remove("hidden");
}
function clearStep1Error() {
  step1Error.classList.add("hidden");
}

async function extractTextFromFile(file) {
  const ext = file.name.split(".").pop().toLowerCase();

  if (ext === "txt") {
    return await file.text();
  }

  if (ext === "pdf") {
    const buffer = await file.arrayBuffer();
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
    let text = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map(it => it.str).join(" ") + "\n";
    }
    return text;
  }

  if (ext === "docx") {
    const buffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer: buffer });
    return result.value;
  }

  throw new Error("Formato de archivo no soportado.");
}

processBtn.addEventListener("click", async () => {
  clearStep1Error();

  let text = rawTextInput.value.trim();

  try {
    if (loadedFile) {
      processBtn.disabled = true;
      processBtn.textContent = "Leyendo archivo...";
      text = (await extractTextFromFile(loadedFile)).trim();
    }

    if (!text) {
      showStep1Error("Sube un archivo o pega el texto de tus guiones antes de continuar.");
      resetProcessBtn();
      return;
    }

    state.rawText = text;
    processBtn.textContent = "Analizando guiones con IA...";

    const data = await callWorker(text);
    state.reels = data.reels.map((r, i) => ({
      numero: r.numero || i + 1,
      tipo: (r.tipo === "venta" || r.tipo === "valor") ? r.tipo : "valor",
      tema: r.tema || "",
      copyout: r.copyout || ""
    }));

    renderReelsList();
    showStep(2);
  } catch (err) {
    console.error(err);
    showStep1Error(`Ocurrió un error: ${err.message}. Intenta de nuevo.`);
  } finally {
    resetProcessBtn();
  }
});

function resetProcessBtn() {
  processBtn.disabled = false;
  processBtn.textContent = "Identificar guiones y generar copyouts →";
}

async function callWorker(text) {
  const res = await fetch(WORKER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text })
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`El worker respondió con error (${res.status}). ${errText}`);
  }

  const data = await res.json();
  if (!data.reels || !Array.isArray(data.reels) || data.reels.length === 0) {
    throw new Error("La IA no devolvió guiones identificables. Revisa el formato del texto.");
  }
  return data;
}

// ============================================================
// PASO 2 — REVISIÓN DE COPYOUTS
// ============================================================
const reelsList = document.getElementById("reelsList");
const reelCountHint = document.getElementById("reelCountHint");
const backTo1Btn = document.getElementById("backTo1Btn");
const continueTo3Btn = document.getElementById("continueTo3Btn");

function renderReelsList() {
  reelsList.innerHTML = "";
  reelCountHint.textContent = `Se identificaron ${state.reels.length} guion(es). Ajusta tema o copy si lo necesitas.`;

  state.reels.forEach((reel, i) => {
    const card = document.createElement("div");
    card.className = "reel-card";
    card.dataset.index = i;
    card.innerHTML = `
      <div class="reel-card-head">
        <span class="reel-tag">REEL ${reel.numero}</span>
        <select class="reel-tipo-input tipo-${reel.tipo}">
          <option value="venta" ${reel.tipo === "venta" ? "selected" : ""}>VENTA</option>
          <option value="valor" ${reel.tipo === "valor" ? "selected" : ""}>VALOR</option>
        </select>
      </div>
      <label>Tema</label>
      <input class="reel-tema-input" value="${escapeAttr(reel.tema)}">
      <label>Copyout</label>
      <textarea class="reel-copy-input">${escapeHtml(reel.copyout)}</textarea>
    `;
    reelsList.appendChild(card);

    const tipoSelect = card.querySelector(".reel-tipo-input");
    tipoSelect.addEventListener("change", () => {
      tipoSelect.classList.remove("tipo-venta", "tipo-valor");
      tipoSelect.classList.add(`tipo-${tipoSelect.value}`);
    });
  });
}

function syncReelsFromDOM() {
  document.querySelectorAll(".reel-card").forEach(card => {
    const i = parseInt(card.dataset.index, 10);
    state.reels[i].tema = card.querySelector(".reel-tema-input").value;
    state.reels[i].copyout = card.querySelector(".reel-copy-input").value;
    state.reels[i].tipo = card.querySelector(".reel-tipo-input").value;
  });
}

backTo1Btn.addEventListener("click", () => showStep(1));

continueTo3Btn.addEventListener("click", () => {
  syncReelsFromDOM();
  // fecha mínima = hoy
  const today = new Date().toISOString().split("T")[0];
  fechaInicioInput.min = today;
  if (!fechaInicioInput.value) fechaInicioInput.value = today;
  showStep(3);
});

function escapeHtml(str) {
  return (str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function escapeAttr(str) {
  return (str || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

// ============================================================
// PASO 3 — CALENDARIZACIÓN
// ============================================================
const clienteInput = document.getElementById("clienteInput");
const fechaInicioInput = document.getElementById("fechaInicioInput");
const reelsPorDiaInput = document.getElementById("reelsPorDiaInput");
const horariosGroup = document.getElementById("horariosGroup");
const diasGroup = document.getElementById("diasGroup");
const backTo2Btn = document.getElementById("backTo2Btn");
const generateBtn = document.getElementById("generateBtn");
const step3Error = document.getElementById("step3Error");

const HORARIOS_DEFAULT = ["10:00", "18:00", "14:00"];

function renderHorariosInputs() {
  const count = parseInt(reelsPorDiaInput.value, 10);
  horariosGroup.innerHTML = "";
  for (let i = 0; i < count; i++) {
    const input = document.createElement("input");
    input.type = "time";
    input.className = "horario-input";
    input.value = state.horarios[i] || HORARIOS_DEFAULT[i] || "10:00";
    horariosGroup.appendChild(input);
  }
}
reelsPorDiaInput.addEventListener("change", renderHorariosInputs);
renderHorariosInputs();

backTo2Btn.addEventListener("click", () => showStep(2));

generateBtn.addEventListener("click", async () => {
  step3Error.classList.add("hidden");

  state.cliente = clienteInput.value.trim() || "Cliente Bravo";
  state.fechaInicio = fechaInicioInput.value;
  state.reelsPorDia = parseInt(reelsPorDiaInput.value, 10);
  state.horarios = Array.from(horariosGroup.querySelectorAll(".horario-input")).map(i => i.value || "10:00");
  state.dias = Array.from(diasGroup.querySelectorAll("input[type=checkbox]:checked")).map(c => parseInt(c.value, 10));

  if (!state.fechaInicio) {
    step3Error.textContent = "Selecciona una fecha de inicio.";
    step3Error.classList.remove("hidden");
    return;
  }
  if (state.dias.length === 0) {
    step3Error.textContent = "Selecciona al menos un día de publicación.";
    step3Error.classList.remove("hidden");
    return;
  }

  state.schedule = buildSchedule(state.reels, state);

  const last = state.schedule[state.schedule.length - 1];
  document.getElementById("deliverySummary").textContent =
    `${state.reels.length} reels programados del ${formatDateEs(state.schedule[0].fecha)} al ${formatDateEs(last.fecha)} para ${state.cliente}.`;

  showStep(4);
});

function buildSchedule(reels, cfg) {
  const schedule = [];
  let cursor = new Date(cfg.fechaInicio + "T00:00:00");
  let idx = 0;

  while (idx < reels.length) {
    const dow = cursor.getDay();
    if (cfg.dias.includes(dow)) {
      for (let slot = 0; slot < cfg.reelsPorDia && idx < reels.length; slot++) {
        schedule.push({
          ...reels[idx],
          fecha: new Date(cursor),
          hora: cfg.horarios[slot] || cfg.horarios[0] || "10:00"
        });
        idx++;
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return schedule;
}

function formatDateEs(date) {
  return `${date.getDate()} de ${MES_NOMBRES[date.getMonth()]}`;
}

// ============================================================
// PASO 4 — ENTREGABLES
// ============================================================
document.getElementById("downloadPdfBtn").addEventListener("click", generateCopyoutsPDF);
document.getElementById("downloadCalBtn").addEventListener("click", generateCalendarImage);
document.getElementById("restartBtn").addEventListener("click", restartApp);

function restartApp() {
  loadedFile = null;
  fileNameDisplay.textContent = "";
  rawTextInput.value = "";
  fileInput.value = "";
  state.reels = [];
  state.schedule = [];
  showStep(1);
}

// ---------- PDF DE COPYOUTS ----------
function generateCopyoutsPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 56;
  let y = 0;

  function paintBackground() {
    doc.setFillColor(10, 10, 10);
    doc.rect(0, 0, pageW, pageH, "F");
  }

  function newPage() {
    doc.addPage();
    paintBackground();
    y = 70;
  }

  paintBackground();
  y = 70;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(255, 0, 0);
  doc.text(`Copyouts para reels - ${state.cliente}`, marginX, y);

  y += 22;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(180, 180, 180);
  doc.text("Contenido preparado para publicación en redes sociales.", marginX, y);

  y += 16;
  doc.setDrawColor(255, 0, 0);
  doc.setLineWidth(1);
  doc.line(marginX, y, pageW - marginX, y);
  y += 36;

  const maxWidth = pageW - marginX * 2;

  state.reels.forEach((reel, i) => {
    if (y > pageH - 130) newPage();

    doc.setFont("courier", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(255, 0, 0);
    doc.text(`REEL ${reel.numero}  ·  ${(reel.tipo || "valor").toUpperCase()}`, marginX, y);
    y += 16;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12.5);
    doc.setTextColor(245, 245, 245);
    const temaLines = doc.splitTextToSize(`Tema: ${reel.tema}`, maxWidth);
    doc.text(temaLines, marginX, y);
    y += temaLines.length * 15 + 8;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11.5);
    doc.setTextColor(225, 225, 225);
    const copyLines = doc.splitTextToSize(reel.copyout, maxWidth);

    copyLines.forEach(line => {
      if (y > pageH - 70) newPage();
      doc.text(line, marginX, y);
      y += 15.5;
    });

    y += 14;
    doc.setDrawColor(42, 42, 42);
    doc.setLineWidth(0.6);
    doc.line(marginX, y, pageW - marginX, y);
    y += 28;
  });

  doc.save(`Copyouts_${slugify(state.cliente)}.pdf`);
}

// ---------- IMAGEN DE CALENDARIO ----------
async function generateCalendarImage() {
  const target = document.getElementById("calendarRenderTarget");
  target.innerHTML = buildCalendarHTML();

  // damos un frame para que el navegador renderice el HTML inyectado
  await new Promise(r => setTimeout(r, 60));

  const canvas = await html2canvas(target, {
    backgroundColor: "#0A0A0A",
    scale: 2,
    width: 1080
  });

  canvas.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Calendario_${slugify(state.cliente)}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }, "image/png");
}

function buildCalendarHTML() {
  // agrupar por fecha
  const groups = {};
  state.schedule.forEach(item => {
    const key = item.fecha.toDateString();
    if (!groups[key]) groups[key] = { fecha: item.fecha, items: [] };
    groups[key].items.push(item);
  });
  const days = Object.values(groups).sort((a, b) => a.fecha - b.fecha);

  const dayRows = days.map(day => `
    <div style="display:flex; border-bottom:1px solid #232323; padding:22px 0;">
      <div style="width:150px; flex-shrink:0;">
        <div style="background:#FF0000; color:#fff; font-family:'JetBrains Mono',monospace; font-weight:700; font-size:30px; width:64px; height:64px; border-radius:6px; display:flex; align-items:center; justify-content:center;">
          ${day.fecha.getDate()}
        </div>
        <div style="font-family:'JetBrains Mono',monospace; font-size:13px; color:#8A8A8A; margin-top:8px; text-transform:uppercase;">
          ${DIA_NOMBRES[day.fecha.getDay()]}<br>${MES_NOMBRES[day.fecha.getMonth()]}
        </div>
      </div>
      <div style="flex:1; display:flex; flex-direction:column; gap:12px;">
        ${day.items.map(item => `
          <div style="background:#141414; border:1px solid #2A2A2A; border-left:3px solid ${item.tipo === "venta" ? "#FF0000" : "#5A5A5A"}; border-radius:5px; padding:14px 18px; display:flex; justify-content:space-between; align-items:center; gap:16px;">
            <div>
              <div style="font-family:'JetBrains Mono',monospace; font-size:11px; color:${item.tipo === "venta" ? "#FF0000" : "#8A8A8A"}; letter-spacing:1px; margin-bottom:4px;">REEL ${item.numero} · ${item.hora} · ${(item.tipo || "valor").toUpperCase()}</div>
              <div style="font-family:'Inter',sans-serif; font-size:15px; color:#F5F5F5; font-weight:600;">${escapeHtml(item.tema)}</div>
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  `).join("");

  return `
    <div style="width:1080px; background:#0A0A0A; padding:60px; font-family:'Inter',sans-serif;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
        <div>
          <div style="font-family:'Archivo Black',sans-serif; font-size:26px; color:#F5F5F5;">BRAVO <span style="color:#FF0000;">AGENCIA</span></div>
          <div style="font-family:'JetBrains Mono',monospace; font-size:13px; color:#8A8A8A; margin-top:6px; text-transform:uppercase; letter-spacing:1px;">Calendario de publicación de reels</div>
        </div>
        <div style="text-align:right;">
          <div style="font-family:'JetBrains Mono',monospace; font-size:12px; color:#8A8A8A;">CLIENTE</div>
          <div style="font-family:'Inter',sans-serif; font-size:18px; color:#FF0000; font-weight:700;">${escapeHtml(state.cliente)}</div>
        </div>
      </div>
      <div style="height:2px; background:#FF0000; margin:24px 0 30px;"></div>
      ${dayRows}
    </div>
  `;
}

function slugify(str) {
  return (str || "cliente")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
