const session = requireAuth('admin');
if (!session) throw new Error('unauthorized');

let chartKas = null;
let chartDebt = null;
let isSorted = false;
let isFilterNunggak = false;

document.getElementById('villa-name').textContent = state.config.villaName || 'Kas Villa';

document.querySelectorAll('.nav-item').forEach((btn) => {
  btn.addEventListener('click', () => {
    const panel = btn.dataset.panel;
    document.querySelectorAll('.nav-item').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.panel').forEach((p) => p.classList.remove('active'));
    document.getElementById('panel-' + panel).classList.add('active');
    document.getElementById('page-title').textContent = btn.textContent.trim();
    closeSidebar();
    if (panel === 'members') renderMembers();
    if (panel === 'transactions') renderTransactions();
    if (panel === 'claims') renderClaims();
    if (panel === 'announcements') renderAnnouncementsAdmin();
    if (panel === 'activity') renderActivity();
    if (panel === 'overview') renderOverview();
  });
});

function openSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('overlay').classList.add('show');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('overlay').classList.remove('show');
}

function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2800);
}

function renderOverview() {
  const t = getTotals();
  document.getElementById('kpi-members').textContent = state.members.length + ' orang';
  document.getElementById('kpi-masuk').textContent = formatRupiah(t.masuk);
  document.getElementById('kpi-keluar').textContent = formatRupiah(t.keluar);
  document.getElementById('kpi-saldo').textContent = formatRupiah(t.saldo);
  document.getElementById('kpi-nunggak').textContent = t.penunggak + ' orang';

  const pct = t.target ? Math.round((t.collected / t.target) * 100) : 0;
  document.getElementById('progress-pct').textContent = pct + '%';
  document.getElementById('progress-fill').style.width = pct + '%';
  document.getElementById('progress-collected').textContent = 'Terkumpul: ' + formatRupiah(t.collected);
  document.getElementById('progress-target').textContent = 'Target: ' + formatRupiah(t.target);

  const kasCtx = document.getElementById('chart-kas');
  const kasData = {
    labels: ['Masuk', 'Keluar'],
    datasets: [{ data: [t.masuk, t.keluar], backgroundColor: ['#4ECDC4', '#E05A7A'], borderWidth: 0 }]
  };
  if (chartKas) {
    chartKas.data = kasData;
    chartKas.update();
  } else {
    chartKas = new Chart(kasCtx, {
      type: 'doughnut',
      data: kasData,
      options: { cutout: '78%', plugins: { legend: { display: false } }, responsive: true, maintainAspectRatio: false }
    });
  }

  const debts = state.members
    .map((m) => {
      const s = getMemberStats(m);
      return { name: m.name, total: s.totalUnpaid };
    })
    .filter((x) => x.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

  const debtCtx = document.getElementById('chart-debt');
  const debtData = {
    labels: debts.map((d) => d.name),
    datasets: [{ data: debts.map((d) => d.total), backgroundColor: '#7C6FCD', borderRadius: 6 }]
  };
  if (chartDebt) {
    chartDebt.data = debtData;
    chartDebt.update();
  } else {
    chartDebt = new Chart(debtCtx, {
      type: 'bar',
      data: debtData,
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#E8E6F0' }, grid: { color: 'rgba(124,111,205,0.1)' } },
          y: { ticks: { color: '#E8E6F0', font: { size: 10 } }, grid: { display: false } }
        }
      }
    });
  }

  let mini = '';
  for (let i = 0; i < state.config.count; i++) {
    const weekly = state.members.filter((m) => m.weeks[i]).length * state.config.nominal;
    mini += `<div class="card kpi" style="padding:10px;margin:0;border-color:var(--accent)">
      <div class="kpi-label">${state.config.prefix}${i + 1}</div>
      <div class="kpi-value" style="font-size:0.9rem">${weekly ? formatRupiah(weekly) : '-'}</div>
    </div>`;
  }
  document.getElementById('weekly-mini').innerHTML = mini || '<div class="empty">Belum ada periode</div>';

  updateClaimsBadge();
}

function updateClaimsBadge() {
  const pending = state.paymentClaims.filter((c) => c.status === 'pending').length;
  const badge = document.getElementById('badge-claims');
  if (pending > 0) {
    badge.style.display = 'inline';
    badge.textContent = pending;
  } else badge.style.display = 'none';
}

function renderMembers() {
  let head = '<th class="name-col">Anggota</th>';
  for (let i = 1; i <= state.config.count; i++) head += `<th>${state.config.prefix}${i}</th>`;
  document.getElementById('table-head').innerHTML = head;

  const q = (document.getElementById('search-member')?.value || '').toLowerCase();
  let list = state.members.map((m) => ({ ...m, ...getMemberStats(m) }));

  if (isFilterNunggak) list = list.filter((m) => m.unpaidCount > 0);
  if (isSorted) list.sort((a, b) => b.unpaidCount - a.unpaidCount);
  if (q) list = list.filter((m) => m.name.toLowerCase().includes(q));

  const body = document.getElementById('member-body');
  if (!list.length) {
    body.innerHTML = `<tr><td colspan="${state.config.count + 1}"><div class="empty"><i class="ti ti-users"></i> Belum ada anggota</div></td></tr>`;
    return;
  }

  body.innerHTML = list
    .map((m) => {
      const status = m.isLunas ? 'badge-success' : 'badge-danger';
      const statusText = m.isLunas ? 'Lunas' : `${m.payCount}/${state.config.count}`;
      let row = `<tr><td class="name-col">
        <div>${m.name}</div>
        <span class="badge ${status}">${statusText}</span>
        <div class="filter-bar no-print" style="margin-top:6px">
          <button class="btn-icon" onclick="editMember(${m.id})" title="Edit"><i class="ti ti-pencil"></i></button>
          <button class="btn-icon" onclick="showPin(${m.id})" title="PIN"><i class="ti ti-key"></i></button>
          <button class="btn-icon" onclick="deleteMember(${m.id})" title="Hapus"><i class="ti ti-trash"></i></button>
          ${!m.isLunas ? `<button class="btn-icon" style="color:#25D366" onclick="sendWA(${m.id})"><i class="ti ti-brand-whatsapp"></i></button>` : ''}
        </div>
      </td>`;
      m.weeks.forEach((w, idx) => {
        row += `<td><input type="checkbox" class="no-print" style="width:18px;height:18px" ${w ? 'checked' : ''} onchange="toggleWeek(${m.id},${idx})"></td>`;
      });
      return row + '</tr>';
    })
    .join('');
}

function renderTransactions() {
  const el = document.getElementById('tx-list');
  if (!state.transactions.length) {
    el.innerHTML = '<div class="empty"><i class="ti ti-receipt-off"></i> Belum ada transaksi</div>';
    return;
  }
  el.innerHTML = state.transactions
    .map((t) => {
      const inc = t.type === 'masuk';
      return `<div class="tx-list-item">
        <div class="tx-icon ${inc ? 'in' : 'out'}"><i class="ti ti-${inc ? 'arrow-down-left' : 'arrow-up-right'}"></i></div>
        <div style="flex:1">
          <div style="font-weight:700">${t.desc}</div>
          <div style="font-size:11px;color:var(--text-muted)">${formatDate(t.date)} · ${t.cat || 'Manual'}</div>
        </div>
        <div style="font-weight:800;color:var(--${inc ? 'green' : 'red'})">${inc ? '+' : '-'} ${formatRupiah(t.amount)}</div>
        <div class="no-print" style="display:flex;gap:6px">
          <button class="btn-icon" onclick="editTx('${t.id}')"><i class="ti ti-pencil"></i></button>
          <button class="btn-icon" onclick="deleteTx('${t.id}')"><i class="ti ti-trash"></i></button>
        </div>
      </div>`;
    })
    .join('');
}

function renderClaims() {
  const pending = state.paymentClaims.filter((c) => c.status === 'pending');
  const el = document.getElementById('claims-list');
  if (!pending.length) {
    el.innerHTML = '<div class="empty">Tidak ada laporan menunggu persetujuan</div>';
    return;
  }
  el.innerHTML = pending
    .map((c) => {
      const m = findMemberById(c.memberId);
      if (!m) return '';
      return `<div class="tx-list-item">
        <div style="flex:1">
          <strong>${m.name}</strong> — ${state.config.prefix}${c.weekIndex + 1}
          <div style="font-size:11px;color:var(--text-muted)">${formatDateTime(c.date)} · ${formatRupiah(state.config.nominal)}</div>
        </div>
        <button class="btn btn-success btn-sm" onclick="approveClaim('${c.id}')"><i class="ti ti-check"></i> Setujui</button>
        <button class="btn btn-outline btn-sm" onclick="rejectClaim('${c.id}')">Tolak</button>
      </div>`;
    })
    .join('');
  updateClaimsBadge();
}

function renderAnnouncementsAdmin() {
  const el = document.getElementById('ann-list-admin');
  if (!state.announcements.length) {
    el.innerHTML = '<div class="empty">Belum ada pengumuman</div>';
    return;
  }
  el.innerHTML = state.announcements
    .map(
      (a) => `<div class="announcement">
      <strong>${a.title}</strong>
      <p style="margin:8px 0;font-size:0.88rem">${a.body}</p>
      <div style="font-size:11px;color:var(--text-muted)">${formatDate(a.date)}</div>
      <button class="btn btn-outline btn-sm no-print" style="margin-top:8px" onclick="deleteAnn('${a.id}')">Hapus</button>
    </div>`
    )
    .join('');
}

function renderActivity() {
  const el = document.getElementById('activity-list');
  if (!state.activityLog.length) {
    el.innerHTML = '<div class="empty">Belum ada aktivitas</div>';
    return;
  }
  el.innerHTML = state.activityLog
    .slice(0, 50)
    .map(
      (a) => `<div class="activity-item">
      <div class="activity-dot"></div>
      <div><div>${a.action}</div><div style="font-size:11px;color:var(--text-muted)">${a.actor} · ${formatDateTime(a.date)}</div></div>
    </div>`
    )
    .join('');
}

function openMemberModal(member) {
  document.getElementById('modal-title').textContent = member ? 'Edit Anggota' : 'Tambah Anggota';
  document.getElementById('modal-mode').value = 'member';
  document.getElementById('modal-id').value = member?.id || '';
  document.getElementById('modal-name').value = member?.name || '';
  document.getElementById('modal-phone').value = member?.phone || '628';
  document.getElementById('modal-tx-fields').style.display = 'none';
  document.getElementById('modal-pin-hint').style.display = member ? 'block' : 'none';
  if (member) {
    const pin = ensureMemberPin(member);
    document.getElementById('modal-pin-hint').textContent = 'PIN anggota: ' + pin + ' (beri ke anggota untuk login portal)';
  }
  document.getElementById('modal-save').onclick = saveMemberModal;
  document.getElementById('modal').classList.add('open');
}

function closeModal() {
  document.getElementById('modal').classList.remove('open');
}

function saveMemberModal() {
  const mode = document.getElementById('modal-mode').value;
  if (mode === 'member') {
    const name = document.getElementById('modal-name').value.trim();
    const phone = document.getElementById('modal-phone').value.trim();
    if (!name || !phone) return alert('Nama dan nomor wajib diisi');
    const id = document.getElementById('modal-id').value;
    if (id) {
      const m = findMemberById(parseInt(id));
      m.name = name;
      m.phone = phone;
      logActivity(`Data anggota ${name} diperbarui`, 'Admin');
    } else {
      const newM = {
        id: Date.now(),
        name,
        phone,
        weeks: Array(state.config.count).fill(false),
        pin: String(1000 + Math.floor(Math.random() * 9000))
      };
      state.members.push(newM);
      logActivity(`Anggota baru: ${name}`, 'Admin');
      toast('Anggota ditambah. PIN: ' + newM.pin);
    }
    saveState();
    closeModal();
    renderMembers();
    renderOverview();
  } else if (mode === 'tx') {
    const id = document.getElementById('modal-id').value;
    const t = state.transactions.find((x) => x.id === id);
    t.desc = document.getElementById('modal-name').value;
    t.amount = parseInt(document.getElementById('modal-amount').value) || 0;
    t.type = document.getElementById('modal-tx-type').value;
    saveState();
    closeModal();
    renderTransactions();
    renderOverview();
  }
}

function editMember(id) {
  openMemberModal(findMemberById(id));
}

function showPin(id) {
  const m = findMemberById(id);
  const pin = ensureMemberPin(m);
  alert(`PIN ${m.name}: ${pin}\n\nAnggota login dengan nomor WA + PIN ini.`);
}

function deleteMember(id) {
  const m = findMemberById(id);
  if (!confirm(`Hapus anggota ${m.name}?`)) return;
  state.members = state.members.filter((x) => x.id !== id);
  state.transactions = state.transactions.filter((t) => !String(t.id).includes(`iuran-${id}`));
  state.paymentClaims = state.paymentClaims.filter((c) => c.memberId !== id);
  logActivity(`Anggota ${m.name} dihapus`, 'Admin');
  saveState();
  renderMembers();
  renderOverview();
}

function toggleWeek(mid, idx) {
  const m = findMemberById(mid);
  const key = `iuran-${mid}-${idx}`;
  if (!m.weeks[idx]) {
    m.weeks[idx] = true;
    state.transactions.unshift({
      id: key,
      type: 'masuk',
      cat: 'Iuran',
      desc: `Iuran ${state.config.prefix}${idx + 1} - ${m.name}`,
      amount: state.config.nominal,
      date: new Date().toISOString()
    });
    logActivity(`Iuran ${state.config.prefix}${idx + 1} dicatat: ${m.name}`, 'Admin');
  } else {
    if (!confirm(`Batalkan iuran ${state.config.prefix}${idx + 1} untuk ${m.name}?`)) {
      renderMembers();
      return;
    }
    m.weeks[idx] = false;
    state.transactions = state.transactions.filter((t) => t.id !== key);
    logActivity(`Iuran dibatalkan: ${m.name} ${state.config.prefix}${idx + 1}`, 'Admin');
  }
  saveState();
  renderMembers();
  renderOverview();
}

function addTx() {
  const desc = document.getElementById('tx-desc').value.trim();
  const amount = parseInt(document.getElementById('tx-amount').value);
  const type = document.getElementById('tx-type').value;
  if (!desc || !amount) return alert('Lengkapi keterangan dan nominal');
  state.transactions.unshift({
    id: 'manual-' + Date.now(),
    type,
    cat: 'Manual',
    desc,
    amount,
    date: new Date().toISOString()
  });
  logActivity(`Transaksi: ${desc} (${formatRupiah(amount)})`, 'Admin');
  document.getElementById('tx-desc').value = '';
  document.getElementById('tx-amount').value = '';
  saveState();
  renderTransactions();
  renderOverview();
  toast('Transaksi disimpan');
}

function editTx(id) {
  const t = state.transactions.find((x) => x.id === id);
  document.getElementById('modal-title').textContent = 'Edit Transaksi';
  document.getElementById('modal-mode').value = 'tx';
  document.getElementById('modal-id').value = t.id;
  document.getElementById('modal-name').value = t.desc;
  document.getElementById('modal-amount').value = t.amount;
  document.getElementById('modal-tx-type').value = t.type;
  document.getElementById('modal-tx-fields').style.display = 'flex';
  document.getElementById('modal-pin-hint').style.display = 'none';
  document.getElementById('modal-save').onclick = saveMemberModal;
  document.getElementById('modal').classList.add('open');
}

function deleteTx(id) {
  const t = state.transactions.find((x) => x.id === id);
  if (!confirm('Hapus transaksi ' + t.desc + '?')) return;
  state.transactions = state.transactions.filter((x) => x.id !== id);
  logActivity('Transaksi dihapus: ' + t.desc, 'Admin');
  saveState();
  renderTransactions();
  renderOverview();
}

function approveClaim(claimId) {
  const c = state.paymentClaims.find((x) => x.id === claimId);
  if (!c || c.status !== 'pending') return;
  const m = findMemberById(c.memberId);
  if (!m || m.weeks[c.weekIndex]) {
    c.status = 'rejected';
    saveState();
    renderClaims();
    return;
  }
  m.weeks[c.weekIndex] = true;
  const key = `iuran-${m.id}-${c.weekIndex}`;
  state.transactions.unshift({
    id: key,
    type: 'masuk',
    cat: 'Iuran',
    desc: `Iuran ${state.config.prefix}${c.weekIndex + 1} - ${m.name} (konfirmasi)`,
    amount: state.config.nominal,
    date: new Date().toISOString()
  });
  c.status = 'approved';
  logActivity(`Konfirmasi disetujui: ${m.name} ${state.config.prefix}${c.weekIndex + 1}`, 'Admin');
  saveState();
  toast('Pembayaran disetujui');
  renderClaims();
  renderMembers();
  renderOverview();
}

function rejectClaim(claimId) {
  const c = state.paymentClaims.find((x) => x.id === claimId);
  c.status = 'rejected';
  const m = findMemberById(c.memberId);
  logActivity(`Konfirmasi ditolak: ${m?.name}`, 'Admin');
  saveState();
  renderClaims();
}

function addAnnouncement() {
  const title = document.getElementById('ann-title').value.trim();
  const body = document.getElementById('ann-body').value.trim();
  if (!title || !body) return alert('Judul dan isi wajib');
  state.announcements.unshift({
    id: uid('ann-'),
    title,
    body,
    date: new Date().toISOString()
  });
  logActivity('Pengumuman baru: ' + title, 'Admin');
  document.getElementById('ann-title').value = '';
  document.getElementById('ann-body').value = '';
  saveState();
  renderAnnouncementsAdmin();
  toast('Pengumuman diterbitkan');
}

function deleteAnn(id) {
  if (!confirm('Hapus pengumuman?')) return;
  state.announcements = state.announcements.filter((a) => a.id !== id);
  saveState();
  renderAnnouncementsAdmin();
}

function applyConfig() {
  const newCount = parseInt(document.getElementById('conf-count').value) || 10;
  state.config.villaName = document.getElementById('conf-villa').value || 'Kas Villa';
  state.config.prefix = document.getElementById('conf-prefix').value || 'M';
  state.config.nominal = parseInt(document.getElementById('conf-nominal').value) || 0;
  state.members.forEach((m) => {
    if (m.weeks.length < newCount) while (m.weeks.length < newCount) m.weeks.push(false);
    else if (m.weeks.length > newCount) m.weeks = m.weeks.slice(0, newCount);
  });
  state.config.count = newCount;
  logActivity('Parameter iuran diperbarui', 'Admin');
  saveState();
  document.getElementById('villa-name').textContent = state.config.villaName;
  renderOverview();
  toast('Pengaturan disimpan');
}

function updateAdminCreds() {
  const u = document.getElementById('conf-admin-user').value.trim();
  const p = document.getElementById('conf-admin-pass').value;
  if (u) state.config.adminUser = u;
  if (p) state.config.adminPass = p;
  saveState();
  toast('Kredensial admin diperbarui');
}

function renderSyncSettings() {
  const el = document.getElementById('sync-settings-info');
  if (!el) return;
  if (Sync.isConfigured()) {
    el.innerHTML = `<div class="sync-info-card"><strong>Cloud aktif.</strong> Setiap simpan otomatis tersinkron ke HP/komputer lain yang membuka web yang sama.<br><span style="font-size:11px;opacity:0.8">ID villa: ${window.VILLA_SYNC_ID}</span></div>`;
  } else {
    el.innerHTML = `<div class="sync-info-card warn"><strong>Belum sinkron cloud.</strong> Data hanya di perangkat ini. Ikuti <code>SETUP-FIREBASE.md</code> (sekali, ±10 menit).</div>`;
  }
}

function refreshAll() {
  renderOverview();
  renderMembers();
  renderTransactions();
  renderClaims();
  renderSyncSettings();
}

function toggleSort() {
  isSorted = !isSorted;
  renderMembers();
}
function toggleFilterNunggak() {
  isFilterNunggak = !isFilterNunggak;
  const btn = document.getElementById('btn-filter-nunggak');
  btn.style.background = isFilterNunggak ? 'var(--orange)' : '';
  btn.style.color = isFilterNunggak ? '#fff' : '';
  renderMembers();
}

function sendWA(id) {
  const m = findMemberById(id);
  const s = getMemberStats(m);
  const phone = normalizePhone(m.phone);
  if (!phone || phone === '628') return alert('Nomor WA belum valid');
  const msg = `Halo ${m.name}, pengingat iuran ${state.config.villaName} (${formatRupiah(state.config.nominal)}/periode). Sisa tunggakan: ${formatRupiah(s.totalUnpaid)}. Terima kasih!`;
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
}

function broadcastWA() {
  const list = state.members
    .filter((m) => getMemberStats(m).unpaidCount > 0)
    .map((m) => {
      const s = getMemberStats(m);
      return `- ${m.name} (${formatRupiah(s.totalUnpaid)})`;
    });
  if (!list.length) return alert('Semua sudah lunas');
  const msg = `INFO TUNGGAKAN ${state.config.villaName.toUpperCase()}\n\n${list.join('\n')}\n\nMohon segera dicicil. Terima kasih!`;
  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
}

function exportExcelAll() {
  const iuranData = state.members.map((m) => {
    const row = { Nama: m.name, WA: m.phone, PIN: m.pin || '' };
    m.weeks.forEach((w, i) => {
      row[`${state.config.prefix}${i + 1}`] = w ? 'Lunas' : '-';
    });
    const s = getMemberStats(m);
    row['Tunggakan (Rp)'] = s.totalUnpaid;
    return row;
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(iuranData), 'Iuran');
  XLSX.writeFile(wb, 'Kas_Villa_' + new Date().toISOString().slice(0, 10) + '.xlsx');
}

function saveAdminWa() {
  state.config.adminWa = document.getElementById('conf-admin-wa').value.trim();
  saveState();
  toast('Nomor WA pengurus disimpan');
}

function fillConfigForm() {
  document.getElementById('conf-villa').value = state.config.villaName;
  document.getElementById('conf-admin-wa').value = state.config.adminWa || '';
  document.getElementById('conf-count').value = state.config.count;
  document.getElementById('conf-prefix').value = state.config.prefix;
  document.getElementById('conf-nominal').value = state.config.nominal;
}

initData().then(() => {
  showAppLoading(false);
  document.getElementById('villa-name').textContent = state.config.villaName || 'Kas Villa';
  fillConfigForm();
  refreshAll();
});

onStateUpdated(() => {
  document.getElementById('villa-name').textContent = state.config.villaName || 'Kas Villa';
  refreshAll();
});
