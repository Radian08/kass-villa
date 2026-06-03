const session = requireAuth('customer');
if (!session) throw new Error('unauthorized');

let member = null;
let memberChart = null;
let navBound = false;

function getActivePanel() {
  const active = document.querySelector('.panel.active');
  return active ? active.id.replace('panel-', '') : 'home';
}

function updateMemberUI() {
  member = findMemberById(session.memberId);
  if (!member) {
    alert('Data anggota tidak ditemukan.');
    logout();
    return false;
  }
  document.getElementById('villa-name').textContent = state.config.villaName || 'Kas Villa';
  document.getElementById('welcome-name').textContent = member.name;
  document.getElementById('sidebar-name').textContent = member.name;
  document.getElementById('avatar-letter').textContent = member.name.charAt(0).toUpperCase();
  document.getElementById('prof-name').value = member.name;
  document.getElementById('prof-phone').value = member.phone || '';
  document.getElementById('prof-pin').value = ensureMemberPin(member);
  document.getElementById('info-nominal').textContent =
    formatRupiah(state.config.nominal) + ' / ' + state.config.prefix;
  document.getElementById('info-count').textContent = state.config.count + ' periode';
  return true;
}

function bindNav() {
  if (navBound) return;
  navBound = true;
  document.querySelectorAll('.nav-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      const panel = btn.dataset.panel;
      document.querySelectorAll('.nav-item').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.panel').forEach((p) => p.classList.remove('active'));
      document.getElementById('panel-' + panel).classList.add('active');
      document.getElementById('page-title').textContent = btn.textContent.trim();
      closeSidebar();
      refreshPanel(panel);
    });
  });
}

function refreshPanel(panel) {
  if (panel === 'home') renderHome();
  if (panel === 'iuran') renderIuran();
  if (panel === 'history') renderHistory();
  if (panel === 'announcements') renderAnnouncements();
}

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

function getMyTransactions() {
  return state.transactions.filter(
    (t) => t.desc && t.desc.toLowerCase().includes(member.name.toLowerCase())
  );
}

function getPendingClaim(weekIndex) {
  return state.paymentClaims.find(
    (c) => c.memberId === member.id && c.weekIndex === weekIndex && c.status === 'pending'
  );
}

function renderHome() {
  if (!member) return;
  const s = getMemberStats(member);
  document.getElementById('home-paid').textContent = s.payCount + ' periode';
  document.getElementById('home-debt').textContent = formatRupiah(s.totalUnpaid);
  document.getElementById('home-pct').textContent = s.pct + '%';
  document.getElementById('home-periods').textContent = `${s.payCount}/${state.config.count}`;
  document.getElementById('home-progress').style.width = s.pct + '%';
  document.getElementById('home-collected-label').textContent = 'Dibayar: ' + formatRupiah(s.totalPaid);
  document.getElementById('home-target-label').textContent =
    'Kewajiban: ' + formatRupiah(state.config.count * state.config.nominal);

  document.getElementById('welcome-sub').textContent = s.isLunas
    ? 'Terima kasih — iuran Anda sudah lunas!'
    : `Anda masih memiliki tunggakan ${formatRupiah(s.totalUnpaid)}`;

  const ctx = document.getElementById('chart-member');
  const data = {
    labels: ['Lunas', 'Belum'],
    datasets: [
      {
        data: [s.payCount, s.unpaidCount],
        backgroundColor: ['#4ECDC4', 'rgba(224,90,122,0.6)'],
        borderWidth: 0
      }
    ]
  };
  if (memberChart) {
    memberChart.data = data;
    memberChart.update();
  } else {
    memberChart = new Chart(ctx, {
      type: 'doughnut',
      data,
      options: {
        cutout: '65%',
        plugins: { legend: { position: 'bottom', labels: { color: '#E8E6F0', font: { size: 11 } } } },
        responsive: true,
        maintainAspectRatio: false
      }
    });
  }

  const preview = document.getElementById('home-ann-preview');
  const latest = state.announcements.slice(0, 2);
  if (!latest.length) {
    preview.innerHTML = '<p style="font-size:12px;color:var(--text-muted)">Belum ada pengumuman</p>';
  } else {
    preview.innerHTML = latest
      .map(
        (a) => `<div class="announcement" style="margin-bottom:8px">
        <strong style="font-size:0.9rem">${a.title}</strong>
        <p style="font-size:12px;margin-top:4px;color:var(--text-muted)">${a.body.slice(0, 80)}${a.body.length > 80 ? '…' : ''}</p>
      </div>`
      )
      .join('');
  }
}

function renderIuran() {
  if (!member) return;
  const grid = document.getElementById('week-grid');
  grid.innerHTML = member.weeks
    .map((paid, idx) => {
      const pending = getPendingClaim(idx);
      const cls = paid ? 'paid' : pending ? 'pending' : 'unpaid';
      const label = paid ? '✓ Lunas' : pending ? '⏳ Menunggu' : 'Belum';
      const click = !paid && !pending ? `onclick="submitClaim(${idx})"` : '';
      const cursor = !paid && !pending ? 'cursor:pointer' : '';
      return `<div class="week-cell ${cls}" ${click} style="${cursor}">
        <div style="font-size:10px;opacity:0.7">${state.config.prefix}${idx + 1}</div>
        <div>${label}</div>
        <div style="font-size:10px;margin-top:4px">${formatRupiah(state.config.nominal)}</div>
      </div>`;
    })
    .join('');

  const claimsEl = document.getElementById('my-claims');
  const mine = state.paymentClaims.filter((c) => c.memberId === member.id).slice(0, 10);
  if (!mine.length) {
    claimsEl.innerHTML = '<div class="empty">Belum ada laporan pembayaran</div>';
    return;
  }
  claimsEl.innerHTML = mine
    .map((c) => {
      const statusMap = {
        pending: ['Menunggu persetujuan', 'badge-warn'],
        approved: ['Disetujui', 'badge-success'],
        rejected: ['Ditolak', 'badge-danger']
      };
      const [text, badge] = statusMap[c.status] || ['-', 'badge-info'];
      return `<div class="tx-list-item">
        <div style="flex:1">
          <strong>${state.config.prefix}${c.weekIndex + 1}</strong>
          <div style="font-size:11px;color:var(--text-muted)">${formatDateTime(c.date)}</div>
        </div>
        <span class="badge ${badge}">${text}</span>
      </div>`;
    })
    .join('');
}

function renderHistory() {
  const txs = getMyTransactions();
  const el = document.getElementById('my-tx');
  if (!txs.length) {
    el.innerHTML = '<div class="empty">Belum ada riwayat transaksi atas nama Anda</div>';
    return;
  }
  el.innerHTML = txs
    .map((t) => {
      const inc = t.type === 'masuk';
      return `<div class="tx-list-item">
        <div class="tx-icon ${inc ? 'in' : 'out'}"><i class="ti ti-receipt"></i></div>
        <div style="flex:1">
          <div style="font-weight:700">${t.desc}</div>
          <div style="font-size:11px;color:var(--text-muted)">${formatDate(t.date)}</div>
        </div>
        <div style="font-weight:800;color:var(--${inc ? 'green' : 'red'})">${inc ? '+' : '-'} ${formatRupiah(t.amount)}</div>
      </div>`;
    })
    .join('');
}

function renderAnnouncements() {
  const el = document.getElementById('ann-list');
  if (!state.announcements.length) {
    el.innerHTML = '<div class="empty">Belum ada pengumuman dari pengurus</div>';
    return;
  }
  el.innerHTML = state.announcements
    .map(
      (a) => `<div class="announcement">
      <strong>${a.title}</strong>
      <p style="margin:8px 0;font-size:0.9rem;line-height:1.5">${a.body}</p>
      <span style="font-size:11px;color:var(--text-muted)">${formatDate(a.date)}</span>
    </div>`
    )
    .join('');
}

function submitClaim(weekIndex) {
  if (member.weeks[weekIndex]) return;
  if (getPendingClaim(weekIndex)) return toast('Sudah ada laporan menunggu');
  if (
    !confirm(
      `Laporkan pembayaran ${state.config.prefix}${weekIndex + 1} (${formatRupiah(state.config.nominal)})?`
    )
  )
    return;
  state.paymentClaims.unshift({
    id: uid('claim-'),
    memberId: member.id,
    weekIndex,
    status: 'pending',
    date: new Date().toISOString()
  });
  logActivity(`Lapor bayar ${state.config.prefix}${weekIndex + 1}: ${member.name}`, member.name);
  saveState();
  toast('Laporan dikirim — menunggu persetujuan admin');
  renderIuran();
}

function contactAdmin() {
  const s = getMemberStats(member);
  const msg = `Halo pengurus ${state.config.villaName}, saya ${member.name}. Ingin konfirmasi iuran. Status: ${s.payCount}/${state.config.count} periode. Tunggakan: ${formatRupiah(s.totalUnpaid)}.`;
  const phone = normalizePhone(state.config.adminWa || '');
  const url = phone
    ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
    : `https://wa.me/?text=${encodeURIComponent(msg)}`;
  window.open(url, '_blank');
}

initData().then(() => {
  showAppLoading(false);
  if (!updateMemberUI()) return;
  bindNav();
  renderHome();
  renderIuran();
});

onStateUpdated(() => {
  if (!updateMemberUI()) return;
  refreshPanel(getActivePanel());
});
