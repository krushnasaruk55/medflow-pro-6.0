const API_BASE = ''; // Relative path for production consistency
const socket = io();
const hospitalId = sessionStorage.getItem('hospitalId');
const role = sessionStorage.getItem('role') || 'doctor';
socket.emit('join', { role, hospitalId });

// DOM Elements
const doctorSelect = document.getElementById('doctorSelect');
const queueList = document.getElementById('queue-list');
const consultationArea = document.getElementById('consultation-area');
const emptyConsultation = document.getElementById('empty-consultation');

// Patient Details Elements
const pName = document.getElementById('p-name');
const pDetails = document.getElementById('p-details');
const pToken = document.getElementById('p-token');
const pReason = document.getElementById('p-reason');
const pReports = document.getElementById('p-reports');
const diagnosisInput = document.getElementById('diagnosis');
const prescriptionInput = document.getElementById('prescription');

let currentDoctorId = localStorage.getItem('doctorId') || '';
let selectedPatient = null;
let allPatients = [];

// --- Initialization ---
function init() {
  loadDoctors();
  loadPatients();
  setupEventListeners();
}

function setupEventListeners() {
  doctorSelect.addEventListener('change', () => {
    currentDoctorId = doctorSelect.value;
    localStorage.setItem('doctorId', currentDoctorId);
    renderQueue();
  });

  document.getElementById('btn-download-pdf').addEventListener('click', downloadPrescriptionPDF);
  document.getElementById('btn-save').addEventListener('click', () => updatePatient('save'));
  document.getElementById('btn-pharmacy').addEventListener('click', () => updatePatient('pharmacy'));
  document.getElementById('btn-lab').addEventListener('click', () => sendToLab());
  document.getElementById('btn-complete').addEventListener('click', () => updatePatient('completed'));
}

async function downloadPrescriptionPDF() {
  if (!selectedPatient) {
    alert('Please select a patient first');
    return;
  }

  try {
    const btn = document.getElementById('btn-download-pdf');
    const originalText = btn.innerText;
    btn.innerText = '⏳ Downloading...';
    btn.disabled = true;

    const response = await fetch(`${API_BASE}/api/prescription-pdf/${selectedPatient.id}`, {
      credentials: 'include' // Important to send session cookies
    });

    if (response.status === 401) {
      alert('Session expired. Please log in again.');
      window.location.href = 'login.html';
      return;
    }

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to generate PDF');
    }

    // Create blob link to download
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prescription_${selectedPatient.name.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

  } catch (error) {
    console.error('Download error:', error);
    alert('Error downloading PDF: ' + error.message);
  } finally {
    const btn = document.getElementById('btn-download-pdf');
    btn.innerText = originalText;
    btn.disabled = false;
  }
}

function sendToLab() {
  if (!selectedPatient) {
    alert('Please select a patient first');
    return;
  }

  // Optional: Prompt for specific test name
  const testName = prompt("Enter test name (e.g. CBC, X-Ray) or leave empty for general request:", "General Lab Request");
  if (testName === null) return; // Cancelled

  socket.emit('create-lab-request', {
    patientId: selectedPatient._id || selectedPatient.id,
    testName: testName || "General Lab Request",
    doctorId: currentDoctorId
  });
}

// --- Data Loading ---
function loadDoctors() {
  fetch(`${API_BASE}/api/doctors`, { credentials: 'include' })
    .then(r => r.json())
    .then(list => {
      doctorSelect.innerHTML = '<option value="">Select Profile...</option>';
      list.forEach(d => {
        const o = document.createElement('option');
        o.value = d.id;
        o.textContent = `${d.name} (${d.dept})`;
        doctorSelect.appendChild(o);
      });
      if (currentDoctorId) doctorSelect.value = currentDoctorId;
    })
    .catch(err => console.error('Error loading doctors:', err));
}

function loadPatients() {
  fetch(`${API_BASE}/api/patients`, { credentials: 'include' })
    .then(r => r.json())
    .then(response => {
      // Handle both paginated and non-paginated response
      if (Array.isArray(response)) {
        allPatients = response;
      } else if (response.data) {
        allPatients = response.data;
      } else {
        allPatients = [];
      }
      renderQueue();
    })
    .catch(err => {
      console.error('Error loading patients:', err);
      queueList.innerHTML = '<div style="text-align: center; padding: 20px; color: red;">Failed to load patient queue.</div>';
    });
}

// --- Rendering ---
function renderQueue() {
  queueList.innerHTML = '';

  // Filter: Waiting or With Doctor, and assigned to current doctor (or unassigned if general view)
  // For simplicity, showing all assigned to this doctor OR unassigned in their dept
  const filtered = allPatients.filter(p => {
    const isActive = p.status === 'waiting' || p.status === 'with-doctor';
    if (!isActive) return false;
    if (!currentDoctorId) return true; // Show all if no doctor selected
    return p.doctorId == currentDoctorId || !p.doctorId;
  });

  if (filtered.length === 0) {
    queueList.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-muted);">No patients waiting.</div>';
    return;
  }

  filtered.forEach(p => {
    const div = document.createElement('div');
    div.className = 'card';
    div.style.marginBottom = '16px';
    div.style.cursor = 'pointer';
    div.style.borderLeft = p.status === 'with-doctor' ? '4px solid var(--primary)' : '4px solid var(--status-waiting)';

    if (selectedPatient && selectedPatient.id === p.id) {
      div.style.background = '#f0f9ff';
      div.style.borderColor = 'var(--primary)';
    }

    div.innerHTML = `
      <div class="flex justify-between">
        <strong>${p.name}</strong>
        <span class="badge ${p.status === 'with-doctor' ? 'with-doctor' : 'waiting'}">#${p.token}</span>
      </div>
      <div class="text-muted" style="font-size: 0.85rem;">${p.age} / ${p.gender}</div>
      <div style="font-size: 0.85rem; margin-top: 4px;">${p.reason || 'No reason provided'}</div>
    `;

    div.addEventListener('click', () => selectPatient(p));
    queueList.appendChild(div);
  });
}

function selectPatient(p) {
  selectedPatient = p;
  renderQueue(); // Re-render to highlight

  consultationArea.style.display = 'block';
  emptyConsultation.style.display = 'none';

  // Update UI
  pName.innerText = p.name;
  pDetails.innerText = `${p.age} yrs / ${p.gender} / ${p.phone}`;
  pToken.innerText = `Token #${p.token}`;
  pReason.innerText = p.reason || '-';

  diagnosisInput.value = ''; // Reset or load from history if exists
  prescriptionInput.value = p.prescription || '';

  // Render Reports
  pReports.innerHTML = '';
  let reports = [];
  try {
    reports = JSON.parse(p.reports || '[]');
  } catch (e) {
    console.error('Error parsing reports', e);
  }

  if (reports.length > 0) {
    reports.forEach(filename => {
      const link = document.createElement('a');
      link.href = `${API_BASE}/uploads/${filename}`;
      link.target = '_blank';
      link.className = 'btn btn-sm btn-secondary';
      link.style.textDecoration = 'none';
      link.innerHTML = `📄 ${filename.substring(0, 20)}...`;
      pReports.appendChild(link);
    });
  } else {
    pReports.innerHTML = '<span class="text-muted" style="font-size: 0.9rem;">No reports attached.</span>';
  }

  // If status is waiting, auto-move to with-doctor
  if (p.status === 'waiting' && currentDoctorId) {
    socket.emit('move-patient', { id: p.id, status: 'with-doctor', doctorId: currentDoctorId });
  }
}

function updatePatient(action) {
  if (!selectedPatient) return;

  const prescription = prescriptionInput.value;
  // In a real app, diagnosis would be saved too

  socket.emit('update-prescription', { id: selectedPatient._id || selectedPatient.id, prescription });

  if (action === 'pharmacy') {
    socket.emit('move-patient', { id: selectedPatient.id, status: 'pharmacy' });
    resetSelection();
  } else if (action === 'completed') {
    socket.emit('move-patient', { id: selectedPatient.id, status: 'completed' });
    resetSelection();
  } else {
    alert('Notes saved!');
  }
}

function resetSelection() {
  selectedPatient = null;
  consultationArea.style.display = 'none';
  emptyConsultation.style.display = 'flex';
  renderQueue();
}

// --- Socket Events ---
socket.on('patient-registered', (p) => {
  allPatients.unshift(p);
  renderQueue();
});

socket.on('queue-updated', ({ patient }) => {
  if (patient) {
    const idx = allPatients.findIndex(x => x.id === patient.id);
    if (idx >= 0) allPatients[idx] = patient;
    else allPatients.unshift(patient);

    // Update selected if it changed
    if (selectedPatient && selectedPatient.id === patient.id) {
      selectedPatient = patient;
      // Don't re-render full selection to avoid losing unsaved input, just queue list
    }
    renderQueue();
  } else {
    loadPatients();
  }
});

socket.on('prescription-updated', (p) => {
  const idx = allPatients.findIndex(x => x.id === p.id);
  if (idx >= 0) allPatients[idx] = p;
});

socket.on('lab-request-created', (res) => {
  if (res.success) {
    alert('Lab request sent successfully!');
  } else {
    alert('Failed to send lab request: ' + res.message);
  }
});

// Start
init();
