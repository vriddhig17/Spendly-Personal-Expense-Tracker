
import { initializeApp }                                               from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, createUserWithEmailAndPassword,
         signInWithEmailAndPassword, onAuthStateChanged, signOut }    from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, collection, addDoc, deleteDoc,
         doc, query, where, onSnapshot, orderBy,
         serverTimestamp }                                             from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyC0bSu2rXaiL91APvcVPb8kPk-XpPuEAkw",
  authDomain: "spendly-expense-tracker-14101.firebaseapp.com",
  projectId: "spendly-expense-tracker-14101",
  storageBucket: "spendly-expense-tracker-14101.firebasestorage.app",
  messagingSenderId: "360282644175",
  appId: "1:360282644175:web:dd0df1e77ae82945e3e1ba"
};


const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);


let user       = null;        
let entries    = [];         
let stopListen = null;        
let curDate    = new Date();  
let entryType  = 'expense';   
let payType    = 'Online';    
let isSignUp   = false;       

let barChartObj   = null;
let donutChartObj = null;


const CATS = {
  '🍜 Food':          '#f59e0b',
  '🚌 Transport':     '#3b82f6',
  '🛍 Shopping':      '#ec4899',
  '💊 Health':        '#10b981',
  '⚡ Bills':         '#ef4444',
  '🎬 Entertainment': '#8b5cf6',
  '📚 Education':     '#06b6d4',
  '💼 Salary':        '#22c55e',
  '💡 Freelance':     '#84cc16',
  '📦 Other':         '#6b7280',
};


const rupee = n => '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}
const mkKey = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;

const mkName = d => d.toLocaleString('en-IN', { month: 'long', year: 'numeric' });

const safe = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

const setToday = () => {
  document.getElementById('f-date').value = new Date().toISOString().split('T')[0];
};

window.switchAuth = () => {
  isSignUp = !isSignUp;
  document.getElementById('auth-title').textContent = isSignUp ? 'Create Account' : 'Sign In';
  document.getElementById('auth-btn').textContent   = isSignUp ? 'Sign Up'        : 'Sign In';
  document.getElementById('sw-label').textContent   = isSignUp ? 'Have account?'  : 'No account?';
  document.getElementById('sw-link').textContent    = isSignUp ? 'Sign In'         : 'Sign Up';
  document.getElementById('auth-err').style.display = 'none';
};
document.getElementById('sw-link').onclick = window.switchAuth;

document.getElementById('auth-btn').onclick = async () => {
  const email = document.getElementById('auth-email').value.trim();
  const pass  = document.getElementById('auth-pass').value;
  const errEl = document.getElementById('auth-err');
  errEl.style.display = 'none';

  if (!email || !pass) {
    errEl.textContent = 'Please fill both fields.';
    errEl.style.display = 'block';
    return;
  }
  try {
    isSignUp
      ? await createUserWithEmailAndPassword(auth, email, pass)
      : await signInWithEmailAndPassword(auth, email, pass);
  } catch(e) {
    errEl.textContent = e.message.replace('Firebase: ','').replace(/\(auth.*\)/,'').trim();
    errEl.style.display = 'block';
  }
};

['auth-email','auth-pass'].forEach(id =>
  document.getElementById(id).addEventListener('keydown', e =>
    e.key === 'Enter' && document.getElementById('auth-btn').click()
  )
);

window.doLogout = () => signOut(auth);

onAuthStateChanged(auth, u => {
  document.getElementById('loading').style.display = 'none';

  if (u) {
    user = u;
    document.getElementById('auth-page').style.display = 'none';
    document.getElementById('app').style.display       = 'grid';
    document.getElementById('user-tag').textContent    = u.email;
    document.getElementById('user-tag2').textContent   = u.email;
    setToday();
    updateMonthLabel();
    loadEntries();
  } else {
    user = null;
    if (stopListen) stopListen();
    document.getElementById('app').style.display       = 'none';
    document.getElementById('auth-page').style.display = 'block';
  }
});


window.changeMonth = dir => {
  curDate = new Date(curDate.getFullYear(), curDate.getMonth() + dir, 1);
  updateMonthLabel();
  loadEntries();
};

function updateMonthLabel() {
  const name = mkName(curDate);
  document.getElementById('month-label').textContent   = name;
  document.getElementById('month-label-3').textContent = name;
}

function loadEntries() {
  if (!user) return;
  if (stopListen) stopListen();

  const q = query(
    collection(db, 'entries'),
    where('uid',      '==', user.uid),
    where('monthKey', '==', mkKey(curDate)),
    orderBy('date', 'desc')
  );

  stopListen = onSnapshot(q, snap => {
    entries = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderAll(); 
  });
}


window.setType = type => {
  entryType = type;
  document.getElementById('type-expense').classList.toggle('active', type === 'expense');
  document.getElementById('type-income').classList.toggle('active',  type === 'income');
  document.getElementById('pay-section').style.display = type === 'expense' ? 'block' : 'none';
};

window.setPayType = type => {
  payType = type;
  document.getElementById('pay-online').classList.toggle('active', type === 'Online');
  document.getElementById('pay-cash').classList.toggle('active',   type === 'Cash');
};

window.addEntry = async () => {
  const desc   = document.getElementById('f-desc').value.trim();
  const amount = parseFloat(document.getElementById('f-amount').value);
  const date   = document.getElementById('f-date').value;
  const cat    = document.getElementById('f-cat').value;

  if (!desc || !amount || amount <= 0 || !date || !cat) {
    toast('⚠ Please fill all fields!');
    return;
  }

  try {
    await addDoc(collection(db, 'entries'), {
      uid:       user.uid,
      desc,
      amount,
      date,
      cat,
      type:      entryType,                 
      payType:   entryType === 'expense' ? payType : 'N/A', 
      monthKey:  date.substring(0, 7),       
      createdAt: serverTimestamp()
    });

  
    document.getElementById('f-desc').value   = '';
    document.getElementById('f-amount').value = '';
    document.getElementById('f-cat').value    = '';
    toast('✓ Entry saved!');
    goto('dash'); 
  } catch(e) {
    toast('Error: ' + e.message);
  }
};


window.delEntry = async id => {
  try {
    await deleteDoc(doc(db, 'entries', id));
    toast('Deleted.');
  } catch(e) {
    toast('Delete failed.');
  }
};


window.goto = page => {
  ['dash','add','table'].forEach(p => {
    document.getElementById(`page-${p}`).style.display = 'none';
    document.getElementById(`nav-${p}`).classList.remove('active');
  });
  document.getElementById(`page-${page}`).style.display = 'block';
  document.getElementById(`nav-${page}`).classList.add('active');

  if (page === 'table') renderFullTable();
};


function renderAll() {
  renderStats();
  renderDashTables();
  renderBarChart();
  renderDonutChart();
}

function renderStats() {
  const income  = entries.filter(e => e.type === 'income').reduce((s,e)  => s + e.amount, 0);
  const expense = entries.filter(e => e.type === 'expense').reduce((s,e) => s + e.amount, 0);
  const net     = income - expense;

  document.getElementById('s-count').textContent   = entries.length;
  document.getElementById('s-income').textContent  = rupee(income);
  document.getElementById('s-expense').textContent = rupee(expense);
  document.getElementById('s-net').textContent     = rupee(net);
  document.getElementById('s-net').className       = 'stat-val ' + (net >= 0 ? 'green' : 'red');
}

function renderDashTables() {
  const incomes   = entries.filter(e => e.type === 'income');
  const expenses  = entries.filter(e => e.type === 'expense');

  document.getElementById('income-tbody').innerHTML = incomes.length
    ? incomes.map(e => `
        <tr>
          <td>${safe(e.desc)}</td>
          <td style="font-family:'JetBrains Mono',monospace;font-size:0.75rem">${fmtDate(e.date)}</td>
          <td style="color:var(--green);font-family:'JetBrains Mono',monospace">${rupee(e.amount)}</td>
          <td>${e.cat}</td>
          <td><button class="del-btn" onclick="delEntry('${e.id}')">✕</button></td>
        </tr>`).join('')
    : '<tr><td colspan="5" class="empty">No income yet</td></tr>';

  document.getElementById('expense-tbody').innerHTML = expenses.length
    ? expenses.map(e => {
        const b = e.payType === 'Online' ? 'online' : 'cash';
        return `
        <tr>
          <td>${safe(e.desc)}</td>
          <td style="font-family:'JetBrains Mono',monospace;font-size:0.75rem">${fmtDate(e.date)}</td>
          <td style="color:var(--red);font-family:'JetBrains Mono',monospace">−${rupee(e.amount)}</td>
          <td>${e.cat}</td>
          <td><span class="badge ${b}">${e.payType}</span></td>
          <td><button class="del-btn" onclick="delEntry('${e.id}')">✕</button></td>
        </tr>`;}).join('')
    : '<tr><td colspan="6" class="empty">No expenses yet</td></tr>';
}

window.renderFullTable = () => {
  const typeF = document.getElementById('tf-type').value;
  const payF  = document.getElementById('tf-pay').value;

  let filtered = entries;
  if (typeF) filtered = filtered.filter(e => e.type    === typeF);
  if (payF)  filtered = filtered.filter(e => e.payType === payF);

  const tbody = document.getElementById('full-tbody');
  const tfoot = document.getElementById('full-tfoot');

  tbody.innerHTML = filtered.length
    ? filtered.map((e, i) => {
        const pb = e.payType === 'Online' ? 'online' : e.payType === 'Cash' ? 'cash' : '';
        const tb = e.type === 'income'    ? 'income' : 'expense';
        const amtColor = e.type === 'income' ? 'var(--green)' : 'var(--red)';
        const sign     = e.type === 'income' ? '+' : '−';
        return `<tr>
          <td style="color:var(--muted);font-size:0.72rem">${i+1}</td>
          <td style="font-family:'JetBrains Mono',monospace;font-size:0.73rem">${fmtDate(e.date)}</td>
          <td>${safe(e.desc)}</td>
          <td>${e.cat}</td>
          <td><span class="badge ${tb}">${e.type}</span></td>
          <td>${pb ? `<span class="badge ${pb}">${e.payType}</span>` : '—'}</td>
          <td style="font-family:'JetBrains Mono',monospace;color:${amtColor};font-weight:600">${sign}${rupee(e.amount)}</td>
          <td><button class="del-btn" onclick="delEntry('${e.id}')">✕</button></td>
        </tr>`;}).join('')
    : '<tr><td colspan="8" class="empty">No records found.</td></tr>';

  const total   = filtered.reduce((s,e) => s + e.amount, 0);
  const income  = filtered.filter(e => e.type === 'income').reduce((s,e)  => s + e.amount, 0);
  const expense = filtered.filter(e => e.type === 'expense').reduce((s,e) => s + e.amount, 0);
  tfoot.innerHTML = `<tr>
    <td colspan="3">${filtered.length} entries</td>
    <td colspan="2">Income: <span style="color:var(--green)">${rupee(income)}</span></td>
    <td>Expense: <span style="color:var(--red)">${rupee(expense)}</span></td>
    <td style="color:var(--green)">${rupee(total)}</td>
    <td></td>
  </tr>`;

  document.getElementById('table-summary').innerHTML = `
    <div class="sum-item">Total: <span class="green">${rupee(income - expense)}</span></div>
    <div class="sum-item">💳 Online: <span class="blue">${rupee(filtered.filter(e=>e.payType==='Online').reduce((s,e)=>s+e.amount,0))}</span></div>
    <div class="sum-item">💵 Cash: <span class="amber">${rupee(filtered.filter(e=>e.payType==='Cash').reduce((s,e)=>s+e.amount,0))}</span></div>
  `;
};

function renderBarChart() {
  const ctx = document.getElementById('bar-chart').getContext('2d');


  const dayTotals = {};
  entries.forEach(e => {
    const day = e.date.split('-')[2];
    if (!dayTotals[day]) dayTotals[day] = { income: 0, expense: 0 };
    dayTotals[day][e.type] += e.amount;
  });

  const labels  = Object.keys(dayTotals).sort();
  const incData = labels.map(d => dayTotals[d].income);
  const expData = labels.map(d => dayTotals[d].expense);

  if (barChartObj) barChartObj.destroy();

  barChartObj = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Income',  data: incData, backgroundColor: '#22c55e88', borderColor: '#22c55e', borderWidth: 1 },
        { label: 'Expense', data: expData, backgroundColor: '#ef444488', borderColor: '#ef4444', borderWidth: 1 },
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { labels: { color: '#9ca3af', font: { size: 11 } } }
      },
      scales: {
        x: { ticks: { color: '#6b7280' }, grid: { color: '#1e2130' } },
        y: { ticks: { color: '#6b7280', callback: v => '₹' + v }, grid: { color: '#1e2130' } }
      }
    }
  });
}

function renderDonutChart() {
  const ctx = document.getElementById('donut-chart').getContext('2d');

  const catTotals = {};
  entries.filter(e => e.type === 'expense').forEach(e => {
    catTotals[e.cat] = (catTotals[e.cat] || 0) + e.amount;
  });

  const labels = Object.keys(catTotals);
  const data   = labels.map(c => catTotals[c]);
  const colors = labels.map(c => CATS[c] || '#6b7280');

  if (donutChartObj) donutChartObj.destroy();

  document.getElementById('legend').innerHTML = labels.map((l, i) => `
    <div class="legend-item">
      <div class="legend-dot" style="background:${colors[i]}"></div>
      <span>${l.replace(/^\S+\s/,'')} — ${rupee(data[i])}</span>
    </div>`).join('') || '<div class="legend-item" style="color:var(--muted)">No data</div>';

  donutChartObj = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data, backgroundColor: colors, borderWidth: 0 }]
    },
    options: {
      cutout: '65%',
      plugins: {
        legend: { display: false }, 
        tooltip: {
          callbacks: {
            label: ctx => ` ₹${ctx.parsed.toLocaleString('en-IN')}`
          }
        }
      }
    }
  });
}

function fmtDate(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric'
  });
}