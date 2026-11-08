// ── Economía ──
// ── polling state ──
let _ecoPollingTimer = null;

function _animateValue(el, from, to, decimals, prefix, duration) {
  if (!el) return;
  const start = performance.now();
  const diff = to - from;
  if (diff === 0) { el.textContent = prefix + to.toFixed(decimals); return; }
  function step(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3);
    const current = from + diff * ease;
    el.textContent = prefix + current.toFixed(decimals);
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

async function pfLoadEconomia() {
  const token = LS.get('token');
  if(!token) return;
  try {
    const res = await fetch(`${PF_API}/economia/mi-saldo`,{
      headers:{ Authorization:`Bearer ${token}` }
    });
    if(!res.ok) return;
    const d = await res.json();
    if(d.success) {
      // Saldo — 4 decimales con animacion
      // Todo en UpCoins: total gastable + desglose (retirables = ganados como creador)
      const uc = d.upcoins || { total: (d.monedas || 0) + (d.saldo || 0) / 0.02, ganadas: (d.saldo || 0) / 0.02, compradas: d.monedas || 0, retenidas: (d.saldoRetenido || 0) / 0.02 };
      const saldoEl = document.getElementById('pf-saldo-display');
      const prevSaldo = parseFloat(saldoEl.dataset.val || '0');
      const newSaldo = uc.compradas + uc.ganadas;
      saldoEl.dataset.val = newSaldo;
      _animateValue(saldoEl, prevSaldo, Math.floor(newSaldo * 100) / 100, newSaldo < 100 ? 2 : 0, '🪙 ', 800);
      if (newSaldo >= 100) setTimeout(() => { saldoEl.textContent = '🪙 ' + Math.floor(newSaldo).toLocaleString('es-CO'); }, 850);   // igual que la cabecera (sin redondear hacia arriba)
      const fx = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
      fx('eco-retirables', (uc.ganadas || 0).toLocaleString('es-CO', { maximumFractionDigits: 2 }));
      fx('eco-retirables-usd', `(≈ US$${(d.saldo || 0).toFixed(2)})`);
      fx('eco-monedas', (uc.compradas || 0).toLocaleString('es-CO'));
      fx('eco-retenido', (uc.retenidas || 0).toLocaleString('es-CO', { maximumFractionDigits: 2 }));
      ecoPintarRetencion(uc.retenidas || 0, d.retencion);
      window.ugContadorUC?.(uc.total);

      // Descargas totales con animacion
      const dlEl = document.getElementById('pf-descargas-totales');
      const prevDl = parseInt(dlEl.dataset.val || '0', 10);
      const newDl = d.descargasTotales || 0;
      dlEl.dataset.val = newDl;
      _animateValue(dlEl, prevDl, newDl, 0, '', 600);

      // Juegos con ganancias con animacion
      const jgEl = document.getElementById('pf-juegos-elegibles');
      const prevJg = parseInt(jgEl.dataset.val || '0', 10);
      const newJg = d.juegosElegibles || 0;
      jgEl.dataset.val = newJg;
      _animateValue(jgEl, prevJg, newJg, 0, '', 600);

      ecoCobroPintar(d.metodoCobro, d.esperaCobroHasta);
      if(!d.isVerificado||d.verificadoNivel<1) {
        document.getElementById('pf-estado-verificacion').style.display='flex';
      }
      const btnP = document.getElementById('pf-btn-solicitar-pago');
      if(d.solicitudPagoPendiente) {
        document.getElementById('pf-solicitud-pendiente').style.display='flex';
        btnP.disabled=true; btnP.classList.remove('enabled');
      } else if(d.puedeRetirar) {
        btnP.disabled=false; btnP.classList.add('enabled');
      }

      // ── Dashboard update ──
      ecoUpdateDashboard(d);
    }
  } catch(e) { console.error('pfLoadEconomia', e); }
}

function pfStartEcoPolling() {
  pfStopEcoPolling();
  pfLoadEconomia();
  _ecoPollingTimer = setInterval(pfLoadEconomia, 8000);
}

function pfStopEcoPolling() {
  if(_ecoPollingTimer) { clearInterval(_ecoPollingTimer); _ecoPollingTimer = null; }
}

/* ═══════════════════════════════════════════════════════════
   CREATOR STUDIO DASHBOARD — RENDERING ENGINE
═══════════════════════════════════════════════════════════ */
let _ecoPeriodDays  = 7;
// Estadísticas reales de /economia/mis-estadisticas (declaradas aquí: las usa la gráfica)
let _ecoStats = null, _ecoStatsT = 0, _ecoStatsDias = 0, _ecoStatsCargando = false, _ecoPsOrden = 'descargas';
let _ecoLastData    = null;
let _ecoChartTimer  = null;

function ecoSetPeriod(days, btn) {
  _ecoPeriodDays = days;
  ecoCargarStats(true);
  document.querySelectorAll('.eco-period-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  if (_ecoLastData) ecoUpdateDashboard(_ecoLastData);
}

function ecoUpdateDashboard(d) {
  _ecoLastData = d;
  // user_admin es un string plano con el nombre de usuario
  const username = LS.get('user_admin', '');

  // Mis publicaciones: las del servidor (incluye pendientes) o, mientras cargan, las del catálogo
  const allMyContent = _ecoMias();
  ecoCargarStats();

  const totalDl       = d.descargasTotales || 0;
  const saldo         = d.saldo || 0;
  const juegosEleg    = d.juegosElegibles  || 0;
  const totalContent  = allMyContent.length;

  // ── Saldo progress ring toward $10 ──
  const ringPct = Math.min(saldo / 10, 1);
  const circumference = 314.16; // 2π×50
  const ringEl  = document.getElementById('eco-ring-fill');
  const pctEl   = document.getElementById('eco-ring-pct');
  if (ringEl) ringEl.style.strokeDashoffset = circumference * (1 - ringPct);
  if (pctEl)  pctEl.textContent = Math.round(ringPct * 100) + '%';

  // ── Trend badge ──
  const trendTxt = document.getElementById('eco-trend-txt');
  if (trendTxt) trendTxt.textContent = totalDl > 0 ? `${pfFmt(totalDl)} descargas totales` : 'Sin descargas aún';

  // ── RPM (revenue per download) ──
  const rpmEl = document.getElementById('eco-kpi-rpm');
  if (rpmEl) rpmEl.textContent = totalDl > 0 ? (saldo / totalDl / 0.02).toFixed(3) + ' UC' : '0 UC';   // UpCoins por descarga

  // ── Content subtitle ──
  const ctEl = document.getElementById('eco-kpi-content-total');
  if (ctEl) ctEl.textContent = `de ${totalContent} publicaciones`;

  // ── Followers ──
  const flEl = document.getElementById('eco-kpi-followers');
  // (antes usaba `userObj`, que no existía → ReferenceError y el panel se cortaba aquí)
  if (flEl) {
    flEl.textContent = document.getElementById('pf-stat-followers')?.textContent || '0';
    if (username) fetch(`${PF_API}/usuarios/stats-seguimiento/${encodeURIComponent(username)}`)
      .then(r => r.ok ? r.json() : null)
      .then(sd => { if (sd?.stats) flEl.textContent = pfFmt(sd.stats.seguidores || 0); })
      .catch(() => {});
  }

  // ── Period delta for KPI ──
  const dlDeltaEl = document.getElementById('eco-kpi-dl-delta');
  if (dlDeltaEl) {
    // Real (antes: total × días / 365, una estimación)
    dlDeltaEl.textContent = _ecoStats ? `${pfFmt(_ecoStats.totales.descargas)} en ${_ecoStats.dias} días` : '…';
  }

  // ── Chart badge ──
  const chartBadge = document.getElementById('eco-chart-badge');
  if (chartBadge) chartBadge.textContent = pfFmt(totalDl) + ' descargas';

  // ── Render sub-sections ──
  ecoDrawChart(totalDl, _ecoPeriodDays);
  ecoRenderLeaderboard(allMyContent);
  ecoRenderHealth(allMyContent);
  ecoRenderCategories(allMyContent);
  ecoRenderFunnel(totalDl, juegosEleg, saldo);
  ecoRenderGoals(saldo, totalDl, totalContent, juegosEleg);
  ecoRenderContentTable(allMyContent);
}

/* ── Bar Chart ── */
function ecoDrawChart(totalDl, periodDays) {
  const canvas = document.getElementById('eco-bar-chart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.parentElement.offsetWidth || 320;
  const H = 130;
  canvas.width  = W;
  canvas.height = H;

  // Datos REALES por día (/economia/mis-estadisticas). Antes se repartía el total con números
  // aleatorios: la gráfica cambiaba sola cada 8 s y no reflejaba nada.
  const serie = _ecoStats?.serie || [];
  const n = serie.length || 30;
  const counts = serie.length ? serie.map(x => x.d || 0) : Array(n).fill(0);

  const maxVal = Math.max(...counts, 1);
  const padL   = 34;
  const padR   = 6;
  const padT   = 8;
  const padB   = 20;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const barW   = Math.max(2, chartW / n - 2);

  ctx.clearRect(0, 0, W, H);

  // Grid lines + Y-axis labels
  for (let i = 0; i <= 4; i++) {
    const y = padT + (chartH / 4) * i;
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
    const val = Math.round(maxVal * (1 - i / 4));
    ctx.fillStyle = 'rgba(144,144,170,0.55)';
    ctx.font = `9px 'DM Mono', monospace`;
    ctx.textAlign = 'right';
    ctx.fillText(val >= 1000 ? (val / 1000).toFixed(1) + 'K' : val, padL - 4, y + 3);
  }

  // Bars
  const barGrad = ctx.createLinearGradient(0, padT, 0, padT + chartH);
  barGrad.addColorStop(0, 'rgba(50,213,131,.9)');
  barGrad.addColorStop(1, 'rgba(50,213,131,.18)');

  counts.forEach((val, i) => {
    const bH = Math.max(2, (val / maxVal) * chartH);
    const x  = padL + i * (chartW / n);
    const y  = padT + chartH - bH;
    ctx.fillStyle = barGrad;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, barW, bH, 2);
    else ctx.rect(x, y, barW, bH);
    ctx.fill();
  });

  // Trend line (moving average)
  const ma = counts.map((_, i) => {
    const slice = counts.slice(Math.max(0, i - 2), i + 3);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
  ctx.strokeStyle = 'rgba(90,200,250,0.55)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ma.forEach((val, i) => {
    const x = padL + i * (chartW / n) + barW / 2;
    const y = padT + chartH - Math.max(2, (val / maxVal) * chartH);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.setLineDash([]);

  // X-axis date labels
  const now = new Date();
  ctx.fillStyle = 'rgba(144,144,170,0.45)';
  ctx.font = `8px 'DM Mono', monospace`;
  ctx.textAlign = 'center';
  [0, Math.floor(n / 2), n - 1].forEach(i => {
    const d = new Date(now);
    d.setDate(d.getDate() - (n - 1 - i));
    const x = padL + i * (chartW / n) + barW / 2;
    ctx.fillText(`${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`, x, H - 4);
  });
}

/* ── Leaderboard ── */
function ecoRenderLeaderboard(items) {
  const el = document.getElementById('eco-leaderboard');
  if (!el) return;
  if (!items.length) {
    el.innerHTML = `<div class="eco-empty-mini"><ion-icon name="albums-outline"></ion-icon><p>Sin publicaciones aún</p></div>`;
    return;
  }
  const sorted = [...items].sort((a, b) => (b.descargasEfectivas || 0) - (a.descargasEfectivas || 0)).slice(0, 5);
  const maxDl  = sorted[0]?.descargasEfectivas || 1;
  const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
  const catColor = c => ({ Juego:'var(--g)', Mod:'#ff9800', Apps:'var(--cy)', Video:'#ff4c8b', Software:'#a78bfa', Ajustes:'#ffd700', Optimizacion:'#ff6b6b' }[c] || '#888');

  el.innerHTML = sorted.map((item, i) => {
    const dl  = item.descargasEfectivas || 0;
    const pct = dl / maxDl * 100;
    const col = catColor(item.category || item.categoria);
    return `<div class="eco-lb-row" onclick="ecoAbrir('${ugEsc(String(item._id || ''))}')" style="cursor:pointer">
      <div class="eco-lb-medal">${medals[i]}</div>
      <div class="eco-lb-info">
        <div class="eco-lb-title">${ugEsc(item.title || item.titulo || 'Sin título')}</div>
        <div class="eco-lb-cat" style="color:${col}">${ugEsc(catLabel(item.category || item.categoria || ''))}</div>
        <div class="eco-lb-bar-wrap"><div class="eco-lb-bar" style="width:${pct}%;background:${col}"></div></div>
      </div>
      <div class="eco-lb-stats">
        <div class="eco-lb-dl">${pfFmt(dl)}</div>
        <div class="eco-lb-dl-lbl">descargas</div>
      </div>
    </div>`;
  }).join('');
}

/* ── Health Score ── */
function ecoRenderHealth(items) {
  const totalReports = items.reduce((s, i) => s + (i.reportes || 0), 0);
  const totalDl      = items.reduce((s, i) => s + (i.descargasEfectivas || 0), 0);
  const activeCount  = items.filter(i => (i.descargasEfectivas || 0) > 0).length;
  const caidosCount  = items.filter(i => (i.reportes || 0) > 0).length;

  let score = items.length === 0 ? 0 : 100;
  if (totalDl > 0) score -= Math.min(50, (totalReports / totalDl) * 600);
  score = Math.max(0, Math.round(score));

  const grade = score >= 95 ? 'A+' : score >= 85 ? 'A' : score >= 75 ? 'B+' : score >= 65 ? 'B' : score >= 50 ? 'C' : 'D';
  const gradeColor = score >= 85 ? 'var(--g)' : score >= 60 ? '#ffd700' : '#ff4343';

  // Semicircle gauge (path total arc length ≈ 163.4)
  const arcLen = 163.4;
  const gaugeEl = document.getElementById('eco-gauge-arc');
  if (gaugeEl) {
    gaugeEl.style.strokeDasharray  = arcLen;
    gaugeEl.style.strokeDashoffset = arcLen - (score / 100) * arcLen;
    gaugeEl.style.stroke = gradeColor;
  }
  const vEl = document.getElementById('eco-health-val');
  const gEl = document.getElementById('eco-health-grade');
  if (vEl) vEl.textContent = score;
  if (gEl) { gEl.textContent = grade; gEl.style.color = gradeColor; }

  const rEl = document.getElementById('eco-h-reports');
  const aEl = document.getElementById('eco-h-active');
  const cEl = document.getElementById('eco-h-caidos');
  if (rEl) { rEl.textContent = totalReports; rEl.className = `eco-hv eco-hv--${totalReports === 0 ? 'good' : totalReports < 3 ? 'warn' : 'bad'}`; }
  if (aEl) { aEl.textContent = `${activeCount}/${items.length}`; aEl.className = 'eco-hv eco-hv--good'; }
  if (cEl) { cEl.textContent = caidosCount; cEl.className = `eco-hv eco-hv--${caidosCount === 0 ? 'good' : 'bad'}`; }
}

/* ── Category Breakdown ── */
function ecoRenderCategories(items) {
  const el = document.getElementById('eco-cat-list');
  if (!el) return;
  if (!items.length) { el.innerHTML = `<div class="eco-empty-mini" style="padding:16px"><ion-icon name="albums-outline"></ion-icon></div>`; return; }

  const cats = {};
  items.forEach(i => { const c = i.category || i.categoria || 'Otro'; cats[c] = (cats[c] || 0) + 1; });
  const total  = items.length;
  const sorted = Object.entries(cats).sort((a, b) => b[1] - a[1]);
  const colors = { Juego:'var(--g)', Mod:'#ff9800', Apps:'var(--cy)', Video:'#ff4c8b', Software:'#a78bfa', Ajustes:'#ffd700', Optimizacion:'#ff6b6b' };

  el.innerHTML = sorted.map(([cat, count]) => {
    const pct = Math.round(count / total * 100);
    const col = colors[cat] || '#888';
    return `<div class="eco-cat-item">
      <div class="eco-cat-label" style="color:${col}">${catLabel(cat)}</div>
      <div class="eco-cat-bar-wrap"><div class="eco-cat-bar" style="width:${pct}%;background:${col}"></div></div>
      <div class="eco-cat-count">${count} (${pct}%)</div>
    </div>`;
  }).join('');
}

/* ── Conversion Funnel ── */
function ecoRenderFunnel(totalDl, elegibles, saldo) {
  // Vistas, descargas y apoyos reales del periodo (antes: vistas = descargas × 4,2 inventado)
  const t = _ecoStats?.totales || { vistas: 0, descargas: 0, apoyos: 0 };
  const estViews = t.vistas, estInteract = t.descargas;
  totalDl = t.apoyos;
  const maxV = Math.max(estViews, estInteract, 1);

  const set = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
  const setW = (id, pct) => { const e = document.getElementById(id); if (e) e.style.width = pct + '%'; };

  set('eco-rv-views',    pfFmt(estViews));
  set('eco-rv-interact', pfFmt(estInteract));
  set('eco-rv-dl',       pfFmt(totalDl));
  set('eco-rv-earn',     pfFmt(elegibles));

  setW('eco-rb-views',    (estViews / maxV) * 100);
  setW('eco-rb-interact', (estInteract / maxV) * 100);
  setW('eco-rb-dl',       (totalDl / maxV) * 100);
  setW('eco-rb-earn',     (elegibles / Math.max(_ecoMias().length, 1)) * 100);

  const cvrEl = document.getElementById('eco-cvr');
  if (cvrEl) cvrEl.textContent = estViews > 0 ? ((estInteract / estViews) * 100).toFixed(1) + '%' : '—%';
  const nota = document.getElementById('eco-funnel-nota');
  if (nota) nota.textContent = _ecoStats ? `Datos reales de los últimos ${_ecoStats.dias} días` : 'Cargando datos…';
}

/* ── Goals & Milestones ── */
function ecoRenderGoals(saldo, totalDl, totalContent, elegibles) {
  const el = document.getElementById('eco-goals');
  if (!el) return;

  const goals = [
    { icon: '💰', label: 'Primer UpCoin ganado',    target: 0.02,  curr: saldo,        fmt: v => '🪙 ' + (v / 0.02).toFixed(1) },
    { icon: '📥', label: '50 descargas',             target: 50,    curr: totalDl,      fmt: v => pfFmt(v) },
    { icon: '📦', label: '5 publicaciones',          target: 5,     curr: totalContent, fmt: v => v },
    { icon: '🚀', label: '100 descargas',            target: 100,   curr: totalDl,      fmt: v => pfFmt(v) },
    { icon: '💸', label: 'Retiro disponible (500 UC)', target: 10,  curr: saldo,        fmt: v => '🪙 ' + Math.floor(v / 0.02) },
    { icon: '🏆', label: '10 publicaciones',         target: 10,    curr: totalContent, fmt: v => v },
    { icon: '⭐', label: '500 descargas',            target: 500,   curr: totalDl,      fmt: v => pfFmt(v) },
    { icon: '🔥', label: '1 000 descargas',          target: 1000,  curr: totalDl,      fmt: v => pfFmt(v) },
    { icon: '👑', label: '10 contenidos monetizados',target: 10,    curr: elegibles,    fmt: v => v },
    { icon: '💎', label: '5 000 descargas',          target: 5000,  curr: totalDl,      fmt: v => pfFmt(v) },
  ];

  el.innerHTML = goals.map(g => {
    const pct  = Math.min(100, (g.curr / g.target) * 100);
    const done = pct >= 100;
    return `<div class="eco-goal-row ${done ? 'eco-goal-done' : ''}">
      <div class="eco-goal-icon">${g.icon}</div>
      <div class="eco-goal-body">
        <div class="eco-goal-label">${g.label}</div>
        <div class="eco-goal-bar-wrap"><div class="eco-goal-bar" style="width:${pct}%"></div></div>
        <div class="eco-goal-progress">${g.fmt(g.curr)} / ${g.fmt(g.target)}</div>
      </div>
      <div class="eco-goal-check">${done ? '<ion-icon name="checkmark-circle" style="color:var(--g)"></ion-icon>' : ''}</div>
    </div>`;
  }).join('');
}

/* ── All Content Table ── */
function ecoRenderContentTable(items) {
  const el       = document.getElementById('eco-content-table');
  const countEl  = document.getElementById('eco-table-count');
  if (!el) return;
  if (countEl) countEl.textContent = items.length + ' items';

  if (!items.length) {
    el.innerHTML = `<div class="eco-empty-mini"><ion-icon name="albums-outline"></ion-icon><p>Aún no tienes publicaciones</p></div>`;
    return;
  }

  const sorted = [...items].sort((a, b) => (b.descargasEfectivas || 0) - (a.descargasEfectivas || 0));
  const maxDl  = sorted[0]?.descargasEfectivas || 1;
  const colors = { Juego:'var(--g)', Mod:'#ff9800', Apps:'var(--cy)', Video:'#ff4c8b', Software:'#a78bfa', Ajustes:'#ffd700', Optimizacion:'#ff6b6b' };
  const catShort = c => ({ Juego:'JUG', Mod:'MOD', Apps:'APP', Video:'VID', Software:'SW', Ajustes:'HER', Optimizacion:'OPT' }[c] || ugEsc(String(catLabel(c)).slice(0, 3).toUpperCase()));

  el.innerHTML = `
    <div class="eco-table-header">
      <span>CONTENIDO</span><span style="text-align:center">CAT.</span><span style="text-align:center">DL</span><span style="text-align:center">REP.</span>
    </div>
    <div class="eco-table-body">
      ${sorted.map(item => {
        const dl  = item.descargasEfectivas || 0;
        const rep = item.reportes || 0;
        const col = colors[item.categoria] || '#888';
        return `<div class="eco-table-row">
          <div class="eco-table-title-col">
            <div class="eco-table-title">${ugEsc(item.title || item.titulo || '—')}</div>
            <div class="eco-table-bar-wrap"><div class="eco-table-bar" style="width:${(dl/maxDl)*100}%;background:${col}"></div></div>
          </div>
          <div class="eco-table-cat" style="color:${col}">${catShort(item.category || item.categoria)}</div>
          <div class="eco-table-dl">${pfFmt(dl)}</div>
          <div class="eco-table-reps ${rep > 0 ? 'eco-reps-warn' : ''}">${rep}</div>
        </div>`;
      }).join('')}
    </div>`;
}

/* ── Re-draw chart on resize ── */
window.addEventListener('resize', () => {
  clearTimeout(_ecoChartTimer);
  _ecoChartTimer = setTimeout(() => {
    if (_ecoLastData) ecoDrawChart(_ecoLastData.descargasTotales || 0, _ecoPeriodDays);
  }, 200);
});
function pfFmt(n) {
  if(!n) return '0';
  if(n>=1e6) return (n/1e6).toFixed(1)+'M';
  if(n>=1e3) return (n/1e3).toFixed(1)+'K';
  return n.toString();
}
// ── MÉTODO DE COBRO (PayPal, Nequi, Daviplata, banco, Mercado Pago) ──
let _ecoCobroCfg = null;
function ecoCobroPintar(m, espera) {
  const box = document.getElementById('eco-cobro'); if (!box || box.dataset.editando) return;
  const ic = { paypal: '🅿️', nequi: '💜', daviplata: '🔴', banco: '🏦', mercadopago: '🤝' };
  box.innerHTML = m
    ? `<div class="eco-cobro-act"><span class="eco-cobro-ic">${ic[m.tipo] || '💳'}</span><div><b>${escH(m.resumen)}</b>${espera ? `<small>🔒 Por seguridad podrás retirar desde el ${new Date(espera).toLocaleString('es-CO')}</small>` : '<small>Aquí te enviamos tus retiros</small>'}</div><button type="button" class="eco-cobro-btn" onclick="ecoCobroEditar()">Cambiar</button></div>`
    : `<div class="eco-cobro-vacio"><p>Aún no has dicho dónde quieres recibir tu dinero.</p><button type="button" class="eco-cobro-btn p" onclick="ecoCobroEditar()">Configurar método de cobro</button></div>`;
}
async function ecoCobroEditar() {
  const box = document.getElementById('eco-cobro'); if (!box) return;
  try { if (!_ecoCobroCfg) _ecoCobroCfg = await (await fetch(`${PF_API}/economia/metodo-cobro`, { headers: { Authorization: `Bearer ${LS.get('token')}` } })).json(); }
  catch (_) { toast('❌ Error de conexión'); return; }
  const c = _ecoCobroCfg; box.dataset.editando = '1';
  const opt = (arr, sel) => arr.map(x => `<option ${x === sel ? 'selected' : ''}>${escH(x)}</option>`).join('');
  const campos = {
    paypal: `<input name="email" type="email" placeholder="Email de tu cuenta PayPal" autocomplete="email">`,
    nequi: `<input name="celular" inputmode="numeric" placeholder="Celular Nequi (10 dígitos)"><input name="titular" placeholder="Nombre del titular">`,
    daviplata: `<input name="celular" inputmode="numeric" placeholder="Celular Daviplata (10 dígitos)"><input name="titular" placeholder="Nombre del titular">`,
    mercadopago: `<input name="cuenta" placeholder="Email o celular de tu cuenta Mercado Pago"><input name="titular" placeholder="Nombre del titular">`,
    banco: `<select name="banco"><option value="">Banco…</option>${opt(c.bancos)}</select><select name="tipoCuenta"><option value="ahorros">Ahorros</option><option value="corriente">Corriente</option></select>
      <input name="numero" inputmode="numeric" placeholder="Número de cuenta"><input name="titular" placeholder="Titular (como aparece en el banco)">
      <div class="eco-cobro-2"><select name="tipoDoc">${opt(c.tiposDoc, 'CC')}</select><input name="documento" placeholder="Número de documento"></div>`,
  };
  box.innerHTML = `<div class="eco-cobro-form">
    <div class="eco-cobro-tipos">${c.tipos.map((t, i) => `<button type="button" data-t="${t.id}" class="${i === 0 ? 'on' : ''}">${escH(t.nombre)}</button>`).join('')}</div>
    <div class="eco-cobro-campos"></div>
    <input name="password" type="password" placeholder="Tu contraseña de UpGames (para confirmar)" autocomplete="current-password">
    <p class="eco-cobro-nota">🔒 Tus datos se guardan cifrados y solo se usan para enviarte tus retiros. Si cambias un método ya configurado, por seguridad los retiros quedan en espera ${c.esperaHoras} h y te avisamos por email.
      <b>No se puede pagar a un número de tarjeta</b>: si tienes tarjeta débito, usa la cuenta, Nequi o Daviplata asociada.</p>
    <div class="eco-cobro-acc"><button type="button" class="eco-cobro-btn" data-a="cancelar">Cancelar</button><button type="button" class="eco-cobro-btn p" data-a="guardar">Guardar</button></div></div>`;
  let tipo = c.tipos[0].id;
  const pintarCampos = () => { box.querySelector('.eco-cobro-campos').innerHTML = campos[tipo]; };
  pintarCampos();
  box.querySelectorAll('.eco-cobro-tipos button').forEach(b => b.onclick = () => { tipo = b.dataset.t; box.querySelectorAll('.eco-cobro-tipos button').forEach(x => x.classList.toggle('on', x === b)); pintarCampos(); });
  box.querySelector('[data-a="cancelar"]').onclick = () => { delete box.dataset.editando; pfLoadEconomia(); };
  box.querySelector('[data-a="guardar"]').onclick = async e => {
    const datos = {}; box.querySelectorAll('.eco-cobro-campos [name]').forEach(x => datos[x.name] = x.value);
    const password = box.querySelector('[name="password"]').value;
    if (!password) { toast('⚠️ Escribe tu contraseña para confirmar'); return; }
    e.target.disabled = true;
    try {
      const r = await fetch(`${PF_API}/economia/metodo-cobro`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${LS.get('token')}` }, body: JSON.stringify({ tipo, datos, password }) });
      const d = await r.json();
      if (d.success) { toast('✅ ' + d.mensaje); delete box.dataset.editando; ecoCobroPintar(d.metodo, d.esperaHasta); pfLoadEconomia(); }
      else { toast('❌ ' + (d.error || 'Error')); e.target.disabled = false; }
    } catch (_) { toast('❌ Error de conexión'); e.target.disabled = false; }
  };
}
async function pfSolicitarPago() {
  const ok = await customConfirm({
    icon: '💸',
    title: 'Solicitar pago',
    msg: '¿Confirmas que deseas retirar tus UpCoins ganados? Te pagamos su valor en dinero al método de cobro que configuraste, normalmente en 24-72 h hábiles.',
    okText: 'Solicitar',
    okDanger: false
  });
  if(!ok) return;
  const token = LS.get('token');
  try {
    const res = await fetch(`${PF_API}/economia/solicitar-pago`,{
      method:'POST', headers:{ Authorization:`Bearer ${token}` }
    });
    const d = await res.json();
    if(d.success) { toast('✅ '+d.mensaje); pfLoadEconomia(); }
    else toast('❌ '+(d.error||'Error'));
  } catch(e) { toast('❌ Error de conexión'); }
}

// ── TARJETAS ──────────────────────────────────────────────
let _tarjetaFormVisible = false;

function _detectarTipoTarjeta(num) {
  const n = num.replace(/\D/g,'');
  if (/^4/.test(n)) return 'visa';
  if (/^5[1-5]/.test(n) || /^2(2[2-9]|[3-6]\d|7[01]\d|720)/.test(n)) return 'mastercard';
  if (/^3[47]/.test(n)) return 'amex';
  return 'otro';
}

function _luhnCheck(num) {
  const digits = num.replace(/\D/g,'').split('').reverse().map(Number);
  const sum = digits.reduce((acc, d, i) => {
    if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; }
    return acc + d;
  }, 0);
  return sum % 10 === 0;
}

function _onCardNumInput(input) {
  const raw = input.value.replace(/\D/g,'').substring(0, 16);
  input.value = raw.replace(/(.{4})/g,'$1 ').trim();
  const tipo = _detectarTipoTarjeta(raw);
  const tipoEl = document.getElementById('pf-tarjeta-tipo-detected');
  if (tipoEl) {
    const names = { visa:'VISA', mastercard:'MC', amex:'AMEX', otro:'' };
    tipoEl.textContent = names[tipo] || '';
    tipoEl.className = `pf-tipo-badge pf-tipo-badge--${tipo}`;
  }
}

function pfMostrarFormTarjeta() {
  const form = document.getElementById('pf-form-tarjeta');
  if (!form) return;
  _tarjetaFormVisible = !_tarjetaFormVisible;
  form.style.display = _tarjetaFormVisible ? 'block' : 'none';
  const btn = document.getElementById('pf-btn-add-tarjeta');
  if (btn) btn.innerHTML = _tarjetaFormVisible
    ? '<ion-icon name="close-outline"></ion-icon> CANCELAR'
    : '<ion-icon name="add-circle-outline"></ion-icon> AGREGAR';
  if (_tarjetaFormVisible) {
    setTimeout(() => form.scrollIntoView({ behavior:'smooth', block:'nearest' }), 100);
  }
}

async function pfLoadTarjetas() {
  const token = LS.get('token');
  if (!token) return;
  const list = document.getElementById('pf-tarjetas-list');
  if (!list) return;
  try {
    const res = await fetch(`${PF_API}/economia/mis-tarjetas`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return;
    const d = await res.json();
    if (!d.success || !d.tarjetas?.length) {
      list.innerHTML = `<div class="pf-tarjetas-empty">
        <ion-icon name="card-outline"></ion-icon>
        <p>No tienes tarjetas registradas</p>
      </div>`;
      return;
    }
    const logos = { visa:'VISA', mastercard:'MC', amex:'AMEX', otro:'···' };
    const propLabel = { cobros:'↓ Cobros', pagos:'↑ Pagos', ambos:'↕ Ambos' };
    list.innerHTML = d.tarjetas.map(t => `
      <div class="pf-tarjeta-card${t.esPrincipal ? ' principal' : ''}" data-id="${t._id}">
        <div class="pf-tarjeta-left">
          <div class="pf-tarjeta-logo pf-tarjeta-logo--${t.tipo}">${logos[t.tipo]||'···'}</div>
          <div class="pf-tarjeta-info">
            <div class="pf-tarjeta-num">•••• •••• •••• ${t.ultimos4}</div>
            <div class="pf-tarjeta-titular">${t.titular}</div>
            <div class="pf-tarjeta-meta">
              <span class="pf-tarjeta-exp">Exp: ${t.mesExp}/${t.anioExp}</span>
              <span class="pf-tarjeta-prop pf-tarjeta-prop--${t.proposito}">${propLabel[t.proposito]||'↕ Ambos'}</span>
            </div>
            ${t.alias ? `<div class="pf-tarjeta-alias">${t.alias}</div>` : ''}
          </div>
        </div>
        <div class="pf-tarjeta-actions">
          ${!t.esPrincipal
            ? `<button class="pf-tarjeta-btn principal-btn" onclick="pfSetTarjetaPrincipal('${t._id}')" title="Principal"><ion-icon name="star-outline"></ion-icon></button>`
            : `<span class="pf-tarjeta-principal-badge" title="Tarjeta principal"><ion-icon name="star"></ion-icon></span>`
          }
          <button class="pf-tarjeta-btn del-btn" onclick="pfEliminarTarjeta('${t._id}')" title="Eliminar"><ion-icon name="trash-outline"></ion-icon></button>
        </div>
      </div>`).join('');
  } catch(e) {
    list.innerHTML = `<div class="pf-tarjetas-empty" style="color:#ff4343"><p>Error al cargar tarjetas</p></div>`;
  }
}

async function pfGuardarTarjeta() {
  const numEl   = document.getElementById('pf-input-card-num');
  const titEl   = document.getElementById('pf-input-card-tit');
  const mesEl   = document.getElementById('pf-input-card-mes');
  const anioEl  = document.getElementById('pf-input-card-anio');
  const propEl  = document.getElementById('pf-input-card-prop');
  const aliasEl = document.getElementById('pf-input-card-alias');
  if (!numEl) return;

  const rawNum  = numEl.value.replace(/\D/g,'');
  const titular = titEl.value.trim();
  const mes     = mesEl.value.trim();
  const anio    = anioEl.value.trim();
  const prop    = propEl.value;
  const alias   = aliasEl.value.trim();

  if (rawNum.length < 13 || rawNum.length > 19) { toast('⚠️ Número de tarjeta inválido'); return; }
  if (!_luhnCheck(rawNum)) { toast('⚠️ Número de tarjeta incorrecto'); return; }
  if (!titular) { toast('⚠️ Ingresa el nombre del titular'); return; }
  const mesN = parseInt(mes, 10);
  if (!mes || mesN < 1 || mesN > 12) { toast('⚠️ Mes inválido (01-12)'); return; }
  const anioN = parseInt(anio, 10);
  const now = new Date();
  const nowYear = now.getFullYear() % 100;
  const nowMonth = now.getMonth() + 1;
  if (!anio || anioN < nowYear || (anioN === nowYear && mesN < nowMonth)) { toast('⚠️ Tarjeta vencida'); return; }

  const ultimos4 = rawNum.slice(-4);
  const tipo = _detectarTipoTarjeta(rawNum);
  const token = LS.get('token');

  const btn = document.getElementById('pf-btn-guardar-tarjeta');
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando…'; }

  try {
    const res = await fetch(`${PF_API}/economia/agregar-tarjeta`, {
      method: 'POST',
      headers: { 'Content-Type':'application/json', Authorization:`Bearer ${token}` },
      body: JSON.stringify({ ultimos4, titular, mesExp: mes.padStart(2,'0'), anioExp: anio, tipo, proposito: prop, alias })
    });
    const d = await res.json();
    if (d.success) {
      toast('✅ Tarjeta registrada');
      numEl.value=''; titEl.value=''; mesEl.value=''; anioEl.value=''; aliasEl.value=''; propEl.value='ambos';
      const tipoEl = document.getElementById('pf-tarjeta-tipo-detected');
      if (tipoEl) { tipoEl.textContent=''; tipoEl.className='pf-tipo-badge'; }
      if (_tarjetaFormVisible) pfMostrarFormTarjeta();
      await pfLoadTarjetas();
    } else {
      toast('❌ '+(d.error||'Error al guardar'));
    }
  } catch(e) {
    toast('❌ Error de conexión');
  } finally {
    if (btn) { btn.disabled=false; btn.innerHTML='<ion-icon name="save-outline"></ion-icon> GUARDAR TARJETA'; }
  }
}

async function pfEliminarTarjeta(tarjetaId) {
  const ok = await customConfirm({
    icon: '🗑️',
    title: 'Eliminar tarjeta',
    msg: '¿Confirmas que deseas eliminar esta tarjeta?',
    okText: 'Eliminar',
    okDanger: true
  });
  if (!ok) return;
  const token = LS.get('token');
  try {
    const res = await fetch(`${PF_API}/economia/eliminar-tarjeta/${tarjetaId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    const d = await res.json();
    if (d.success) { toast('✅ Tarjeta eliminada'); pfLoadTarjetas(); }
    else toast('❌ '+(d.error||'Error'));
  } catch(e) { toast('❌ Error de conexión'); }
}

async function pfSetTarjetaPrincipal(tarjetaId) {
  const token = LS.get('token');
  try {
    const res = await fetch(`${PF_API}/economia/tarjeta-principal/${tarjetaId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` }
    });
    const d = await res.json();
    if (d.success) { toast('⭐ Tarjeta principal actualizada'); pfLoadTarjetas(); }
    else toast('❌ '+(d.error||'Error'));
  } catch(e) { toast('❌ Error de conexión'); }
}

// ── Settings Modal ──
// Editar perfil: 3 grupos (Perfil · Estilo · Cuenta) con vista previa en vivo.
// pfOpenSettings('avatar'|'portada'|'bio'|'links'|'nombre'|'email'|'pass'|'repair'|'estilo') sigue funcionando.
const PFX_GRUPO = { avatar: 'perfil', portada: 'perfil', bio: 'perfil', links: 'perfil', estilo: 'estilo', nombre: 'cuenta', email: 'cuenta', pass: 'cuenta', repair: 'cuenta' };
function pfOpenSettings(tab) {
  document.getElementById('pf-settingsModal').classList.add('show');
  document.body.style.overflow='hidden';
  pfSwitchSettings(typeof tab === 'string' ? tab : 'avatar');
  pfxVista();
}
function pfCloseSettings() {
  document.getElementById('pf-settingsModal').classList.remove('show');
  document.body.style.overflow='';
}
function pfxGrupo(g) {
  document.querySelectorAll('#pf-settingsModal .pfx-tabs [data-g]').forEach(b => { const on = b.dataset.g === g; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
  document.querySelectorAll('#pf-settingsModal .pfx-grupo').forEach(x => x.classList.toggle('on', x.dataset.g === g));
  if (g === 'estilo') window.UGX?.tienda?.(pfxGrupo.tipo || 'pack', document.getElementById('pfx-estilo'));   // abre en Packs (si no hay, en Marcos)
}
function pfSwitchSettings(type, el) {
  const g = PFX_GRUPO[type] || 'perfil';
  pfxGrupo(g);
  const card = document.getElementById(`pf-settings-${type}`);
  if (card?.classList.contains('pfx-plegable')) card.classList.add('abierto');
  if (card && type !== 'avatar') setTimeout(() => card.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  else document.querySelector('#pf-settingsModal .pf-modal-sheet')?.scrollTo({ top: 0 });
}
function pfxPlegar(b) { b.closest('.pfx-plegable')?.classList.toggle('abierto'); }
document.querySelectorAll('#pf-settingsModal .pfx-tabs [data-g]').forEach(b => b.addEventListener('click', () => pfxGrupo(b.dataset.g)));
/** Vista previa: foto, portada o fondo, color del nombre e insignias, tal como te ven los demás. */
async function pfxVista() {
  const yo = LS.get('user_admin', ''); if (!yo) return;
  const av = document.getElementById('pfx-vista-av'), nom = document.getElementById('pfx-vista-nombre'), fondo = document.getElementById('pfx-vista-fondo');
  if (!av) return;
  const img = document.getElementById('pf-avatar-img'), foto = img && img.style.display !== 'none' ? img.getAttribute('src') : '';
  nom.textContent = '@' + yo;
  document.getElementById('pfx-vista-bio').textContent = (document.getElementById('pf-bio')?.textContent || '').replace(/^Sin biografía$/, '').slice(0, 90);
  const banner = document.getElementById('pf-cover')?.style.backgroundImage || '';
  const mio = await window.UGX?.cargarMio?.().catch(() => null), est = mio?.estilo || {};
  window.UGX?.pintarAvatar?.(av, { avatar: foto, estilo: est }, (yo[0] || '?').toUpperCase());
  window.UGX?.aplicarEstilo?.(est, { nombre: nom, fondo });
  fondo.style.backgroundImage = !est.fondo && /url\(/.test(banner) ? banner : '';
  document.getElementById('pfx-vista-ins').innerHTML = window.UGX?.insigniasHTML?.(est.insignias) || '';
}
window.pfxVista = pfxVista;
function pfUpdateAvatarPreview() {
  const url = document.getElementById('pf-input-avatar-url').value;
  const prev = document.getElementById('pf-preview-avatar');
  if(url) { prev.innerHTML=''; const pi=document.createElement('img'); pi.src=url; pi.alt='Avatar'; prev.appendChild(pi); }
  else prev.innerHTML='<ion-icon name="person"></ion-icon>';
}
async function pfSaveAvatar() {
  const url = document.getElementById('pf-input-avatar-url').value.trim();
  if(!url) { toast('⚠️ Ingresa una URL de avatar'); return; }
  try {
    const _avatarToken = LS.get('token');
    const res = await fetch(`${PF_API}/usuarios/update-avatar`,{
      method:'PUT',
      headers:{'Content-Type':'application/json','Authorization':`Bearer ${_avatarToken}`},
      body: JSON.stringify({ nuevaFoto:url })
    });
    if(res.ok) {
      toast('✅ Avatar actualizado');
      const img = document.getElementById('pf-avatar-img');
      img.src=url; img.style.display='block';
      document.getElementById('pf-avatar-icon').style.display='none';
      pfCloseSettings();
    } else { const d = await res.json().catch(() => ({})); toast('❌ ' + (d.error || 'Error al actualizar avatar')); }
  } catch(e) { toast('❌ Error de conexión'); }
}

