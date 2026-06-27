// ============================================================
// CONFIGURACIÓN
// ============================================================
const DIA_NOMBRES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MES_NOMBRES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];

// ============================================================
// ESTADO
// ============================================================
const state = {
  cliente: "",
  calendarYear: new Date().getFullYear(),
  calendarMonth: new Date().getMonth(), // 0-indexed
  schedule: []       // [{ id, contentType: 'reel'|'imagen'|'carrusel', tema, fecha: Date, hora, copyout, imagenes? }]
};

let currentStepNum = 1;

// ============================================================
// NAVEGACIÓN DE PASOS
// ============================================================
function showStep(n) {
  currentStepNum = n;
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
// UTILIDADES DE ESCAPE
// ============================================================
function escapeHtml(str) {
  return (str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function escapeAttr(str) {
  return (str || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

// ============================================================
// CALENDARIO — PROGRAMACIÓN MANUAL (reel + imagen + carrusel)
// ============================================================
const clienteInput = document.getElementById("clienteInput");
const calMonthLabel = document.getElementById("calMonthLabel");
const calendarGrid = document.getElementById("calendarGrid");
const assignedList = document.getElementById("assignedList");
const calPrevBtn = document.getElementById("calPrevBtn");
const calNextBtn = document.getElementById("calNextBtn");
const generateBtn = document.getElementById("generateBtn");
const step3Error = document.getElementById("step3Error");
const dayMenu = document.getElementById("dayMenu");
const modalOverlay = document.getElementById("modalOverlay");
const modalBox = document.getElementById("modalBox");

const CONTENT_ICONS = { reel: "🎬", imagen: "🖼", carrusel: "📚" };

function uid() {
  return `e${Date.now()}${Math.random().toString(16).slice(2)}`;
}

function renderStep3() {
  renderCalendar();
  renderAssignedList();
  saveSession();
}

function dateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function keyToDate(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function truncate(str, n) {
  const s = str || "";
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function entryLabel(entry) {
  if (entry.contentType === "reel") return entry.tema || "Reel";
  if (entry.contentType === "imagen") return entry.tema || "Imagen";
  if (entry.contentType === "carrusel") return entry.tema || `Carrusel (${(entry.imagenes || []).length} imágenes)`;
  return "Contenido";
}

function renderCalendar() {
  const year = state.calendarYear;
  const month = state.calendarMonth;
  calMonthLabel.textContent = `${capitalize(MES_NOMBRES[month])} ${year}`;

  const firstOfMonth = new Date(year, month, 1);
  const startOffset = (firstOfMonth.getDay() + 6) % 7; // 0 = lunes
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const byDate = {};
  state.schedule.forEach(entry => {
    const key = dateKey(entry.fecha);
    if (!byDate[key]) byDate[key] = [];
    byDate[key].push(entry);
  });

  let html = "";
  for (let i = 0; i < startOffset; i++) {
    html += `<div class="calendar-day empty"></div>`;
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const key = dateKey(date);
    const entries = (byDate[key] || []).slice().sort((a, b) => (a.hora || "").localeCompare(b.hora || ""));
    const isToday = date.getTime() === today.getTime();

    const badges = entries.map(e => {
      const icon = CONTENT_ICONS[e.contentType] || "•";
      const label = `${icon} ${truncate(e.tema, 14)}`;
      const tipoClass = e.contentType === "reel" ? "tipo-reel" : `tipo-${e.contentType}`;
      return `<span class="cal-badge ${tipoClass}" draggable="true" data-id="${e.id}" title="${escapeAttr(entryLabel(e))} · ${e.hora}">${label} · ${e.hora}</span>`;
    }).join("");

    html += `
      <div class="calendar-day ${isToday ? "today" : ""}" data-date="${key}">
        <div class="cal-day-top">
          <span class="cal-day-num">${day}</span>
          <button type="button" class="cal-day-add" data-date="${key}" title="Agregar reel, imagen o carrusel">+</button>
        </div>
        <div class="cal-day-badges">${badges}</div>
      </div>
    `;
  }

  calendarGrid.innerHTML = html;

  calendarGrid.querySelectorAll(".cal-badge").forEach(badge => {
    badge.addEventListener("dragstart", e => {
      badge.classList.add("dragging");
      e.dataTransfer.setData("text/plain", badge.dataset.id);
      e.dataTransfer.effectAllowed = "move";
    });
    badge.addEventListener("dragend", () => badge.classList.remove("dragging"));
  });

  calendarGrid.querySelectorAll(".calendar-day").forEach(cell => {
    if (cell.classList.contains("empty")) return;
    cell.addEventListener("dragover", e => {
      e.preventDefault();
      cell.classList.add("drag-over");
    });
    cell.addEventListener("dragleave", () => cell.classList.remove("drag-over"));
    cell.addEventListener("drop", e => {
      e.preventDefault();
      cell.classList.remove("drag-over");
      const id = e.dataTransfer.getData("text/plain");
      const entry = state.schedule.find(s => s.id === id);
      if (entry) {
        entry.fecha = keyToDate(cell.dataset.date);
        renderStep3();
      }
    });
  });
}

function renderAssignedList() {
  if (state.schedule.length === 0) {
    assignedList.innerHTML = `<span class="assigned-empty">Aún no has agregado nada. Da clic en una fecha del calendario.</span>`;
    return;
  }

  const sorted = [...state.schedule].sort((a, b) => {
    const diff = a.fecha - b.fecha;
    if (diff !== 0) return diff;
    return (a.hora || "").localeCompare(b.hora || "");
  });

  assignedList.innerHTML = sorted.map(entry => `
    <div class="assigned-row" data-id="${entry.id}">
      ${entry.imagenes && entry.imagenes[0]
        ? `<img class="assigned-thumb" src="${entry.imagenes[0]}">`
        : `<span class="assigned-tag">${CONTENT_ICONS[entry.contentType] || "•"}</span>`}
      <span class="assigned-tema">${escapeHtml(entryLabel(entry))}</span>
      <span class="assigned-fecha">${formatDateEs(entry.fecha)} · ${entry.hora}</span>
      <button type="button" class="assigned-remove-btn" title="Editar / eliminar">✏️</button>
    </div>
  `).join("");

  assignedList.querySelectorAll(".assigned-row").forEach(row => {
    const id = row.dataset.id;
    row.addEventListener("click", () => openEditEntryModal(id));
  });
}

function addEntry(entry) {
  state.schedule.push(entry);
  renderStep3();
}

function removeEntry(id) {
  state.schedule = state.schedule.filter(e => e.id !== id);
  renderStep3();
}

// ---------- MENU EMERGENTE AL DAR CLIC EN UN DIA ----------
function openDayMenu(key, x, y) {
  dayMenu.innerHTML = `
    <span class="day-menu-title">${escapeHtml(formatDateEs(keyToDate(key)))}</span>
    <button type="button" class="day-menu-item" id="menuAddReel">🎬 Agregar reel</button>
    <button type="button" class="day-menu-item" id="menuAddImagen">🖼 Agregar imagen</button>
    <button type="button" class="day-menu-item" id="menuAddCarrusel">📚 Agregar carrusel</button>
  `;
  dayMenu.classList.remove("hidden");

  const menuWidth = 240, menuHeight = 180;
  const left = Math.max(12, Math.min(x, window.innerWidth - menuWidth - 12));
  const top = Math.max(12, Math.min(y, window.innerHeight - menuHeight - 12));
  dayMenu.style.left = `${left}px`;
  dayMenu.style.top = `${top}px`;

  document.getElementById("menuAddReel").addEventListener("click", () => {
    closeDayMenu();
    openReelModal(key);
  });
  document.getElementById("menuAddImagen").addEventListener("click", () => {
    closeDayMenu();
    openImagenModal(key);
  });
  document.getElementById("menuAddCarrusel").addEventListener("click", () => {
    closeDayMenu();
    openCarruselModal(key);
  });
}

function closeDayMenu() {
  dayMenu.classList.add("hidden");
}

document.addEventListener("click", e => {
  if (!dayMenu.classList.contains("hidden") && !dayMenu.contains(e.target)) {
    closeDayMenu();
  }
});

calendarGrid.addEventListener("click", e => {
  const badge = e.target.closest(".cal-badge");
  if (badge) {
    e.stopPropagation();
    openEditEntryModal(badge.dataset.id);
    return;
  }
  const addBtn = e.target.closest(".cal-day-add");
  if (addBtn) {
    e.stopPropagation();
    openDayMenu(addBtn.dataset.date, e.clientX, e.clientY);
    return;
  }
  const dayCell = e.target.closest(".calendar-day");
  if (dayCell && !dayCell.classList.contains("empty")) {
    e.stopPropagation();
    openDayMenu(dayCell.dataset.date, e.clientX, e.clientY);
  }
});

calPrevBtn.addEventListener("click", () => {
  state.calendarMonth--;
  if (state.calendarMonth < 0) { state.calendarMonth = 11; state.calendarYear--; }
  renderCalendar();
  saveSession();
});

calNextBtn.addEventListener("click", () => {
  state.calendarMonth++;
  if (state.calendarMonth > 11) { state.calendarMonth = 0; state.calendarYear++; }
  renderCalendar();
  saveSession();
});

generateBtn.addEventListener("click", () => {
  step3Error.classList.add("hidden");

  state.cliente = clienteInput.value.trim() || "Cliente Bravo";

  if (state.schedule.length === 0) {
    step3Error.textContent = "Agrega al menos un reel, imagen o carrusel en el calendario antes de continuar.";
    step3Error.classList.remove("hidden");
    return;
  }

  const sorted = [...state.schedule].sort((a, b) => a.fecha - b.fecha);
  document.getElementById("deliverySummary").textContent =
    `${state.schedule.length} publicación(es) programadas del ${formatDateEs(sorted[0].fecha)} al ${formatDateEs(sorted[sorted.length - 1].fecha)} para ${state.cliente}.`;

  saveSession();
  showStep(2);
});

// ---------- MODAL GENERICO ----------
function showModal(html) {
  modalBox.innerHTML = html;
  modalOverlay.classList.remove("hidden");
}
function closeModal() {
  modalOverlay.classList.add("hidden");
  modalBox.innerHTML = "";
}
modalOverlay.addEventListener("click", e => {
  if (e.target === modalOverlay) closeModal();
});

function lastHoraUsada() {
  if (state.schedule.length === 0) return "10:00";
  const sorted = [...state.schedule].sort((a, b) => b.fecha - a.fecha);
  return sorted[0].hora || "10:00";
}

function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ---------- AGREGAR REEL ----------
function openReelModal(key) {
  showModal(`
    <h2>Agregar reel — ${escapeHtml(formatDateEs(keyToDate(key)))}</h2>
    <div class="modal-error hidden" id="reelModalError"></div>
    <div class="modal-field">
      <label>Tema del reel</label>
      <input type="text" id="reelTemaInput" placeholder="Ej. Protector solar según tu tipo de piel">
    </div>
    <div class="modal-field">
      <label>Copy out</label>
      <textarea id="reelCopyInput" placeholder="Pega aquí el copy out de este reel..."></textarea>
    </div>
    <div class="modal-field">
      <label>Hora de publicación</label>
      <input type="time" id="reelHoraInput" value="${lastHoraUsada()}">
    </div>
    <div class="modal-actions">
      <button type="button" class="btn-ghost" id="reelModalCancel">Cancelar</button>
      <button type="button" class="btn-primary" id="reelModalSave">Agregar al calendario</button>
    </div>
  `);

  document.getElementById("reelModalCancel").addEventListener("click", closeModal);
  document.getElementById("reelModalSave").addEventListener("click", () => {
    const errorEl = document.getElementById("reelModalError");
    const tema = document.getElementById("reelTemaInput").value.trim();
    const copyout = document.getElementById("reelCopyInput").value.trim();
    const hora = document.getElementById("reelHoraInput").value || "10:00";

    if (!tema) {
      errorEl.textContent = "Escribe el tema del reel antes de continuar.";
      errorEl.classList.remove("hidden");
      return;
    }

    addEntry({
      id: uid(),
      contentType: "reel",
      tema,
      copyout,
      fecha: keyToDate(key),
      hora
    });
    closeModal();
  });
}

// ---------- AGREGAR IMAGEN ----------
function openImagenModal(key) {
  showModal(`
    <h2>Agregar imagen — ${escapeHtml(formatDateEs(keyToDate(key)))}</h2>
    <div class="modal-error hidden" id="imgModalError"></div>
    <div class="modal-field">
      <label>Subir imagen</label>
      <input type="file" id="imgFileInput" accept="image/*">
      <div class="modal-thumbs" id="imgThumbs"></div>
    </div>
    <div class="modal-field">
      <label>Tema</label>
      <input type="text" id="imgTemaInput" placeholder="Ej. Protector solar según tu tipo de piel">
    </div>
    <div class="modal-field">
      <label>Copy out</label>
      <textarea id="imgCopyInput" placeholder="Pega aquí el copy out de esta imagen..."></textarea>
    </div>
    <div class="modal-field">
      <label>Hora de publicación</label>
      <input type="time" id="imgHoraInput" value="${lastHoraUsada()}">
    </div>
    <div class="modal-actions">
      <button type="button" class="btn-ghost" id="imgModalCancel">Cancelar</button>
      <button type="button" class="btn-primary" id="imgModalSave">Agregar al calendario</button>
    </div>
  `);

  const fileInputEl = document.getElementById("imgFileInput");
  const thumbsEl = document.getElementById("imgThumbs");
  fileInputEl.addEventListener("change", async () => {
    thumbsEl.innerHTML = "";
    const file = fileInputEl.files[0];
    if (!file) return;
    thumbsEl.innerHTML = `<img class="modal-thumb" src="${await fileToDataURL(file)}">`;
  });

  document.getElementById("imgModalCancel").addEventListener("click", closeModal);
  document.getElementById("imgModalSave").addEventListener("click", async () => {
    const errorEl = document.getElementById("imgModalError");
    const file = fileInputEl.files[0];
    const tema = document.getElementById("imgTemaInput").value.trim();
    const copyout = document.getElementById("imgCopyInput").value.trim();
    const hora = document.getElementById("imgHoraInput").value || "10:00";

    if (!file) {
      errorEl.textContent = "Sube una imagen antes de continuar.";
      errorEl.classList.remove("hidden");
      return;
    }
    if (!tema) {
      errorEl.textContent = "Escribe el tema de la imagen antes de continuar.";
      errorEl.classList.remove("hidden");
      return;
    }

    const dataUrl = await fileToDataURL(file);
    addEntry({
      id: uid(),
      contentType: "imagen",
      fecha: keyToDate(key),
      hora,
      tema,
      copyout,
      imagenes: [dataUrl]
    });
    closeModal();
  });
}

// ---------- AGREGAR CARRUSEL ----------
function openCarruselModal(key) {
  showModal(`
    <h2>Agregar carrusel — ${escapeHtml(formatDateEs(keyToDate(key)))}</h2>
    <div class="modal-error hidden" id="carModalError"></div>
    <div class="modal-field">
      <label>Subir imágenes (puedes elegir varias)</label>
      <input type="file" id="carFileInput" accept="image/*" multiple>
      <div class="modal-thumbs" id="carThumbs"></div>
    </div>
    <div class="modal-field">
      <label>Tema</label>
      <input type="text" id="carTemaInput" placeholder="Ej. 5 errores que te cuestan ventas">
    </div>
    <div class="modal-field">
      <label>Copy out</label>
      <textarea id="carCopyInput" placeholder="Pega aquí el copy out de este carrusel..."></textarea>
    </div>
    <div class="modal-field">
      <label>Hora de publicación</label>
      <input type="time" id="carHoraInput" value="${lastHoraUsada()}">
    </div>
    <div class="modal-actions">
      <button type="button" class="btn-ghost" id="carModalCancel">Cancelar</button>
      <button type="button" class="btn-primary" id="carModalSave">Agregar al calendario</button>
    </div>
  `);

  const fileInputEl = document.getElementById("carFileInput");
  const thumbsEl = document.getElementById("carThumbs");
  fileInputEl.addEventListener("change", async () => {
    thumbsEl.innerHTML = "";
    const files = Array.from(fileInputEl.files || []);
    for (const file of files) {
      thumbsEl.insertAdjacentHTML("beforeend", `<img class="modal-thumb" src="${await fileToDataURL(file)}">`);
    }
  });

  document.getElementById("carModalCancel").addEventListener("click", closeModal);
  document.getElementById("carModalSave").addEventListener("click", async () => {
    const errorEl = document.getElementById("carModalError");
    const files = Array.from(fileInputEl.files || []);
    const tema = document.getElementById("carTemaInput").value.trim();
    const copyout = document.getElementById("carCopyInput").value.trim();
    const hora = document.getElementById("carHoraInput").value || "10:00";

    if (files.length === 0) {
      errorEl.textContent = "Sube al menos una imagen antes de continuar.";
      errorEl.classList.remove("hidden");
      return;
    }
    if (!tema) {
      errorEl.textContent = "Escribe el tema del carrusel antes de continuar.";
      errorEl.classList.remove("hidden");
      return;
    }

    const imagenes = [];
    for (const file of files) imagenes.push(await fileToDataURL(file));

    addEntry({
      id: uid(),
      contentType: "carrusel",
      fecha: keyToDate(key),
      hora,
      tema,
      copyout,
      imagenes
    });
    closeModal();
  });
}

// ---------- EDITAR / ELIMINAR UNA TARJETA YA PROGRAMADA ----------
function openEditEntryModal(id) {
  const entry = state.schedule.find(e => e.id === id);
  if (!entry) return;

  const temaField = `
    <div class="modal-field">
      <label>Tema</label>
      <input type="text" id="editTemaInput" value="${escapeAttr(entry.tema || "")}">
    </div>
  `;

  let bodyExtra = "";
  if (entry.contentType === "reel") {
    bodyExtra = `
      ${temaField}
      <div class="modal-field">
        <label>Copy out</label>
        <textarea id="editCopyInput">${escapeHtml(entry.copyout || "")}</textarea>
      </div>
    `;
  } else {
    const thumbs = (entry.imagenes || []).map(src => `<img class="modal-thumb" src="${src}">`).join("");
    bodyExtra = `
      <div class="modal-field">
        <label>Imágenes actuales</label>
        <div class="modal-thumbs">${thumbs}</div>
        <label style="margin-top:10px;">Reemplazar imagen${entry.contentType === "carrusel" ? "es" : ""} (opcional)</label>
        <input type="file" id="editFileInput" accept="image/*" ${entry.contentType === "carrusel" ? "multiple" : ""}>
      </div>
      ${temaField}
      <div class="modal-field">
        <label>Copy out</label>
        <textarea id="editCopyInput">${escapeHtml(entry.copyout || "")}</textarea>
      </div>
    `;
  }

  showModal(`
    <h2>${escapeHtml(entryLabel(entry))}</h2>
    <p class="hint" style="margin-bottom:14px;">${escapeHtml(formatDateEs(entry.fecha))}</p>
    ${bodyExtra}
    <div class="modal-field">
      <label>Hora de publicación</label>
      <input type="time" id="editHoraInput" value="${entry.hora}">
    </div>
    <div class="modal-actions">
      <button type="button" class="btn-ghost" id="editDeleteBtn" style="color:#ff8a8a;">🗑 Eliminar</button>
      <button type="button" class="btn-primary" id="editSaveBtn">Guardar</button>
    </div>
  `);

  document.getElementById("editDeleteBtn").addEventListener("click", () => {
    closeModal();
    removeEntry(id);
  });

  document.getElementById("editSaveBtn").addEventListener("click", async () => {
    entry.hora = document.getElementById("editHoraInput").value || entry.hora;
    entry.tema = document.getElementById("editTemaInput").value.trim();
    entry.copyout = document.getElementById("editCopyInput").value;

    const fileInputEl = document.getElementById("editFileInput");
    if (fileInputEl && fileInputEl.files && fileInputEl.files.length > 0) {
      const files = Array.from(fileInputEl.files);
      const imagenes = [];
      for (const file of files) imagenes.push(await fileToDataURL(file));
      entry.imagenes = imagenes;
    }

    closeModal();
    renderStep3();
  });
}

// ---------- GUARDADO AUTOMATICO (no se pierde el avance si recargas) ----------
const SESSION_KEY = "bravoReelsSession";

function saveSession() {
  try {
    const payload = {
      currentStep: currentStepNum,
      cliente: state.cliente,
      calendarYear: state.calendarYear,
      calendarMonth: state.calendarMonth,
      schedule: state.schedule.map(e => ({ ...e, fecha: e.fecha.toISOString() }))
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn("No se pudo guardar el avance local (puede ser por el tamaño de las imágenes):", err);
  }
}

function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch (err) { /* noop */ }
}

function loadSession() {
  let saved;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return;
    saved = JSON.parse(raw);
  } catch (err) {
    return;
  }
  if (!saved || !saved.schedule || saved.schedule.length === 0) return;

  state.cliente = saved.cliente || "";
  state.calendarYear = saved.calendarYear ?? new Date().getFullYear();
  state.calendarMonth = saved.calendarMonth ?? new Date().getMonth();
  state.schedule = saved.schedule.map(e => ({ ...e, fecha: new Date(e.fecha) }));

  clienteInput.value = state.cliente;

  const step = Math.min(saved.currentStep || 1, 2);
  showStep(step);
}

function formatDateEs(date) {
  return `${DIA_NOMBRES[date.getDay()].slice(0, 3)} ${date.getDate()} de ${MES_NOMBRES[date.getMonth()]}`;
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ============================================================
// ENTREGA
// ============================================================
document.getElementById("downloadPdfBtn").addEventListener("click", generateClientPDF);
document.getElementById("downloadTxtBtn").addEventListener("click", generateCopyoutsTXT);
document.getElementById("downloadCalBtn").addEventListener("click", generateCalendarImage);
document.getElementById("restartBtn").addEventListener("click", restartApp);

function restartApp() {
  clienteInput.value = "";
  state.cliente = "";
  state.schedule = [];
  state.calendarYear = new Date().getFullYear();
  state.calendarMonth = new Date().getMonth();
  clearSession();
  showStep(1);
  renderStep3();
}

// ---------- PDF PARA CLIENTE (portada + una pagina por reel/imagen/carrusel) ----------
const PDF_PAGE_W = 1200;
const PDF_PAGE_H = 800;
const PDF_RED = "#FF0000";

function formatFechaLarga(date) {
  return `${date.getDate()} de ${MES_NOMBRES[date.getMonth()]} de ${date.getFullYear()}`;
}

function formatHora12(hora24) {
  if (!hora24) return "";
  const [hStr, m] = hora24.split(":");
  let h = parseInt(hStr, 10);
  const ampm = h >= 12 ? "p.m." : "a.m.";
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${ampm}`;
}

function pdfCopySize(copyout) {
  const len = (copyout || "").length;
  if (len < 280) return 15;
  if (len < 500) return 13;
  if (len < 800) return 11.5;
  return 10;
}

function pdfInfoColumnHTML(fechaTexto, horaTexto, copyout) {
  const fontSize = pdfCopySize(copyout);
  return `
    <div style="width:430px; flex-shrink:0; padding:64px 56px 100px; display:flex; flex-direction:column; box-sizing:border-box; height:100%;">
      <div style="display:flex; align-items:center; gap:16px; margin-bottom:26px;">
        <div style="width:38px;height:38px;border-radius:50%;background:#F2F2F2;display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0;">📅</div>
        <div>
          <div style="font-family:'Inter',sans-serif;font-weight:700;font-size:11px;color:${PDF_RED};letter-spacing:1.5px;">FECHA DE PUBLICACIÓN</div>
          <div style="font-family:'Inter',sans-serif;font-weight:700;font-size:21px;color:#111;">${escapeHtml(fechaTexto)}</div>
        </div>
      </div>
      <div style="display:flex; align-items:center; gap:16px; margin-bottom:26px;">
        <div style="width:38px;height:38px;border-radius:50%;background:#F2F2F2;display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0;">🕐</div>
        <div>
          <div style="font-family:'Inter',sans-serif;font-weight:700;font-size:11px;color:${PDF_RED};letter-spacing:1.5px;">HORA DE PUBLICACIÓN</div>
          <div style="font-family:'Inter',sans-serif;font-weight:700;font-size:21px;color:#111;">${escapeHtml(horaTexto)}</div>
        </div>
      </div>
      <div style="height:1px; background:#E2E2E2; margin:6px 0 26px;"></div>
      <div style="display:flex; align-items:center; gap:16px; margin-bottom:16px;">
        <div style="width:38px;height:38px;border-radius:50%;background:#F2F2F2;display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0;">✏️</div>
        <div style="font-family:'Inter',sans-serif;font-weight:700;font-size:11px;color:${PDF_RED};letter-spacing:1.5px;">COPY OUT</div>
      </div>
      <div style="font-family:'Inter',sans-serif;font-size:${fontSize}px;line-height:1.6;color:#222;white-space:pre-wrap;overflow:hidden; flex:1;">${escapeHtml(copyout || "(sin copy out)")}</div>
    </div>
  `;
}

function pdfFooterHTML(mesAnioTexto, pageNum) {
  return `
    <div style="position:absolute; left:0; right:0; bottom:0;">
      <div style="height:3px; background:${PDF_RED};"></div>
      <div style="background:#0A0A0A; padding:20px 50px; display:flex; align-items:center; justify-content:space-between;">
        <div style="font-family:'Inter',sans-serif; font-size:12px; color:#CFCFCF; letter-spacing:0.5px;">
          PROGRAMACIÓN DE CONTENIDOS <span style="color:#5A5A5A;">|</span> ${mesAnioTexto.toUpperCase()}
        </div>
        <div style="font-family:'Archivo Black',sans-serif; font-weight:900; font-size:15px; color:#fff;">
          BR<span style="color:${PDF_RED};">A</span>VO <span style="font-family:'Inter',sans-serif; font-weight:600; font-size:11px; color:#8A8A8A; letter-spacing:2px;">AGENCIA</span>
        </div>
        <div style="font-family:'JetBrains Mono',monospace; font-size:12px; color:#CFCFCF;">
          ${String(pageNum).padStart(2, "0")} <span style="color:${PDF_RED};">—</span>
        </div>
      </div>
    </div>
  `;
}

function pdfCoverBullet(icon, title, sub) {
  return `
    <div style="display:flex; align-items:center; gap:18px;">
      <div style="width:46px; height:46px; border-radius:50%; background:#0A0A0A; display:flex; align-items:center; justify-content:center; font-size:19px; flex-shrink:0;">${icon}</div>
      <div>
        <div style="font-family:'Inter',sans-serif; font-weight:700; font-size:16px; color:#111;">${title}</div>
        <div style="font-family:'Inter',sans-serif; font-size:13px; color:#6A6A6A;">${sub}</div>
      </div>
    </div>
  `;
}

function buildPdfCoverHTML(cliente, mesAnioTexto) {
  return `
    <div style="position:relative; width:${PDF_PAGE_W}px; height:${PDF_PAGE_H}px; background:radial-gradient(circle at 88% 80%, rgba(255,0,0,0.20), transparent 55%), radial-gradient(circle at 10% 0%, rgba(255,0,0,0.10), transparent 45%), #0A0A0A; font-family:'Inter',sans-serif; overflow:hidden; box-sizing:border-box; display:flex; align-items:center;">

      <div style="position:relative; z-index:2; padding:0 90px; width:100%;">
        <div style="font-family:'Archivo Black',sans-serif; font-weight:900; font-size:64px; line-height:1.08; color:#fff;">PROGRAMACIÓN</div>
        <div style="font-family:'Archivo Black',sans-serif; font-weight:900; font-size:64px; line-height:1.08; color:${PDF_RED};">DE CONTENIDOS</div>

        <div style="width:64px; height:4px; background:${PDF_RED}; margin:28px 0 26px;"></div>

        <div style="font-family:'Inter',sans-serif; font-size:14px; color:#C9C9C9; letter-spacing:4px;">PLAN MENSUAL DE PUBLICACIONES</div>

        <div style="display:flex; gap:64px; margin-top:64px;">
          <div>
            <div style="font-family:'Inter',sans-serif; font-weight:700; font-size:11px; color:${PDF_RED}; letter-spacing:1.5px; margin-bottom:6px;">CLIENTE</div>
            <div style="font-family:'Inter',sans-serif; font-weight:700; font-size:24px; color:#fff;">${escapeHtml(cliente)}</div>
          </div>
          <div>
            <div style="font-family:'Inter',sans-serif; font-weight:700; font-size:11px; color:${PDF_RED}; letter-spacing:1.5px; margin-bottom:6px;">PERÍODO</div>
            <div style="font-family:'Inter',sans-serif; font-weight:700; font-size:24px; color:#fff;">${mesAnioTexto.toUpperCase()}</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function buildPdfReelHTML(entry, mesAnioTexto, pageNum) {
  const palabras = (entry.tema || "").trim().split(/\s+/);
  const ultima = palabras.pop() || "";
  const resto = palabras.join(" ");
  const fechaTexto = formatFechaLarga(entry.fecha);
  const horaTexto = formatHora12(entry.hora);

  return `
    <div style="position:relative; width:${PDF_PAGE_W}px; height:${PDF_PAGE_H}px; background:#fff; font-family:'Inter',sans-serif; box-sizing:border-box; display:flex;">
      <div style="flex:1; padding:28px 50px 64px; display:flex; flex-direction:column;">
        <div style="display:inline-flex; align-items:center; gap:8px; border:1.5px solid ${PDF_RED}; border-radius:6px; padding:8px 16px; align-self:flex-start;">
          <span style="color:${PDF_RED}; font-size:14px;">▶</span>
          <span style="font-family:'Inter',sans-serif; font-weight:800; font-size:13px; color:${PDF_RED}; letter-spacing:1px;">REEL</span>
        </div>
        <div style="width:30px; height:2px; background:${PDF_RED}; margin:12px 0 6px;"></div>
        <div style="font-family:'Inter',sans-serif; font-size:13px; color:#666;">Duración aprox.<br>30 - 40 seg.</div>

        <div style="flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center;">
          <div style="width:300px; height:560px; background:#000; border-radius:38px; padding:14px; box-sizing:border-box; box-shadow:0 30px 60px rgba(0,0,0,0.25);">
            <div style="width:100%; height:100%; border-radius:26px; background:radial-gradient(circle at 80% 15%, rgba(255,0,0,0.25), transparent 45%), linear-gradient(160deg, #1A1A1A 0%, #050505 70%); position:relative; overflow:hidden; display:flex; flex-direction:column; justify-content:center; padding:30px; box-sizing:border-box;">
              <div style="position:absolute; top:18px; left:18px; width:60px; height:60px; background-image:radial-gradient(circle, #444 1.4px, transparent 1.4px); background-size:10px 10px; opacity:0.5;"></div>
              <div style="position:absolute; bottom:-40px; right:-40px; width:150px; height:150px; border-radius:50%; background:${PDF_RED}; opacity:0.85;"></div>
              <div style="font-family:'Inter',sans-serif; font-weight:700; font-size:11px; color:${PDF_RED}; letter-spacing:2px; margin-bottom:14px;">TÍTULO DEL REEL</div>
              <div style="font-family:'Archivo Black',sans-serif; font-weight:900; font-size:27px; line-height:1.18; color:#fff;">
                ${escapeHtml(resto)} <span style="background:${PDF_RED}; padding:3px 10px; display:inline-block;">${escapeHtml(ultima)}</span>
              </div>
              <div style="position:absolute; bottom:26px; left:30px; font-family:'Archivo Black',sans-serif; font-weight:900; font-size:15px; color:#fff;">BR<span style="color:${PDF_RED};">A</span>VO<span style="font-family:'Inter',sans-serif; font-size:8px; color:#999; letter-spacing:2px; margin-left:4px;">AGENCIA</span></div>
            </div>
          </div>
          <div style="width:300px; margin-top:8px; text-align:center;">
            <div style="font-family:'Inter',sans-serif; font-weight:700; font-size:9px; color:#9A9A9A; letter-spacing:1px; text-transform:uppercase;">Tema del Reel</div>
            <div style="font-family:'Inter',sans-serif; font-size:10px; color:#6A6A6A; margin-top:2px;">${escapeHtml(entry.tema || "")}</div>
            <div style="font-family:'Inter',sans-serif; font-size:8.5px; color:#AFAFAF; margin-top:5px; line-height:1.3; font-style:italic;">Nota: el video editado se enviará por WhatsApp para que puedan verlo en la mejor calidad antes de su publicación.</div>
          </div>
        </div>
      </div>

      ${pdfInfoColumnHTML(fechaTexto, horaTexto, entry.copyout)}
      ${pdfFooterHTML(mesAnioTexto, pageNum)}
    </div>
  `;
}

function fitBox4x5(maxW, maxH) {
  const ratio = 4 / 5; // ancho / alto
  let w = maxW;
  let h = w / ratio;
  if (h > maxH) {
    h = maxH;
    w = h * ratio;
  }
  return { w, h };
}

function buildPdfImagenHTML(entry, mesAnioTexto, pageNum) {
  const fechaTexto = formatFechaLarga(entry.fecha);
  const horaTexto = formatHora12(entry.hora);
  const box = fitBox4x5(670, 656);
  return `
    <div style="position:relative; width:${PDF_PAGE_W}px; height:${PDF_PAGE_H}px; background:#fff; font-family:'Inter',sans-serif; box-sizing:border-box; display:flex;">
      <div style="flex:1; padding:64px 50px; display:flex; align-items:center; justify-content:center;">
        <div style="border:2px solid ${PDF_RED}; border-radius:4px; padding:6px; width:${box.w}px; height:${box.h}px; box-sizing:border-box;">
          <img src="${entry.imagenes[0]}" style="width:100%; height:100%; object-fit:cover; border-radius:2px; display:block;">
        </div>
      </div>
      ${pdfInfoColumnHTML(fechaTexto, horaTexto, entry.copyout)}
      ${pdfFooterHTML(mesAnioTexto, pageNum)}
    </div>
  `;
}

function computeCarruselGrid(count, areaW, areaH, gap) {
  const maxCols = Math.min(count, 5);
  let best = null;
  for (let cols = 1; cols <= maxCols; cols++) {
    const rows = Math.ceil(count / cols);
    const cellW = (areaW - gap * (cols - 1)) / cols;
    const cellH = cellW * 1.25; // proporcion 4:5
    const totalH = cellH * rows + gap * (rows - 1);
    best = { cols, cellW, cellH };
    if (totalH <= areaH) break;
  }
  return best;
}

function buildPdfCarruselHTML(entry, mesAnioTexto, pageNum) {
  const imgs = entry.imagenes || [];
  const fechaTexto = formatFechaLarga(entry.fecha);
  const horaTexto = formatHora12(entry.hora);
  const gap = 12;
  const grid = computeCarruselGrid(imgs.length, 670, 600, gap);

  const thumbs = imgs.map(src => `
    <div style="width:${grid.cellW}px; height:${grid.cellH}px; background:#000; border-radius:6px; overflow:hidden;">
      <img src="${src}" style="width:100%; height:100%; object-fit:cover; display:block;">
    </div>
  `).join("");

  return `
    <div style="position:relative; width:${PDF_PAGE_W}px; height:${PDF_PAGE_H}px; background:#fff; font-family:'Inter',sans-serif; box-sizing:border-box; display:flex;">
      <div style="flex:1; padding:54px 50px 0; display:flex; flex-direction:column;">
        <div style="display:inline-flex; align-self:flex-start; background:#0A0A0A; color:#fff; font-family:'Inter',sans-serif; font-weight:700; font-size:12px; letter-spacing:1px; padding:9px 16px; border-radius:5px; margin-bottom:18px;">
          CARRUSEL (${imgs.length} IMÁGENES)
        </div>
        <div style="display:flex; flex-wrap:wrap; gap:${gap}px;">
          ${thumbs}
        </div>
      </div>
      ${pdfInfoColumnHTML(fechaTexto, horaTexto, entry.copyout)}
      ${pdfFooterHTML(mesAnioTexto, pageNum)}
    </div>
  `;
}

function waitForImages(container) {
  const imgs = Array.from(container.querySelectorAll("img"));
  return Promise.all(imgs.map(img => {
    if (img.complete) return Promise.resolve();
    return new Promise(resolve => {
      img.onload = resolve;
      img.onerror = resolve;
    });
  }));
}

async function renderPdfPage(doc, html, isFirstPage) {
  const target = document.getElementById("calendarRenderTarget");
  target.style.width = `${PDF_PAGE_W}px`;
  target.innerHTML = html;
  await new Promise(r => setTimeout(r, 80));
  await waitForImages(target);

  const canvas = await html2canvas(target, {
    width: PDF_PAGE_W,
    height: PDF_PAGE_H,
    scale: 2,
    backgroundColor: "#FFFFFF",
    useCORS: true
  });
  const imgData = canvas.toDataURL("image/jpeg", 0.92);

  if (!isFirstPage) doc.addPage([PDF_PAGE_W, PDF_PAGE_H], "landscape");
  doc.addImage(imgData, "JPEG", 0, 0, PDF_PAGE_W, PDF_PAGE_H);
}

async function generateClientPDF() {
  if (state.schedule.length === 0) {
    alert("Todavía no has programado ningún reel, imagen o carrusel en el calendario.");
    return;
  }

  const btn = document.getElementById("downloadPdfBtn");
  const originalLabel = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Generando PDF...";

  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "pt", format: [PDF_PAGE_W, PDF_PAGE_H], orientation: "landscape" });

    const sorted = [...state.schedule].sort((a, b) => {
      const diff = a.fecha - b.fecha;
      if (diff !== 0) return diff;
      return (a.hora || "").localeCompare(b.hora || "");
    });

    const mesAnioTexto = `${capitalize(MES_NOMBRES[sorted[0].fecha.getMonth()])} ${sorted[0].fecha.getFullYear()}`;

    await renderPdfPage(doc, buildPdfCoverHTML(state.cliente, mesAnioTexto), true);

    for (let i = 0; i < sorted.length; i++) {
      const entry = sorted[i];
      const pageNum = i + 2;
      let html;
      if (entry.contentType === "reel") html = buildPdfReelHTML(entry, mesAnioTexto, pageNum);
      else if (entry.contentType === "imagen") html = buildPdfImagenHTML(entry, mesAnioTexto, pageNum);
      else html = buildPdfCarruselHTML(entry, mesAnioTexto, pageNum);
      await renderPdfPage(doc, html, false);
    }

    doc.save(`Programacion_${slugify(state.cliente)}.pdf`);
  } catch (err) {
    console.error(err);
    alert(`Ocurrió un error generando el PDF: ${err.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = originalLabel;
  }
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

// ---------- TXT (para copiar/pegar en Meta, conserva emojis) ----------
function generateCopyoutsTXT() {
  if (state.schedule.length === 0) {
    alert("Todavía no has agregado ningún reel, imagen o carrusel.");
    return;
  }

  const sorted = [...state.schedule].sort((a, b) => {
    const diff = a.fecha - b.fecha;
    if (diff !== 0) return diff;
    return (a.hora || "").localeCompare(b.hora || "");
  });

  const lines = [];
  lines.push(`PROGRAMACIÓN DE CONTENIDO - ${state.cliente}`.toUpperCase());
  lines.push("Contenido preparado para publicación en redes sociales.");
  lines.push("");

  sorted.forEach(entry => {
    lines.push("================================");
    lines.push(`${entry.contentType.toUpperCase()} · ${formatDateEs(entry.fecha)} · ${entry.hora}`);
    lines.push(`Tema: ${entry.tema || ""}`);
    lines.push("");
    lines.push(entry.copyout || "");
    lines.push("");
  });

  const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Copyouts_${slugify(state.cliente)}.txt`;
  a.click();
  URL.revokeObjectURL(url);
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
        ${day.items.map(item => {
          const esReel = item.contentType === "reel";
          const colorBorde = esReel ? "#FF0000" : "#5A5A5A";
          const colorTag = esReel ? "#FF0000" : "#8A8A8A";
          const etiqueta = `${item.contentType.toUpperCase()} · ${item.hora}`;
          const titulo = entryLabel(item);
          return `
          <div style="background:#141414; border:1px solid #2A2A2A; border-left:3px solid ${colorBorde}; border-radius:5px; padding:14px 18px; display:flex; justify-content:space-between; align-items:center; gap:16px;">
            <div>
              <div style="font-family:'JetBrains Mono',monospace; font-size:11px; color:${colorTag}; letter-spacing:1px; margin-bottom:4px;">${etiqueta}</div>
              <div style="font-family:'Inter',sans-serif; font-size:15px; color:#F5F5F5; font-weight:600;">${escapeHtml(titulo)}</div>
            </div>
          </div>
        `;
        }).join("")}
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

// ============================================================
// AL CARGAR LA PAGINA: mostrar el calendario directamente
// (vacío, o recuperando el avance guardado si existe)
// ============================================================
loadSession();
renderStep3();
