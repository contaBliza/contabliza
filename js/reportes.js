const kIng = document.getElementById("kpiIngresos");
    const kEgr = document.getElementById("kpiEgresos");
    const kRes = document.getElementById("kpiResultado");
    const kpiHint = document.getElementById("kpiHint");
    const kpiTabUYU = document.getElementById("kpiTabUYU");
    const kpiTabUSD = document.getElementById("kpiTabUSD");
    const periodoSelect = document.getElementById("periodoSelect");
    const desdeInput = document.getElementById("desde");
    const hastaInput = document.getElementById("hasta");
    const btnAplicar = document.getElementById("btnAplicar");
    const btnLimpiar = document.getElementById("btnLimpiar");
    const btnPdf = document.getElementById("btnPdf");
    const btnExcel = document.getElementById("btnExcel");
    const filtersSummarySub = document.getElementById("filtersSummarySub");
    const categoriaSelect = document.getElementById("categoriaSelect");
    const monedaSelect = document.getElementById("monedaSelect");
    const medioSelect = document.getElementById("medioSelect");
    const reportHint = document.getElementById("reportHint");
    const pieCanvas = document.getElementById("reportPieChart");
    const pieEmpty = document.getElementById("pieEmpty");
    const pieBreakdown = document.getElementById("pieBreakdown");
    const pieDotIngresos = document.getElementById("pieDotIngresos");
    const pieDotGastos = document.getElementById("pieDotGastos");
    const cmpCategoriaSelect = document.getElementById("cmpCategoriaSelect");
    const cmpMesASelect = document.getElementById("cmpMesASelect");
    const cmpAnioASelect = document.getElementById("cmpAnioASelect");
    const cmpMesBSelect = document.getElementById("cmpMesBSelect");
    const cmpAnioBSelect = document.getElementById("cmpAnioBSelect");
    const cmpCanvas = document.getElementById("cmpBarChart");
    const cmpEmpty = document.getElementById("cmpEmpty");
    const cmpLegend = document.getElementById("cmpLegend");
    const cmpFocusIngresos = document.getElementById("cmpFocusIngresos");
    const cmpFocusGastos = document.getElementById("cmpFocusGastos");
    const cmpFocusResultado = document.getElementById("cmpFocusResultado");
    const cmpMeta = document.getElementById("cmpMeta");
    const cmpHover = document.getElementById("cmpHover");
    const cmpTouchDetail = document.getElementById("cmpTouchDetail");
    const cmpDelta = document.getElementById("cmpDelta");
    const cmpInsight = document.getElementById("cmpInsight");
    let pieChart = null;
    let cmpChart = null;
    let pieActiveIndex = null;
    let lastPieState = null;
    let cmpFallbackRegions = [];
    let cmpSelectedIndex = null;
    let cmpSelectionState = null;

    function fmtMoney(n, moneda){
      const value = Number(n || 0);
      const m = moneda || "UYU";
      try{
        return new Intl.NumberFormat("es-UY", {
          style: "currency",
          currency: m
        }).format(value);
      }catch{
        return value.toLocaleString("es-UY");
      }
    }

    function escapeHtml(str){
      return String(str ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    function getDateISO(d){
      const y = d.getFullYear();
      const m = String(d.getMonth()+1).padStart(2,"0");
      const day = String(d.getDate()).padStart(2,"0");
      return `${y}-${m}-${day}`;
    }

    function fmtDateShort(iso){
      if(!iso) return "";
      const parts = String(iso).split("-");
      if(parts.length !== 3) return iso;
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }

    function updateRangoVisibility(){
      const isRango = periodoSelect.value === "rango";
      desdeInput.style.display = isRango ? "block" : "none";
      hastaInput.style.display = isRango ? "block" : "none";
    }

    function getFiltroFechas(){
      const now = new Date();
      const mode = periodoSelect.value;

      if(mode === "todo") return { desde:null, hasta:null };

      if(mode === "semana"){
        const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const start = new Date(end);
        start.setDate(end.getDate() - 6);
        return { desde: getDateISO(start), hasta: getDateISO(end) };
      }

      if(mode === "mes"){
        const first = new Date(now.getFullYear(), now.getMonth(), 1);
        const last  = new Date(now.getFullYear(), now.getMonth()+1, 0);
        return { desde: getDateISO(first), hasta: getDateISO(last) };
      }

      if(mode === "anio"){
        const first = new Date(now.getFullYear(), 0, 1);
        const last  = new Date(now.getFullYear(), 11, 31);
        return { desde: getDateISO(first), hasta: getDateISO(last) };
      }

      return { desde: desdeInput.value || null, hasta: hastaInput.value || null };
    }

    function inRangeISO(fechaISO, desdeISO, hastaISO){
      if(desdeISO && fechaISO < desdeISO) return false;
      if(hastaISO && fechaISO > hastaISO) return false;
      return true;
    }

    function getMovimientosSafe(){
      if(typeof listMovimientosSortedDesc === "function") return listMovimientosSortedDesc();
      if(typeof getMovimientos === "function") return getMovimientos();
      return [];
    }

    function getSessionSafe(){
      try{
        const raw = localStorage.getItem("contabliza_session") || sessionStorage.getItem("contabliza_session_temp");
        if(raw) return JSON.parse(raw);
      }catch{}
      if(typeof getSession === "function") return getSession();
      return null;
    }

    function getActiveCurrency(){
      return kpiCurrency === "USD" ? "USD" : "UYU";
    }

    function getMediosSafe(){
      if(typeof getMedios === "function") return getMedios();
      return [
        { id: "caja", name: "Caja" },
        { id: "banco", name: "Banco" },
        { id: "tarjeta", name: "Tarjeta" }
      ];
    }

    function buildMedioFilter(){
      if(!medioSelect) return;
      const current = medioSelect.value || "__all__";
      const medios = getMediosSafe();
      const opts = [
        `<option value="__all__">Todas las cuentas</option>`,
        ...medios.map(m => `<option value="${m.id}">${m.name}</option>`)
      ];
      medioSelect.innerHTML = opts.join("");
      if(Array.from(medioSelect.options).some(o => o.value === current)){
        medioSelect.value = current;
      }
    }

    function getMedioLabel(id){
      if(id === "__all__") return "Todas las cuentas";
      const list = getMediosSafe();
      const found = list.find(m => String(m.id) === String(id));
      return found ? found.name : "Cuenta";
    }

    function getCategoriasFromMovs(movs){
      const list = movs.map(m => String(m.categoria || "").trim()).filter(Boolean);
      const set = new Set(list);
      return Array.from(set).sort((a,b) => a.localeCompare(b));
    }

    function buildCategoriaFilter(movs, scope = null){
      if(!categoriaSelect) return;
      const current = categoriaSelect.value || "__all__";
      const list = scope ? movs.filter(scope) : movs;
      const cats = getCategoriasFromMovs(list);
      const hasNone = list.some(m => !m.categoria);
      const opts = [
        `<option value="__all__">Todas las categorías</option>`,
        ...(hasNone ? [`<option value="__none__">Sin categoría</option>`] : []),
        ...cats.map(c => `<option value="${c}">${c}</option>`)
      ];
      categoriaSelect.innerHTML = opts.join("");
      if(Array.from(categoriaSelect.options).some(o => o.value === current)){
        categoriaSelect.value = current;
      }
    }

    function calcIngresosEgresos(monedaFilter){
      const movs = getMovimientosSafe();
      buildMedioFilter();
      const { desde, hasta } = getFiltroFechas();
      const catVal = categoriaSelect ? categoriaSelect.value : "__all__";
      const monedaVal = monedaFilter || "UYU";
      const medioVal = medioSelect ? medioSelect.value : "__all__";
      buildCategoriaFilter(movs, (m) => {
        if(medioVal !== "__all__" && String(m.medioId || "") !== String(medioVal)) return false;
        if(monedaVal !== "__all__" && String(m.moneda || "") !== String(monedaVal)) return false;
        if(m.fecha && !inRangeISO(m.fecha, desde, hasta)) return false;
        if(!m.fecha && (desde || hasta)) return false;
        return true;
      });

      let ingresos = 0;
      let egresos = 0;

      for(const m of movs){
        if(m.fecha && !inRangeISO(m.fecha, desde, hasta)) continue;
        if(!m.fecha && (desde || hasta)) continue;
        if(catVal !== "__all__"){
          if(catVal === "__none__" && m.categoria) continue;
          if(catVal !== "__none__" && String(m.categoria || "") !== String(catVal)) continue;
        }
        if(monedaVal !== "__all__" && String(m.moneda || "") !== String(monedaVal)) continue;
        if(medioVal !== "__all__" && String(m.medioId || "") !== String(medioVal)) continue;

        const monto = Number(m.monto || 0);
        if(m.tipo === "ingreso") ingresos += monto;
        if(m.tipo === "egreso") egresos += monto;
      }

      return { ingresos, egresos, resultado: ingresos - egresos };
    }

    function filterMovsForSummary(monedaVal, medioVal, catVal, desde, hasta){
      const movs = getMovimientosSafe();
      return movs.filter(m => {
        if(m.fecha && !inRangeISO(m.fecha, desde, hasta)) return false;
        if(!m.fecha && (desde || hasta)) return false;
        if(monedaVal && String(m.moneda || "") !== String(monedaVal)) return false;
        if(medioVal && medioVal !== "__all__" && String(m.medioId || "") !== String(medioVal)) return false;
        if(catVal !== "__all__"){
          if(catVal === "__none__" && m.categoria) return false;
          if(catVal !== "__none__" && String(m.categoria || "") !== String(catVal)) return false;
        }
        return true;
      });
    }

    function buildCsv(rows){
      return rows.map(r =>
        r.map(v => {
          const s = (v === null || v === undefined) ? "" : String(v);
          if(/[",\n]/.test(s)) return `"${s.replace(/"/g,'""')}"`;
          return s;
        }).join(",")
      ).join("\n");
    }

    function buildExcelRowsForCurrency(moneda){
      const medioVal = medioSelect ? medioSelect.value : "__all__";
      const catVal = categoriaSelect ? categoriaSelect.value : "__all__";
      const { desde, hasta } = getFiltroFechas();

      const movs = filterMovsForSummary(moneda, medioVal, catVal, desde, hasta);
      const ingresos = movs.filter(m => m.tipo === "ingreso").reduce((a,b) => a + Number(b.monto || 0), 0);
      const egresos = movs.filter(m => m.tipo === "egreso").reduce((a,b) => a + Number(b.monto || 0), 0);
      const balance = ingresos - egresos;

      const byMedio = calcByMedio(movs);
      const medios = getMediosSafe();
      const cuentas = (medioVal === "__all__")
        ? medios.map(m => ({ nombre: m.name, monto: byMedio.get(String(m.id)) || 0 }))
        : [{ nombre: getMedioLabel(medioVal), monto: byMedio.get(String(medioVal)) || 0 }];

      const byCat = new Map();
      for(const m of movs){
        const cat = m.categoria || "Sin categoría";
        const sign = m.tipo === "ingreso" ? 1 : -1;
        byCat.set(cat, (byCat.get(cat) || 0) + sign * Number(m.monto || 0));
      }

      const rows = [];
      rows.push(["Resumen"]);
      rows.push(["Periodo", getPeriodoLabelForPdf()]);
      rows.push(["Moneda", moneda]);
      rows.push(["Cuenta", getMedioLabel(medioVal)]);
      rows.push(["Categoría", (catVal === "__all__") ? "Todas" : (catVal === "__none__" ? "Sin categoría" : catVal)]);
      rows.push([]);
      rows.push(["Totales"]);
      rows.push(["Ingresos", ingresos]);
      rows.push(["Gastos", -Math.abs(egresos)]);
      rows.push(["Balance", balance]);
      rows.push([]);
      rows.push(["Detalle por cuenta"]);
      rows.push(["Cuenta", "Balance"]);
      cuentas.forEach(c => rows.push([c.nombre, c.monto]));
      rows.push([]);
      rows.push(["Detalle por categoría"]);
      rows.push(["Categoría", "Balance"]);
      Array.from(byCat.entries()).forEach(([k,v]) => rows.push([k, v]));
      rows.push([]);
      rows.push(["Movimientos"]);
      rows.push(["Fecha","Tipo","Concepto","Cuenta","Categoría","Monto","Moneda"]);
      movs.forEach(m => {
        const signedMonto = m.tipo === "egreso" ? -Math.abs(Number(m.monto || 0)) : Math.abs(Number(m.monto || 0));
        rows.push([m.fecha || "", m.tipo || "", m.concepto || "", getMedioLabel(m.medioId), m.categoria || "", signedMonto, m.moneda || ""]);
      });
      return rows;
    }

    function exportExcelResumen(){
      if(typeof XLSX === "undefined"){
        alert("No se encontró la librería para exportar a Excel.");
        return;
      }

      const wb = XLSX.utils.book_new();
      ["UYU", "USD"].forEach((moneda) => {
        const rows = buildExcelRowsForCurrency(moneda);
        const ws = XLSX.utils.aoa_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, moneda);
      });
      XLSX.writeFile(wb, "contabliza-resumen.xlsx");
    }

    function monthRange(date){
      const y = date.getFullYear();
      const m = date.getMonth();
      const first = new Date(y, m, 1);
      const last = new Date(y, m + 1, 0);
      return { desde: getDateISO(first), hasta: getDateISO(last) };
    }

    function calcByMedio(movs){
      const map = new Map();
      for(const m of movs){
        const key = String(m.medioId || "");
        const sign = m.tipo === "ingreso" ? 1 : -1;
        const val = sign * Number(m.monto || 0);
        map.set(key, (map.get(key) || 0) + val);
      }
      return map;
    }

    function fmtDateHuman(d){
      return fmtDateShort(getDateISO(d));
    }

    function getPeriodoPhraseShort(){
      const periodLabel = periodoSelect ? periodoSelect.value : "mes";
      if(periodLabel === "semana") return "esta semana";
      if(periodLabel === "mes") return "este mes";
      if(periodLabel === "anio") return "este año";
      if(periodLabel === "todo") return "en todo el período";
      return "en este período";
    }

    function getPeriodoSummaryLabel(){
      const periodLabel = periodoSelect ? periodoSelect.value : "mes";
      if(periodLabel === "semana") return "Últimos 7 días";
      if(periodLabel === "mes") return "Mes actual";
      if(periodLabel === "anio") return "Año actual";
      if(periodLabel === "todo") return "Histórico";
      if(periodLabel === "rango") return "Rango personalizado";
      return "Período";
    }

    function buildPdfHtml(data){
      const { nombre, fecha, moneda, periodo, cuentas, ingresos, egresos, balance, statusText, catLabel, medioLabel, topExpenses, gastoPct, ahorroPct } = data;
      const resultClass = balance >= 0 ? "result pos" : "result neg";
      const ingresoSafe = Math.max(Number(ingresos || 0), 0);
      const egresoSafe = Math.max(Number(egresos || 0), 0);
      const totalChart = Math.max(ingresoSafe + egresoSafe, 1);
      const ingresoDeg = Math.round((ingresoSafe / totalChart) * 360);
      const ahorroLabel = balance >= 0 ? "Ahorraste" : "Tu balance quedó";
      const ahorroValue = balance >= 0 ? `${ahorroPct}%` : `${Math.round((Math.abs(balance) / Math.max(ingresoSafe, 1)) * 100)}%`;
      const summaryTone = balance >= 0 ? "#1f8b4c" : "#c55248";

      const visibleCuentas = (cuentas || []).filter(c => Math.abs(Number(c.monto || 0)) > 0.0001).slice(0, 4);
      const cuentasItems = visibleCuentas.map((c, index) => {
        const icons = ["🏦", "💵", "💳", "📁"];
        return `
          <div class="list-item">
            <div class="list-icon">${icons[index % icons.length]}</div>
            <div class="list-copy">
              <div class="list-title">${c.nombre}</div>
            </div>
            <div class="list-value">${fmtMoney(c.monto, moneda)}</div>
          </div>
        `;
      }).join("");

      const expensesItems = (topExpenses || []).length
        ? topExpenses.map((item, index) => {
            const icons = ["🛒", "🚗", "🍽️", "📦"];
            return `
              <div class="list-item">
                <div class="list-icon">${icons[index % icons.length]}</div>
                <div class="list-copy">
                  <div class="list-title">${item.label}</div>
                </div>
                <div class="list-value">${fmtMoney(item.monto, moneda)}</div>
              </div>
            `;
          }).join("")
        : `<div class="empty-mini">No hubo gastos relevantes en el período.</div>`;

      return [
        "<!doctype html>",
        "<html lang=\"es\">",
        "<head>",
        "  <meta charset=\"utf-8\"/>",
        "  <title>Resumen financiero personal</title>",
        "  <style>",
        "    *{ box-sizing:border-box; }",
        "    body{ margin:0; font-family: Arial, Helvetica, sans-serif; background:#eef3fb; padding:10px; color:#213547; }",
        "    .page{ max-width:780px; margin:0 auto; background:#fff; border:1px solid #dfe6f1; box-shadow:0 12px 28px rgba(31,95,191,.10); border-radius:14px; padding:20px 18px 16px; }",
        "    .brand{ text-align:center; font-size:26px; font-weight:800; color:#2b63d9; line-height:1; }",
        "    .brand span{ color:#22a24a; }",
        "    .title{ text-align:center; font-size:21px; font-weight:800; margin:12px 0 2px; color:#1e2b4d; }",
        "    .subtitle{ text-align:center; font-size:13px; color:#5d7083; margin-bottom:14px; }",
        "    .meta{ display:flex; flex-wrap:wrap; gap:10px 18px; justify-content:center; border-top:1px solid #e7edf6; border-bottom:1px solid #e7edf6; padding:10px 0; font-size:13px; color:#405469; }",
        "    .meta strong{ color:#223652; }",
        "    .period{ text-align:center; font-size:13px; color:#334960; font-weight:700; margin:10px 0 14px; }",
        "    .result{ border-radius:12px; padding:14px 16px; text-align:center; color:#fff; font-weight:800; margin-bottom:14px; }",
        "    .result.pos{ background:linear-gradient(135deg, #1f9a49, #2eb65d); }",
        "    .result.neg{ background:linear-gradient(135deg, #c9473d, #de655a); }",
        "    .result-label{ font-size:14px; letter-spacing:.04em; }",
        "    .result-value{ font-size:28px; margin-top:6px; }",
        "    .grid{ display:grid; grid-template-columns: 1.2fr .9fr; gap:12px; margin-bottom:12px; }",
        "    .grid-2{ display:grid; grid-template-columns: 1fr 1fr; gap:12px; margin-bottom:12px; }",
        "    .card{ border:1px solid #dfe7f2; border-radius:12px; padding:12px 14px; background:#fff; }",
        "    .card-title{ font-size:14px; font-weight:800; color:#213b7a; margin-bottom:10px; }",
        "    .chart-wrap{ display:grid; grid-template-columns: 194px 1fr; align-items:center; gap:14px; }",
        `    .donut{ width:166px; height:166px; margin:0 auto; border-radius:50%; background:conic-gradient(#1fb357 0 ${ingresoDeg}deg, #e2403d ${ingresoDeg}deg 360deg); position:relative; }`,
        "    .donut::after{ content:''; position:absolute; inset:40px; background:#fff; border-radius:50%; box-shadow:inset 0 1px 0 rgba(255,255,255,.9); }",
        "    .donut-center{ position:absolute; inset:0; display:grid; place-items:center; text-align:center; z-index:1; font-weight:800; color:#22374d; }",
        "    .donut-center > div{ width:70px; }",
        "    .donut-center small{ display:block; font-size:11px; color:#6a7a8a; font-weight:700; margin-bottom:4px; }",
        "    .donut-total{ font-size:10px; line-height:1.08; letter-spacing:-0.01em; word-break:break-word; }",
        "    .legend-item{ display:flex; align-items:flex-start; gap:10px; margin-bottom:12px; }",
        "    .legend-dot{ width:14px; height:14px; border-radius:50%; margin-top:3px; }",
        "    .legend-copy{ flex:1; }",
        "    .legend-name{ font-size:13px; font-weight:800; color:#263a52; }",
        "    .legend-value{ font-size:13px; font-weight:800; color:#263a52; margin-top:3px; }",
        "    .legend-sub{ font-size:12px; color:#6b7c8d; margin-top:2px; }",
        "    .metric{ display:flex; align-items:center; gap:12px; padding:12px; border-radius:12px; background:#f7f9fc; border:1px solid #ebf0f6; }",
        "    .metric + .metric{ margin-top:10px; }",
        "    .metric-icon{ width:42px; height:42px; border-radius:50%; display:grid; place-items:center; font-size:18px; font-weight:800; }",
        "    .metric-icon.exp{ background:rgba(229,64,61,.12); color:#d94442; }",
        "    .metric-icon.save{ background:rgba(31,179,87,.12); color:#1f8b4c; }",
        "    .metric-value{ font-size:20px; font-weight:800; color:#1e2b4d; min-width:54px; }",
        "    .metric-copy{ font-size:13px; color:#4d6278; line-height:1.3; }",
        "    .list-item{ display:grid; grid-template-columns: 34px 1fr auto; align-items:center; gap:10px; padding:10px 0; border-bottom:1px solid #edf2f7; }",
        "    .list-item:last-child{ border-bottom:none; }",
        "    .list-icon{ width:34px; height:34px; border-radius:10px; display:grid; place-items:center; background:#eef4ff; font-size:17px; }",
        "    .list-title{ font-size:13px; font-weight:800; color:#23374d; }",
        "    .list-value{ font-size:13px; font-weight:800; color:#23374d; white-space:nowrap; }",
        "    .empty-mini{ color:#6b7c8d; font-size:13px; padding:10px 0; }",
        "    .summary{ border:1px solid #d7e5fb; background:#edf5ff; border-radius:12px; padding:12px 14px; color:#314960; font-size:13px; line-height:1.45; }",
        `    .summary b:last-child{ color:${summaryTone}; }`,
        "    .footer{ margin-top:10px; padding-top:10px; border-top:1px solid #e9eef6; text-align:center; font-size:12px; color:#7b8794; }",
        "  </style>",
        "</head>",
        "<body>",
        "  <div class=\"page\">",
        "    <div class=\"brand\">Conta<span>Bliza</span></div>",
        "    <div class=\"title\">Mi Balance</div>",
        "    <div class=\"subtitle\">Resumen financiero personal</div>",
        "    <div class=\"meta\">",
        `      <div><strong>Nombre:</strong> ${nombre}</div>`,
        `      <div><strong>Fecha:</strong> ${fecha}</div>`,
        `      <div><strong>Moneda:</strong> ${moneda}</div>`,
        `      <div><strong>Cuenta:</strong> ${medioLabel}</div>`,
        `      <div><strong>Categoría:</strong> ${catLabel}</div>`,
        "    </div>",
        `    <div class=\"period\">Período: ${periodo}</div>`,
        `    <div class=\"result ${resultClass}\">`,
        "      <div class=\"result-label\">RESULTADO DEL PERÍODO</div>",
        `      <div class=\"result-value\">${fmtMoney(balance, moneda)}</div>`,
        "    </div>",
        "    <div class=\"grid\">",
        "      <div class=\"card\">",
        "        <div class=\"card-title\">Ingresos vs Gastos</div>",
        "        <div class=\"chart-wrap\">",
        "          <div class=\"donut\">",
        "            <div class=\"donut-center\">",
        "              <div>",
        "                <small>Total</small>",
        `                <div class=\"donut-total\">${fmtMoney(ingresoSafe + egresoSafe, moneda)}</div>`,
        "              </div>",
        "            </div>",
        "          </div>",
        "          <div>",
        "            <div class=\"legend-item\">",
        "              <span class=\"legend-dot\" style=\"background:#1fb357;\"></span>",
        "              <div class=\"legend-copy\">",
        "                <div class=\"legend-name\">Ingresos</div>",
        `                <div class=\"legend-value\">${fmtMoney(ingresoSafe, moneda)}</div>`,
        `                <div class=\"legend-sub\">${Math.round((ingresoSafe / totalChart) * 100)}% del total</div>`,
        "              </div>",
        "            </div>",
        "            <div class=\"legend-item\">",
        "              <span class=\"legend-dot\" style=\"background:#e2403d;\"></span>",
        "              <div class=\"legend-copy\">",
        "                <div class=\"legend-name\">Gastos</div>",
        `                <div class=\"legend-value\">${fmtMoney(egresoSafe, moneda)}</div>`,
        `                <div class=\"legend-sub\">${Math.round((egresoSafe / totalChart) * 100)}% del total</div>`,
        "              </div>",
        "            </div>",
        "          </div>",
        "        </div>",
        "      </div>",
        "      <div class=\"card\">",
        "        <div class=\"card-title\">Métricas del período</div>",
        "        <div class=\"metric\">",
        "          <div class=\"metric-icon exp\">%</div>",
        `          <div class=\"metric-value\">${gastoPct}%</div>`,
        "          <div class=\"metric-copy\">Tus gastos representan ese porcentaje sobre tus ingresos.</div>",
        "        </div>",
        "        <div class=\"metric\">",
        "          <div class=\"metric-icon save\">$</div>",
        `          <div class=\"metric-value\">${ahorroValue}</div>`,
        `          <div class=\"metric-copy\">${ahorroLabel.toLowerCase()} en relación a lo que ingresó.</div>`,
        "        </div>",
        "      </div>",
        "    </div>",
        "    <div class=\"grid-2\">",
        "      <div class=\"card\">",
        "        <div class=\"card-title\">Principales gastos del período</div>",
        expensesItems,
        "      </div>",
        "      <div class=\"card\">",
        "        <div class=\"card-title\">Mis cuentas</div>",
        (cuentasItems || "<div class=\"empty-mini\">No hay cuentas con saldo para mostrar.</div>"),
        "      </div>",
        "    </div>",
        `    <div class=\"summary\"><strong>Resumen del período</strong><br>Entraron <b>${fmtMoney(ingresos, moneda)}</b> y salieron <b>${fmtMoney(egresos, moneda)}</b>. Terminaste el período con un saldo <b>${balance >= 0 ? "positivo" : "negativo"}</b> de <b>${fmtMoney(balance, moneda)}</b>.</div>`,
        `    <div class=\"footer\">${statusText}<br>Este resumen es informativo y se basa en los movimientos cargados en ContaBliza.</div>`,
        "  </div>",
        "</body>",
        "</html>"
      ].join("\n");
    }

    function openPdfWindow(html){
      const w = window.open("", "_blank");
      if(!w) return alert("No se pudo abrir la ventana para el PDF.");
      w.document.open();
      w.document.write(html);
      w.document.close();
      setTimeout(() => {
        w.focus();
        w.print();
      }, 300);
    }

    function getPeriodoLabelForPdf(){
      const { desde, hasta } = getFiltroFechas();
      const periodLabel = periodoSelect.value;
      if(periodLabel === "semana") return `Últimos 7 días: ${fmtDateShort(desde)} a ${fmtDateShort(hasta)}`;
      if(periodLabel === "mes") return `Mes actual: ${fmtDateShort(desde)} a ${fmtDateShort(hasta)}`;
      if(periodLabel === "anio") return `Año actual: ${fmtDateShort(desde)} a ${fmtDateShort(getDateISO(new Date()))}`;
      if(periodLabel === "rango") return `Rango: ${fmtDateShort(desde)} a ${fmtDateShort(hasta)}`;
      if(periodLabel === "todo"){
        const movs = getMovimientosSafe();
        const fechas = movs.map(m => m.fecha).filter(Boolean).sort();
        const first = fechas[0];
        const last = fechas[fechas.length - 1];
        if(first && last) return `Histórico: ${fmtDateShort(first)} a ${fmtDateShort(last)}`;
        return "Histórico completo";
      }
      return "Periodo";
    }

    function downloadPdfResumen(){
      const moneda = getActiveCurrency();
      const medioVal = medioSelect ? medioSelect.value : "__all__";
      const catVal = categoriaSelect ? categoriaSelect.value : "__all__";
      const { desde, hasta } = getFiltroFechas();
      const movs = filterMovsForSummary(moneda, medioVal, catVal, desde, hasta);
      const ingresos = movs.filter(m => m.tipo === "ingreso").reduce((a,b) => a + Number(b.monto || 0), 0);
      const egresos = movs.filter(m => m.tipo === "egreso").reduce((a,b) => a + Number(b.monto || 0), 0);
      const balance = ingresos - egresos;

      const byMedio = calcByMedio(movs);
      const medios = getMediosSafe();
      const cuentas = (medioVal === "__all__")
        ? medios.map(m => ({ nombre: m.name, monto: byMedio.get(String(m.id)) || 0 }))
        : [{ nombre: getMedioLabel(medioVal), monto: byMedio.get(String(medioVal)) || 0 }];

      const gastosPorLabel = new Map();
      movs.filter(m => m.tipo === "egreso").forEach(m => {
        const label = String(m.categoria || m.concepto || "Sin categoría").trim() || "Sin categoría";
        gastosPorLabel.set(label, (gastosPorLabel.get(label) || 0) + Number(m.monto || 0));
      });
      const topExpenses = Array.from(gastosPorLabel.entries())
        .sort((a, b) => Number(b[1]) - Number(a[1]))
        .slice(0, 3)
        .map(([label, monto]) => ({ label, monto }));

      const gastoPct = ingresos > 0 ? Math.round((egresos / ingresos) * 100) : 0;
      const ahorroPct = ingresos > 0 ? Math.max(0, Math.round((balance / ingresos) * 100)) : 0;

      const today = new Date();
      const session = getSessionSafe();
      const nombre = session?.user || session?.email || "Usuario";

      let baseDate = today;
      if(periodoSelect.value === "mes" && desde){
        const parts = String(desde).split("-");
        if(parts.length === 3){
          baseDate = new Date(Number(parts[0]), Number(parts[1]) - 1, 1);
        }
      }
      const currMonth = monthRange(baseDate);
      const prevMonth = monthRange(new Date(baseDate.getFullYear(), baseDate.getMonth() - 1, 1));
      const movsPrev = filterMovsForSummary(moneda, medioVal, catVal, prevMonth.desde, prevMonth.hasta);
      const prevIng = movsPrev.filter(m => m.tipo === "ingreso").reduce((a,b) => a + Number(b.monto || 0), 0);
      const prevEgr = movsPrev.filter(m => m.tipo === "egreso").reduce((a,b) => a + Number(b.monto || 0), 0);
      const prevBalance = prevIng - prevEgr;
      const diff = balance - prevBalance;
      const periodPhrase = getPeriodoPhraseShort();
      const statusText = balance > 0
        ? `Te quedó plata a favor ${periodPhrase}, bien ahí!`
        : balance < 0
          ? `Gastaste más plata de la que entró ${periodPhrase}, OJO!`
          : "No tenés plata pero tampoco tenés deudas.";

      const catLabel = (catVal === "__all__") ? "Todas" : (catVal === "__none__" ? "Sin categoría" : catVal);
      const medioLabel = getMedioLabel(medioVal);
      const periodo = getPeriodoLabelForPdf();

      const html = buildPdfHtml({
        nombre,
        fecha: fmtDateHuman(today),
        moneda,
        periodo,
        cuentas,
        ingresos,
        egresos,
        balance,
        prevBalance,
        diff,
        statusText,
        catLabel,
        medioLabel,
        topExpenses,
        gastoPct,
        ahorroPct
      });
      openPdfWindow(html);
    }

    function setKpiCurrency(next){
      kpiCurrency = next === "USD" ? "USD" : "UYU";
      if(kpiTabUYU){
        kpiTabUYU.classList.toggle("is-active", kpiCurrency === "UYU");
        kpiTabUYU.setAttribute("aria-pressed", kpiCurrency === "UYU" ? "true" : "false");
      }
      if(kpiTabUSD){
        kpiTabUSD.classList.toggle("is-active", kpiCurrency === "USD");
        kpiTabUSD.setAttribute("aria-pressed", kpiCurrency === "USD" ? "true" : "false");
      }
    }

    function setKpisByMoneda(){
      const res = calcIngresosEgresos(kpiCurrency);
      if(kIng) kIng.textContent = fmtMoney(res.ingresos, kpiCurrency);
      if(kEgr) kEgr.textContent = fmtMoney(res.egresos, kpiCurrency);
      if(kRes){
        kRes.textContent = fmtMoney(res.resultado, kpiCurrency);
        kRes.classList.toggle("is-positive", Number(res.resultado) > 0);
        kRes.classList.toggle("is-negative", Number(res.resultado) < 0);
      }
      if(kpiHint){
        const hasMovs = (res.ingresos + res.egresos) > 0;
        kpiHint.textContent = hasMovs ? "" : `Sin movimientos en ${kpiCurrency}.`;
        kpiHint.style.display = hasMovs ? "none" : "block";
      }
    }

    function getMonthValue(d){
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      return `${y}-${m}`;
    }

    function parseMonthValue(monthValue){
      if(!monthValue || !/^\d{4}-\d{2}$/.test(monthValue)) return null;
      const y = Number(monthValue.slice(0, 4));
      const m = Number(monthValue.slice(5, 7));
      if(Number.isNaN(y) || Number.isNaN(m)) return null;
      return { year: y, month: m };
    }

    function buildComparativoMonthValue(monthSelect, yearSelect){
      if(!monthSelect || !yearSelect) return "";
      const month = String(monthSelect.value || "").padStart(2, "0");
      const year = String(yearSelect.value || "");
      if(!/^\d{4}$/.test(year) || !/^\d{2}$/.test(month)) return "";
      return `${year}-${month}`;
    }

    function setComparativoMonthValue(monthSelect, yearSelect, monthValue){
      const parsed = parseMonthValue(monthValue);
      if(!monthSelect || !yearSelect || !parsed) return;
      monthSelect.value = String(parsed.month).padStart(2, "0");
      yearSelect.value = String(parsed.year);
    }

    function fillComparativoMonthSelects(){
      const monthPairs = [
        [cmpMesASelect, cmpAnioASelect],
        [cmpMesBSelect, cmpAnioBSelect]
      ];
      const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
      monthPairs.forEach(([monthSelect, yearSelect]) => {
        if(!monthSelect || !yearSelect) return;
        if(!monthSelect.options.length){
          monthSelect.innerHTML = monthNames.map((name, index) => `<option value="${String(index + 1).padStart(2, "0")}">${name}</option>`).join("");
        }
        if(!yearSelect.options.length){
          const now = new Date().getFullYear();
          const years = [];
          for(let year = now + 1; year >= now - 5; year -= 1){
            years.push(`<option value="${year}">${year}</option>`);
          }
          yearSelect.innerHTML = years.join("");
        }
      });
    }

    function monthRangeFromValue(monthValue){
      if(!monthValue || !/^\d{4}-\d{2}$/.test(monthValue)) return null;
      const y = Number(monthValue.slice(0, 4));
      const m = Number(monthValue.slice(5, 7)) - 1;
      if(Number.isNaN(y) || Number.isNaN(m)) return null;
      const first = new Date(y, m, 1);
      const last = new Date(y, m + 1, 0);
      return { desde: getDateISO(first), hasta: getDateISO(last) };
    }

    function formatMonthLabel(monthValue){
      const r = monthRangeFromValue(monthValue);
      if(!r) return monthValue || "";
      const d = new Date(`${r.desde}T00:00:00`);
      const label = d.toLocaleDateString("es-UY", { month: "long", year: "numeric" });
      return label.charAt(0).toUpperCase() + label.slice(1);
    }

    function sumByTipo(movs, tipo){
      return movs
        .filter(m => m.tipo === tipo)
        .reduce((acc, m) => acc + Number(m.monto || 0), 0);
    }

    function buildComparativoCategorias(){
      if(!cmpCategoriaSelect) return;
      const current = cmpCategoriaSelect.value || "__all__";
      const movs = getMovimientosSafe();
      const cats = getCategoriasFromMovs(movs);
      const hasNone = movs.some(m => !m.categoria);
      const opts = [
        `<option value="__all__">Todas las categorías</option>`,
        ...(hasNone ? [`<option value="__none__">Sin categoría</option>`] : []),
        ...cats.map(c => `<option value="${c}">${c}</option>`)
      ];
      cmpCategoriaSelect.innerHTML = opts.join("");
      if(Array.from(cmpCategoriaSelect.options).some(o => o.value === current)){
        cmpCategoriaSelect.value = current;
      }
    }

    function getComparativoData(monthValue, catVal, monedaVal, medioVal){
      const range = monthRangeFromValue(monthValue);
      if(!range) return { ingresos: 0, egresos: 0, resultado: 0 };
      const movs = filterMovsForSummary(monedaVal, medioVal, catVal, range.desde, range.hasta);
      const ingresos = sumByTipo(movs, "ingreso");
      const egresos = sumByTipo(movs, "egreso");
      return { ingresos, egresos, resultado: ingresos - egresos };
    }

    function destroyPieChart(){
      if(pieChart){
        pieChart.destroy();
        pieChart = null;
      }
    }

    function destroyComparativoChart(){
      if(cmpChart){
        cmpChart.destroy();
        cmpChart = null;
      }
    }

    function hideComparativoHover(){
      if(!cmpHover) return;
      cmpHover.textContent = "";
      cmpHover.classList.remove("is-visible");
      cmpHover.classList.remove("is-below");
    }

    function positionComparativoHover(anchorX = null, anchorY = null, placeBelow = false){
      if(!cmpHover) return;
      if(anchorX !== null) cmpHover.style.left = `${anchorX}px`;
      if(anchorY !== null) cmpHover.style.top = `${anchorY}px`;
      cmpHover.classList.toggle("is-below", !!placeBelow);
      cmpHover.classList.add("is-visible");

      const parent = cmpHover.parentElement;
      if(!parent) return;
      const hoverWidth = cmpHover.offsetWidth || 0;
      const half = hoverWidth / 2;
      const minLeft = 12 + half;
      const maxLeft = Math.max(minLeft, parent.clientWidth - 12 - half);
      const rawLeft = anchorX === null ? minLeft : anchorX;
      const clampedLeft = Math.max(minLeft, Math.min(maxLeft, rawLeft));
      cmpHover.style.left = `${clampedLeft}px`;
    }

    function renderComparativoHover(index = null, anchorX = null, anchorY = null){
      if(!cmpHover || !cmpSelectionState){
        hideComparativoHover();
        return;
      }
      if(index === null || !cmpSelectionState.items[index]){
        hideComparativoHover();
        return;
      }
      const item = cmpSelectionState.items[index];
      const total = Number(item.a || 0) + Number(item.b || 0);
      cmpHover.innerHTML = `<b>${item.label}</b>: ${escapeHtml(fmtMoney(total, cmpSelectionState.moneda))}`;
      positionComparativoHover(anchorX, anchorY, index === 2);
    }

    function renderComparativoTouchDetail(index = null){
      if(!cmpTouchDetail || !cmpSelectionState){
        if(cmpTouchDetail) cmpTouchDetail.textContent = "";
        return;
      }
      if(index === null || !cmpSelectionState.items[index]){
        cmpTouchDetail.textContent = "";
        return;
      }
      const item = cmpSelectionState.items[index];
      const total = Number(item.a || 0) + Number(item.b || 0);
      cmpTouchDetail.innerHTML = `<b>${item.label}</b>: ${escapeHtml(cmpSelectionState.labelA)} ${escapeHtml(fmtMoney(item.a, cmpSelectionState.moneda))} | ${escapeHtml(cmpSelectionState.labelB)} ${escapeHtml(fmtMoney(item.b, cmpSelectionState.moneda))} | Total ${escapeHtml(fmtMoney(total, cmpSelectionState.moneda))}`;
    }

    function fmtPercentChange(base, next){
      const a = Number(base || 0);
      const b = Number(next || 0);
      if(Math.abs(a) < 0.0001) return null;
      return ((b - a) / Math.abs(a)) * 100;
    }

    function buildComparativoInsight(a, b, labelA, labelB, monedaVal){
      const deltas = [
        { key: "ingresos", label: "ingresos", from: Number(a.ingresos || 0), to: Number(b.ingresos || 0) },
        { key: "gastos", label: "gastos", from: Number(a.egresos || 0), to: Number(b.egresos || 0) },
        { key: "resultado", label: "resultado", from: Number(a.resultado || 0), to: Number(b.resultado || 0) }
      ];
      deltas.sort((x, y) => Math.abs(y.to - y.from) - Math.abs(x.to - x.from));
      const top = deltas[0];
      const diff = top.to - top.from;
      const pct = fmtPercentChange(top.from, top.to);

      if(top.key === "resultado"){
        if(Math.abs(diff) < 0.0001){
          return `Insight rápido: <strong>El resultado se mantuvo estable</strong> entre <strong>${escapeHtml(labelA)}</strong> y <strong>${escapeHtml(labelB)}</strong>.`;
        }
        if(diff > 0){
          return `Insight rápido: <strong>El resultado mejoró</strong> en ${escapeHtml(fmtMoney(diff, monedaVal))}${pct === null ? "" : ` (${Math.abs(pct).toFixed(1)}%)`} frente a <strong>${escapeHtml(labelA)}</strong>.`;
        }
        return `Insight rápido: <strong>El resultado cayó</strong> en ${escapeHtml(fmtMoney(Math.abs(diff), monedaVal))}${pct === null ? "" : ` (${Math.abs(pct).toFixed(1)}%)`} frente a <strong>${escapeHtml(labelA)}</strong>.`;
      }

      if(Math.abs(diff) < 0.0001){
        return `Insight rápido: <strong>${top.label.charAt(0).toUpperCase() + top.label.slice(1)} sin cambios relevantes</strong> entre <strong>${escapeHtml(labelA)}</strong> y <strong>${escapeHtml(labelB)}</strong>.`;
      }

      const verb = diff > 0 ? "subieron" : "bajaron";
      return `Insight rápido: <strong>Los ${top.label} ${verb}</strong> ${pct === null ? `en ${escapeHtml(fmtMoney(Math.abs(diff), monedaVal))}` : `${Math.abs(pct).toFixed(1)}%`} entre <strong>${escapeHtml(labelA)}</strong> y <strong>${escapeHtml(labelB)}</strong>.`;
    }

    function updateComparativoFocusButtons(){
      const buttons = [cmpFocusIngresos, cmpFocusGastos, cmpFocusResultado];
      buttons.forEach((button, index) => {
        if(!button) return;
        const isActive = cmpSelectedIndex === index;
        button.classList.toggle("is-active", isActive);
        button.setAttribute("aria-pressed", isActive ? "true" : "false");
      });
    }

    function renderComparativoSelectionChart(chart, index = null, moneda = "UYU"){
      updateComparativoFocusButtons();
      if(!chart || index === null){
        renderComparativoHover(null);
        renderComparativoTouchDetail(null);
        return;
      }
      const labels = chart.data?.labels || [];
      const datasets = chart.data?.datasets || [];
      if(!labels[index] || !datasets.length){
        renderComparativoHover(null);
        renderComparativoTouchDetail(null);
        return;
      }

      const pointA = chart.getDatasetMeta(0)?.data?.[index];
      const pointB = chart.getDatasetMeta(1)?.data?.[index];
      const anchorX = pointA?.x ?? pointB?.x ?? null;
      const anchorY = Math.min(pointA?.y ?? Number.POSITIVE_INFINITY, pointB?.y ?? Number.POSITIVE_INFINITY);
      cmpSelectionState = {
        labelA: datasets[0]?.label || "",
        labelB: datasets[1]?.label || "",
        moneda,
        items: labels.map((label, itemIndex) => ({
          label,
          a: Number(datasets[0]?.data?.[itemIndex] || 0),
          b: Number(datasets[1]?.data?.[itemIndex] || 0)
        }))
      };
      renderComparativoHover(index, anchorX, Number.isFinite(anchorY) ? anchorY : null);
      renderComparativoTouchDetail(index);
    }

    function getPieFocusLabel(item){
      if(!item) return "Total";
      return item.label;
    }

    function updatePieDots(){
      const dots = [pieDotIngresos, pieDotGastos];
      dots.forEach((dot, index) => {
        if(!dot) return;
        const isActive = pieActiveIndex === index;
        dot.classList.toggle("is-active", isActive);
        dot.setAttribute("aria-pressed", isActive ? "true" : "false");
      });
    }

    function drawPieFallback(canvas, labels, values, colors, rawValues = values){
      const ctx = canvas.getContext("2d");
      if(!ctx) return;
      const width = Math.min(canvas.clientWidth || 300, 270);
      const height = width;
      canvas.width = width;
      canvas.height = height;
      ctx.clearRect(0, 0, width, height);

      const total = values.reduce((acc, n) => acc + n, 0);
      if(total <= 0) return;

      const activeItem = pieActiveIndex === null ? null : {
        label: labels[pieActiveIndex],
        rawValue: rawValues[pieActiveIndex]
      };
      const displayLabel = getPieFocusLabel(activeItem);
      const displayValue = activeItem ? rawValues[pieActiveIndex] : total;

      const cx = width * 0.5;
      const cy = height * 0.5;
      const radius = Math.min(width, height) * 0.37;
      const innerRadius = radius * 0.58;
      const start = -Math.PI / 2;
      const gap = 0.02;
      let current = start;

      values.forEach((value, index) => {
        const angle = (value / total) * Math.PI * 2;
        const segStart = current + gap;
        const segEnd = current + angle - gap;
        if(segEnd <= segStart){
          current += angle;
          return;
        }
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, radius, segStart, segEnd);
        ctx.closePath();
        const isDimmed = pieActiveIndex !== null && pieActiveIndex !== index;
        ctx.fillStyle = isDimmed ? `${colors[index]}55` : colors[index];
        ctx.fill();
        current += angle;
      });

      ctx.beginPath();
      ctx.fillStyle = "#faf8f5";
      ctx.arc(cx, cy, innerRadius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#51626b";
      ctx.textAlign = "center";
      ctx.font = "700 12px sans-serif";
      ctx.fillText(displayLabel, cx, cy - 6);
      ctx.fillStyle = "#183949";
      ctx.font = "700 20px sans-serif";
      ctx.fillText(displayValue.toLocaleString("es-UY"), cx, cy + 18);
    }

    function drawComparativoFallback(canvas, labelA, labelB, dataA, dataB, moneda){
      const ctx = canvas.getContext("2d");
      if(!ctx) return;
      const width = canvas.clientWidth || 360;
      const height = 205;
      canvas.width = width;
      canvas.height = height;
      ctx.clearRect(0, 0, width, height);

      const labels = ["Ingresos", "Gastos", "Resultado"];
      const allValues = [...dataA, ...dataB];
      const minValue = Math.min(...allValues, 0);
      const maxValue = Math.max(...allValues, 0, 1);
      const top = 28;
      const bottom = height - 24;
      const range = Math.max(maxValue - minValue, 1);
      const zeroY = top + (((maxValue - 0) / range) * (bottom - top));
      const groupWidth = width / labels.length;
      const barWidth = Math.min(30, groupWidth * 0.26);

      ctx.strokeStyle = "rgba(98, 114, 123, 0.42)";
      ctx.beginPath();
      ctx.moveTo(18, zeroY);
      ctx.lineTo(width - 18, zeroY);
      ctx.stroke();

      const guideCount = 3;
      for(let i = 1; i <= guideCount; i += 1){
        const y = top + (((bottom - top) / (guideCount + 1)) * i);
        if(Math.abs(y - zeroY) < 6) continue;
        ctx.strokeStyle = "rgba(98, 114, 123, 0.10)";
        ctx.beginPath();
        ctx.moveTo(18, y);
        ctx.lineTo(width - 18, y);
        ctx.stroke();
      }

      cmpFallbackRegions = [];
      cmpSelectionState = {
        labelA,
        labelB,
        moneda,
        items: labels.map((label, index) => ({
          label,
          a: dataA[index],
          b: dataB[index]
        }))
      };

      labels.forEach((label, index) => {
        const centerX = groupWidth * index + (groupWidth / 2);
        const values = [dataA[index], dataB[index]];
        const colors = ["rgba(24, 123, 69, 0.34)", "rgba(24, 123, 69, 0.86)"];
        if(index === 1){
          colors[0] = "rgba(199, 53, 53, 0.34)";
          colors[1] = "rgba(199, 53, 53, 0.86)";
        }
        if(index === 2){
          colors[0] = "rgba(47, 113, 215, 0.34)";
          colors[1] = "rgba(47, 113, 215, 0.86)";
        }

        values.forEach((value, valueIndex) => {
          const valueY = top + (((maxValue - value) / range) * (bottom - top));
          const barHeight = Math.abs(zeroY - valueY);
          const x = centerX + ((valueIndex === 0 ? -1 : 1) * (barWidth * 0.7)) - (barWidth / 2);
          const y = value >= 0 ? zeroY - barHeight : zeroY;
          const isDimmed = cmpSelectedIndex !== null && cmpSelectedIndex !== index;
          ctx.fillStyle = isDimmed ? colors[valueIndex].replace(/0\.(34|86)\)/, "0.14)") : colors[valueIndex];
          ctx.fillRect(x, y, barWidth, barHeight);
        });

        ctx.fillStyle = "#183949";
        ctx.font = "600 12px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(label, centerX, height - 4);

        cmpFallbackRegions.push({
          index,
          left: Math.max(0, centerX - (groupWidth * 0.42)),
          right: Math.min(width, centerX + (groupWidth * 0.42)),
          top,
          bottom: height
        });
      });

      ctx.textAlign = "left";
      const activeRegion = cmpFallbackRegions.find(region => region.index === cmpSelectedIndex);
      if(activeRegion){
        renderComparativoHover(
          cmpSelectedIndex,
          (activeRegion.left + activeRegion.right) / 2,
          activeRegion.top + 2
        );
      }else{
        renderComparativoHover(null);
      }
      renderComparativoTouchDetail(cmpSelectedIndex);
    }

    function renderPieBreakdown(items, moneda){
      if(!pieBreakdown) return;
      const total = items.reduce((acc, item) => acc + item.value, 0);
      const flowCards = items.map((item) => {
        const share = total > 0 ? ((item.value / total) * 100).toFixed(1) : "0.0";
        return `
          <div class="pie-summary-item">
            <span class="pie-summary-label"><span class="pie-summary-swatch" style="background:${item.color};"></span>${item.label}</span>
            <span class="pie-summary-value">${escapeHtml(fmtMoney(item.rawValue, moneda))}</span>
            <span class="pie-summary-share">${share}% del gráfico</span>
          </div>
        `;
      }).join("");

      const resultado = lastPieState?.res?.resultado || 0;
      const resultLabel = Number(resultado) < 0 ? "Debes" : "Te quedan";
      const resultNote = Number(resultado) < 0 ? "Resultado neto del período" : "Saldo neto del período";
      pieBreakdown.innerHTML = `${flowCards}
        <div class="pie-summary-item is-result">
          <span class="pie-summary-label"><span class="pie-summary-swatch" style="background:#2f71d7;"></span>${resultLabel}</span>
          <span class="pie-summary-value">${escapeHtml(fmtMoney(resultado, moneda))}</span>
          <span class="pie-summary-note">${resultNote}</span>
        </div>
      `;
    }

    function renderPie(res, moneda){
      if(!pieCanvas) return;

      const ingresos = Number(res?.ingresos || 0);
      const egresos = Number(res?.egresos || 0);
      const pieItems = [
        { label: "Ingresos", value: ingresos, rawValue: ingresos, color: "#1f8b4c" },
        { label: "Gastos", value: egresos, rawValue: egresos, color: "#c73535" }
      ];
      if(pieActiveIndex !== null && pieActiveIndex > pieItems.length - 1){
        pieActiveIndex = null;
      }

      if((ingresos + egresos) <= 0){
        destroyPieChart();
        if(pieEmpty){
          pieEmpty.textContent = "No hay datos para graficar.";
          pieEmpty.style.display = "block";
        }
        updatePieDots();
        if(pieBreakdown) pieBreakdown.innerHTML = "";
        pieCanvas.style.display = "none";
        return;
      }

      if(pieEmpty) pieEmpty.style.display = "none";
      lastPieState = { res, moneda };
      updatePieDots();
      renderPieBreakdown(pieItems, moneda);
      pieCanvas.style.display = "block";

      if(typeof Chart === "undefined"){
        destroyPieChart();
        drawPieFallback(
          pieCanvas,
          pieItems.map(item => item.label),
          pieItems.map(item => item.value),
          pieItems.map(item => item.color),
          pieItems.map(item => item.rawValue)
        );
        return;
      }

      destroyPieChart();

      const focusedItem = pieActiveIndex === null ? null : pieItems[pieActiveIndex];
      const displayLabel = getPieFocusLabel(focusedItem);
      const displayValue = focusedItem ? focusedItem.rawValue : pieItems.reduce((acc, item) => acc + item.value, 0);

      pieChart = new Chart(pieCanvas, {
        type: "doughnut",
        data: {
          labels: pieItems.map(item => item.label),
          datasets: [{
            data: pieItems.map(item => item.value),
            backgroundColor: pieItems.map((item, index) => {
              if(pieActiveIndex === null || pieActiveIndex === index) return item.color;
              return `${item.color}55`;
            }),
            borderColor: "#f5f3f0",
            borderWidth: 3,
            hoverOffset: 6,
            offset: pieItems.map((_, index) => pieActiveIndex === index ? 10 : 0)
          }]
        },
        plugins: [{
          id: "pieCenterText",
          afterDraw(chart){
            const meta = chart.getDatasetMeta(0);
            if(!meta || !meta.data || !meta.data.length) return;
            const point = meta.data[0];
            const x = point.x;
            const y = point.y;
            const ctx = chart.ctx;
            ctx.save();
            ctx.textAlign = "center";
            ctx.fillStyle = "#51626b";
            ctx.font = "700 12px sans-serif";
            ctx.fillText(displayLabel, x, y - 8);
            ctx.fillStyle = "#183949";
            ctx.font = "700 18px sans-serif";
            ctx.fillText(Number(displayValue || 0).toLocaleString("es-UY"), x, y + 18);
            ctx.restore();
          }
        }],
        options: {
          responsive: true,
          maintainAspectRatio: true,
          aspectRatio: 1,
          cutout: "58%",
          layout: {
            padding: {
              left: 8,
              right: 8,
              top: 8,
              bottom: 8
            }
          },
          plugins: {
            legend: {
              display: false
            },
            tooltip: {
              callbacks: {
                label: function(ctx){
                  const idx = ctx.dataIndex;
                  const label = ctx.label || "";
                  const value = ctx.parsed;
                  return `${label}: ${fmtMoney(value, moneda || "UYU")}`;
                }
              }
            }
          }
        }
      });
    }

    function renderComparativo(){
      if(!cmpCanvas || !cmpMesASelect || !cmpAnioASelect || !cmpMesBSelect || !cmpAnioBSelect) return;

      buildComparativoCategorias();

      const monthA = buildComparativoMonthValue(cmpMesASelect, cmpAnioASelect);
      const monthB = buildComparativoMonthValue(cmpMesBSelect, cmpAnioBSelect);
      if(!monthA || !monthB){
        destroyComparativoChart();
        cmpCanvas.style.display = "none";
        if(cmpEmpty){
          cmpEmpty.style.display = "block";
          cmpEmpty.textContent = "Selecciona dos meses para comparar.";
        }
        if(cmpMeta) cmpMeta.textContent = "";
        hideComparativoHover();
        if(cmpTouchDetail) cmpTouchDetail.textContent = "";
        if(cmpDelta) cmpDelta.textContent = "";
        if(cmpInsight) cmpInsight.textContent = "";
        updateComparativoFocusButtons();
        return;
      }

      const monedaVal = monedaSelect ? monedaSelect.value : "UYU";
      const medioVal = medioSelect ? medioSelect.value : "__all__";
      const catVal = cmpCategoriaSelect ? cmpCategoriaSelect.value : "__all__";
      const a = getComparativoData(monthA, catVal, monedaVal, medioVal);
      const b = getComparativoData(monthB, catVal, monedaVal, medioVal);

      if(cmpEmpty) cmpEmpty.style.display = "none";
      cmpCanvas.style.display = "block";

      const labelA = formatMonthLabel(monthA);
      const labelB = formatMonthLabel(monthB);
      cmpSelectionState = {
        labelA,
        labelB,
        moneda: monedaVal,
        items: [
          { label: "Ingresos", a: a.ingresos, b: b.ingresos },
          { label: "Gastos", a: a.egresos, b: b.egresos },
          { label: "Resultado", a: a.resultado, b: b.resultado }
        ]
      };
      if(cmpLegend){
        cmpLegend.innerHTML = `
          <span class="cmp-legend-item"><span class="cmp-legend-swatch" style="background:rgba(36,74,91,0.38);"></span>${escapeHtml(labelA)}</span>
          <span class="cmp-legend-item"><span class="cmp-legend-swatch" style="background:rgba(36,74,91,0.88);"></span>${escapeHtml(labelB)}</span>
        `;
      }
      const absValues = [
        Math.abs(a.ingresos), Math.abs(a.egresos), Math.abs(a.resultado),
        Math.abs(b.ingresos), Math.abs(b.egresos), Math.abs(b.resultado)
      ];
      const scaleValue = Math.max(...absValues, 0);
      if(cmpMeta){
        cmpMeta.textContent = `Escala máx. ${fmtMoney(scaleValue, monedaVal)}`;
      }

      if(typeof Chart === "undefined"){
        destroyComparativoChart();
        drawComparativoFallback(
          cmpCanvas,
          labelA,
          labelB,
          [a.ingresos, a.egresos, a.resultado],
          [b.ingresos, b.egresos, b.resultado],
          monedaVal
        );
      }else{
        destroyComparativoChart();
        hideComparativoHover();
        renderComparativoTouchDetail(cmpSelectedIndex);
        const isSelectionActive = cmpSelectedIndex !== null;
        const colorA = [
          isSelectionActive && cmpSelectedIndex !== 0 ? "rgba(24, 123, 69, 0.14)" : "rgba(24, 123, 69, 0.34)",
          isSelectionActive && cmpSelectedIndex !== 1 ? "rgba(199, 53, 53, 0.14)" : "rgba(199, 53, 53, 0.34)",
          isSelectionActive && cmpSelectedIndex !== 2 ? "rgba(47, 113, 215, 0.14)" : "rgba(47, 113, 215, 0.34)"
        ];
        const colorB = [
          isSelectionActive && cmpSelectedIndex !== 0 ? "rgba(24, 123, 69, 0.3)" : "rgba(24, 123, 69, 0.86)",
          isSelectionActive && cmpSelectedIndex !== 1 ? "rgba(199, 53, 53, 0.3)" : "rgba(199, 53, 53, 0.86)",
          isSelectionActive && cmpSelectedIndex !== 2 ? "rgba(47, 113, 215, 0.3)" : "rgba(47, 113, 215, 0.86)"
        ];
        const borderA = [
          isSelectionActive && cmpSelectedIndex !== 0 ? "rgba(31,139,76,0.22)" : "rgba(31,139,76,0.62)",
          isSelectionActive && cmpSelectedIndex !== 1 ? "rgba(199,53,53,0.22)" : "rgba(199,53,53,0.62)",
          isSelectionActive && cmpSelectedIndex !== 2 ? "rgba(47,113,215,0.22)" : "rgba(47,113,215,0.62)"
        ];
        const borderB = [
          isSelectionActive && cmpSelectedIndex !== 0 ? "rgba(31,139,76,0.38)" : "#1f8b4c",
          isSelectionActive && cmpSelectedIndex !== 1 ? "rgba(199,53,53,0.38)" : "#c73535",
          isSelectionActive && cmpSelectedIndex !== 2 ? "rgba(47,113,215,0.38)" : "#2f71d7"
        ];

        cmpChart = new Chart(cmpCanvas, {
          type: "bar",
          data: {
            labels: ["Ingresos", "Gastos", "Resultado"],
            datasets: [
              {
                label: labelA,
                data: [a.ingresos, a.egresos, a.resultado],
                backgroundColor: colorA,
                borderColor: borderA,
                borderWidth: 1.5
              },
              {
                label: labelB,
                data: [b.ingresos, b.egresos, b.resultado],
                backgroundColor: colorB,
                borderColor: borderB,
                borderWidth: 1.5
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
              padding: {
                top: 26,
                right: 12,
                bottom: 0,
                left: 34
              }
            },
            plugins: {
              legend: {
                display: false
            },
              tooltip: {
                enabled: false,
                callbacks: {
                  title: function(items){
                    return items?.[0]?.label || "";
                  },
                  label: function(ctx){
                    return `${ctx.dataset.label}: ${fmtMoney(ctx.parsed.y, monedaVal)}`;
                  },
                  footer: function(items){
                    const total = (items || []).reduce((acc, item) => acc + Number(item.parsed?.y || 0), 0);
                    return `Total categoría: ${fmtMoney(total, monedaVal)}`;
                  }
                }
              }
            },
            scales: {
              x: {
                stacked: false,
                categoryPercentage: 0.72,
                barPercentage: 0.92,
                grid: {
                  display: false
                },
                border: {
                  display: true,
                  color: "rgba(98, 114, 123, 0.42)"
                },
                ticks: {
                  color: "#183949",
                  padding: 2
                }
              },
              y: {
                grid: {
                  color: "rgba(98, 114, 123, 0.10)",
                  drawBorder: false
                },
                border: {
                  display: false
                },
                ticks: {
                  color: "#36505d",
                  padding: 8,
                  callback: function(value){
                    return fmtMoney(value, monedaVal);
                  }
                }
              }
            }
          }
        });

        renderComparativoSelectionChart(cmpChart, cmpSelectedIndex, monedaVal);
      }

      if(cmpDelta){
        const delta = b.resultado - a.resultado;
        const sign = delta >= 0 ? "+" : "";
        cmpDelta.innerHTML = `<span class="cmp-delta-label">Cambio de balance entre <b>${labelA}</b> y <b>${labelB}</b>:</span><b class="cmp-delta-value">${sign}${fmtMoney(delta, monedaVal)}</b>`;
      }
      if(cmpInsight){
        cmpInsight.innerHTML = buildComparativoInsight(a, b, labelA, labelB, monedaVal);
      }
    }

    function apply(){
      updateRangoVisibility();
      if(monedaSelect && monedaSelect.value !== getActiveCurrency()){
        monedaSelect.value = getActiveCurrency();
      }
      setKpisByMoneda();
      const chartMoneda = getActiveCurrency();
      const res = calcIngresosEgresos(chartMoneda);
      renderPie(res, chartMoneda);
      renderComparativo();
      if(reportHint){
        const m = getActiveCurrency();
        const medio = medioSelect ? medioSelect.value : "__all__";
        const medioLabel = getMedioLabel(medio);
        const cat = categoriaSelect ? categoriaSelect.value : "__all__";
        const catLabel = (cat === "__all__") ? "Todas" : (cat === "__none__" ? "Sin categoría" : cat);
        const periodo = getPeriodoSummaryLabel();
        reportHint.innerHTML = `Filtros activos: <b>${periodo}</b> · <b>${m}</b> · <b>${medioLabel}</b> · <b>${catLabel}</b>.`;
        if(filtersSummarySub){
          filtersSummarySub.textContent = `${periodo} · ${m} · ${medioLabel}`;
        }
      }
      // subtítulo fijo, sin rango dinámico
    }

    btnAplicar.addEventListener("click", apply);

    btnLimpiar.addEventListener("click", () => {
      periodoSelect.value = "mes";
      desdeInput.value = "";
      hastaInput.value = "";
      if(categoriaSelect) categoriaSelect.value = "__all__";
      if(monedaSelect) monedaSelect.value = "UYU";
      if(medioSelect) medioSelect.value = "__all__";
      setKpiCurrency("UYU");
      apply();
    });

    periodoSelect.addEventListener("change", () => {
      updateRangoVisibility();
      apply();
    });

    if(categoriaSelect){
      categoriaSelect.addEventListener("change", apply);
    }
    if(monedaSelect){
      monedaSelect.addEventListener("change", () => {
        setKpiCurrency(monedaSelect.value || "UYU");
        apply();
      });
    }
    if(medioSelect){
      medioSelect.addEventListener("change", apply);
    }
    if(btnPdf){
      btnPdf.addEventListener("click", downloadPdfResumen);
    }
    if(btnExcel){
      btnExcel.addEventListener("click", exportExcelResumen);
    }
    if(cmpCategoriaSelect){
      cmpCategoriaSelect.addEventListener("change", renderComparativo);
    }
    if(cmpMesASelect) cmpMesASelect.addEventListener("change", renderComparativo);
    if(cmpAnioASelect) cmpAnioASelect.addEventListener("change", renderComparativo);
    if(cmpMesBSelect) cmpMesBSelect.addEventListener("change", renderComparativo);
    if(cmpAnioBSelect) cmpAnioBSelect.addEventListener("change", renderComparativo);
    if(kpiTabUYU){
      kpiTabUYU.addEventListener("click", () => {
        setKpiCurrency("UYU");
        apply();
      });
    }
    if(kpiTabUSD){
      kpiTabUSD.addEventListener("click", () => {
        setKpiCurrency("USD");
        apply();
      });
    }
    if(cmpCanvas){
      cmpCanvas.addEventListener("click", (event) => {
        if(typeof Chart !== "undefined" && cmpChart){
          const points = cmpChart.getElementsAtEventForMode(event, "index", { intersect: false }, false);
          const nextIndex = points && points.length ? points[0].index : null;
          cmpSelectedIndex = nextIndex === cmpSelectedIndex ? null : nextIndex;
          renderComparativo();
          return;
        }

        const rect = cmpCanvas.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * (cmpCanvas.width || rect.width);
        const y = ((event.clientY - rect.top) / rect.height) * (cmpCanvas.height || rect.height);
        const found = cmpFallbackRegions.find(region => x >= region.left && x <= region.right && y >= region.top && y <= region.bottom);
        const nextIndex = found ? found.index : null;
        cmpSelectedIndex = nextIndex === cmpSelectedIndex ? null : nextIndex;
        renderComparativo();
      });
    }
    if(cmpFocusIngresos){
      cmpFocusIngresos.addEventListener("click", () => {
        cmpSelectedIndex = cmpSelectedIndex === 0 ? null : 0;
        renderComparativo();
      });
    }
    if(cmpFocusGastos){
      cmpFocusGastos.addEventListener("click", () => {
        cmpSelectedIndex = cmpSelectedIndex === 1 ? null : 1;
        renderComparativo();
      });
    }
    if(cmpFocusResultado){
      cmpFocusResultado.addEventListener("click", () => {
        cmpSelectedIndex = cmpSelectedIndex === 2 ? null : 2;
        renderComparativo();
      });
    }
    document.addEventListener("click", (event) => {
      if(!cmpCanvas) return;
      const target = event.target;
      if(target === cmpCanvas || cmpCanvas.contains(target)) return;
      if((cmpFocusIngresos && cmpFocusIngresos.contains(target)) || (cmpFocusGastos && cmpFocusGastos.contains(target)) || (cmpFocusResultado && cmpFocusResultado.contains(target))) return;
      if(cmpSelectedIndex !== null){
        cmpSelectedIndex = null;
        renderComparativo();
      }
    });
    if(pieDotIngresos){
      pieDotIngresos.addEventListener("click", () => {
        pieActiveIndex = pieActiveIndex === 0 ? null : 0;
        updatePieDots();
        if(lastPieState) renderPie(lastPieState.res, lastPieState.moneda);
      });
    }
    if(pieDotGastos){
      pieDotGastos.addEventListener("click", () => {
        pieActiveIndex = pieActiveIndex === 1 ? null : 1;
        updatePieDots();
        if(lastPieState) renderPie(lastPieState.res, lastPieState.moneda);
      });
    }
    document.addEventListener("DOMContentLoaded", () => {
      const now = new Date();
      fillComparativoMonthSelects();
      setComparativoMonthValue(cmpMesBSelect, cmpAnioBSelect, getMonthValue(now));
      setComparativoMonthValue(cmpMesASelect, cmpAnioASelect, getMonthValue(new Date(now.getFullYear(), now.getMonth() - 1, 1)));
      if(monedaSelect) setKpiCurrency(monedaSelect.value || "UYU");
      updateRangoVisibility();
      apply();
    });

    window.addEventListener("cb:settings-updated", () => {
      apply();
    });

    window.addEventListener("storage", (e) => {
      if(e.key === "contabliza_settings"){
        apply();
      }
    });



