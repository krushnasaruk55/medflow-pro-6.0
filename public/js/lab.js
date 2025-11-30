const socket = io();
let currentSection = 'overview';

// Join Lab Room
socket.emit('join', 'lab');

// Socket Listeners
socket.on('lab-update', () => {
    loadSection(currentSection);
    showToast('New lab update received', 'info');
});

document.addEventListener('DOMContentLoaded', () => {
    showSection('overview');
});

function showSection(section) {
    currentSection = section;

    // Update Sidebar
    document.querySelectorAll('.lab-nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.textContent.toLowerCase().includes(section.replace('-', ' '))) {
            item.classList.add('active');
        }
    });

    loadSection(section);
}

async function loadSection(section) {
    const content = document.getElementById('main-content');
    content.innerHTML = '<div style="text-align:center; padding: 40px;">Loading...</div>';

    try {
        switch (section) {
            case 'overview':
                await renderOverview(content);
                break;
            case 'requests':
                await renderRequests(content);
                break;
            case 'collection':
                await renderCollection(content);
                break;
            case 'processing':
                await renderProcessing(content);
                break;
            case 'results':
                await renderResultsList(content);
                break;
            case 'reports':
                await renderReports(content);
                break;
            case 'inventory':
                await renderInventory(content);
                break;
            case 'settings':
                await renderSettings(content);
                break;
        }
    } catch (error) {
        console.error(error);
        content.innerHTML = `<div class="card" style="color: var(--danger);">Error loading section: ${error.message}</div>`;
    }
}

// --- Render Functions ---

async function renderOverview(container) {
    try {
        const res = await fetch('/api/lab/stats');
        const stats = await res.json();

        container.innerHTML = `
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value">${stats.pending || 0}</div>
                    <div class="stat-label">Pending Requests</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${stats.collection || 0}</div>
                    <div class="stat-label">Sample Collection</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${stats.processing || 0}</div>
                    <div class="stat-label">In Processing</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${stats.completed || 0}</div>
                    <div class="stat-label">Completed Today</div>
                </div>
            </div>
        `;
    } catch (e) {
        container.innerHTML = `<div class="card">Error loading stats</div>`;
    }
}

async function renderRequests(container) {
    const res = await fetch('/api/lab/tests?status=pending');
    const tests = await res.json();

    let html = `
        <div class="section-title">
            <h2>Test Requests</h2>
        </div>
        <div class="filter-bar">
            <input type="text" placeholder="Search patient..." class="form-control" onkeyup="filterTests(this.value)">
        </div>
    `;

    if (tests.length === 0) {
        html += `<div class="card" style="text-align: center; color: var(--text-muted);">No pending test requests.</div>`;
    } else {
        tests.forEach(test => {
            html += `
                <div class="test-card">
                    <div class="test-header">
                        <div>
                            <strong>${test.patientName}</strong> <span class="text-muted">(${test.patientAge}/${test.patientGender})</span>
                            <div class="text-sm text-muted">Dr. ${test.orderedBy} • ${new Date(test.createdAt).toLocaleDateString()}</div>
                        </div>
                        <div class="status-badge status-pending">Pending</div>
                    </div>
                    <div class="test-body">
                        <p><strong>Test:</strong> ${test.testName}</p>
                        ${test.notes ? `<p class="text-sm">Note: ${test.notes}</p>` : ''}
                    </div>
                    <div class="test-actions">
                        <button class="btn btn-primary" onclick="updateTestStatus('${test._id}', 'collection_pending')">Accept & Collect Sample</button>
                    </div>
                </div>
            `;
        });
    }
    container.innerHTML = html;
}

async function renderCollection(container) {
    const res = await fetch('/api/lab/tests?status=collection_pending');
    const tests = await res.json();

    let html = `
        <div class="section-title">
            <h2>Sample Collection</h2>
        </div>
    `;

    if (tests.length === 0) {
        html += `<div class="card" style="text-align: center; color: var(--text-muted);">No samples to collect.</div>`;
    } else {
        tests.forEach(test => {
            html += `
                <div class="test-card">
                    <div class="test-header">
                        <div>
                            <strong>${test.patientName}</strong>
                            <div class="text-sm text-muted">${test.testName}</div>
                        </div>
                        <button class="btn btn-outline" onclick="printLabel('${test._id}')">🖨️ Label</button>
                    </div>
                    <div class="test-actions" style="margin-top: 15px;">
                        <button class="btn btn-success" onclick="updateTestStatus('${test._id}', 'processing')">Sample Collected</button>
                        <button class="btn btn-danger" onclick="rejectSample('${test._id}')">Reject Sample</button>
                    </div>
                </div>
            `;
        });
    }
    container.innerHTML = html;
}

async function renderProcessing(container) {
    const res = await fetch('/api/lab/tests?status=processing');
    const tests = await res.json();

    let html = `
        <div class="section-title">
            <h2>In Processing</h2>
        </div>
    `;

    if (tests.length === 0) {
        html += `<div class="card" style="text-align: center; color: var(--text-muted);">No tests in processing.</div>`;
    } else {
        tests.forEach(test => {
            html += `
                <div class="test-card">
                    <div class="test-header">
                        <strong>${test.patientName}</strong>
                        <span class="status-badge status-processing">Processing</span>
                    </div>
                    <div class="test-body">
                        <p>${test.testName}</p>
                    </div>
                    <div class="test-actions">
                        <button class="btn btn-primary" onclick="enterResults('${test._id}')">Enter Results</button>
                    </div>
                </div>
            `;
        });
    }
    container.innerHTML = html;
}

async function renderResultsList(container) {
    // Reusing processing logic for now, or maybe a separate list of 'results_pending' if that state existed
    // But usually 'processing' leads to 'completed' after entering results.
    // Let's assume this is for reviewing results before final signoff, or just redirect to processing.
    await renderProcessing(container);
}

async function renderReports(container) {
    const res = await fetch('/api/lab/tests?status=completed');
    const tests = await res.json();

    let html = `
        <div class="section-title">
            <h2>Completed Reports</h2>
        </div>
    `;

    if (tests.length === 0) {
        html += `<div class="card" style="text-align: center; color: var(--text-muted);">No completed reports.</div>`;
    } else {
        tests.forEach(test => {
            html += `
                <div class="test-card">
                    <div class="test-header">
                        <strong>${test.patientName}</strong>
                        <span class="status-badge status-completed">Completed</span>
                    </div>
                    <div class="test-body">
                        <p>${test.testName}</p>
                        <div class="text-sm text-muted">Completed: ${new Date(test.updatedAt).toLocaleDateString()}</div>
                    </div>
                    <div class="test-actions">
                        <button class="btn btn-outline" onclick="viewReport('${test._id}')">View Report</button>
                        <button class="btn btn-primary" onclick="printReport('${test._id}')">Print</button>
                    </div>
                </div>
            `;
        });
    }
    container.innerHTML = html;
}

async function renderInventory(container) {
    const res = await fetch('/api/lab/inventory');
    const items = await res.json();

    let html = `
        <div class="section-title" style="display: flex; justify-content: space-between; align-items: center;">
            <h2>Inventory</h2>
            <button class="btn btn-primary" onclick="addInventoryItem()">+ Add Item</button>
        </div>
        <table class="table">
            <thead>
                <tr>
                    <th>Item Name</th>
                    <th>Quantity</th>
                    <th>Unit</th>
                    <th>Status</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
    `;

    if (items.length === 0) {
        html += `<tr><td colspan="5" style="text-align:center;">No inventory items.</td></tr>`;
    } else {
        items.forEach(item => {
            html += `
                <tr>
                    <td>${item.itemName}</td>
                    <td>${item.quantity}</td>
                    <td>${item.unit}</td>
                    <td>${item.quantity < item.minLevel ? '<span style="color: var(--danger)">Low Stock</span>' : '<span style="color: var(--success)">OK</span>'}</td>
                    <td>
                        <button class="btn-icon" onclick="updateStock('${item._id}', 1)">+</button>
                        <button class="btn-icon" onclick="updateStock('${item._id}', -1)">-</button>
                    </td>
                </tr>
            `;
        });
    }
    html += `</tbody></table>`;
    container.innerHTML = html;
}

async function renderSettings(container) {
    container.innerHTML = `
        <div class="card">
            <h3>Lab Settings</h3>
            <p>Configure lab test types, normal ranges, and units.</p>
            <button class="btn btn-outline">Manage Test Types</button>
        </div>
    `;
}

// --- Action Functions ---

async function updateTestStatus(testId, status) {
    try {
        await fetch(`/api/lab/tests/${testId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
        showToast('Status updated', 'success');
        loadSection(currentSection);
    } catch (e) {
        console.error(e);
        showToast('Error updating status', 'error');
    }
}

function rejectSample(testId) {
    const reason = prompt("Enter rejection reason:");
    if (reason) {
        fetch(`/api/lab/tests/${testId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'rejected', rejectionReason: reason })
        }).then(() => {
            showToast('Sample rejected', 'warning');
            loadSection(currentSection);
        });
    }
}

function printLabel(testId) {
    const win = window.open('', 'Print Label', 'width=400,height=200');
    win.document.write(`
        <div style="text-align: center; font-family: monospace; padding: 20px;">
            <h3>LAB SAMPLE</h3>
            <p>ID: ${testId}</p>
            <p>Date: ${new Date().toLocaleDateString()}</p>
        </div>
    `);
    win.print();
    // win.close(); // Keep open for debug
}

async function enterResults(testId) {
    // Simple prompt for now, ideally a modal
    const result = prompt("Enter Result Value:");
    if (result) {
        await fetch(`/api/lab/tests/${testId}/results`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                results: [{
                    parameterName: 'Result',
                    value: result,
                    unit: 'units',
                    referenceRange: 'N/A',
                    isAbnormal: false
                }]
            })
        });
        showToast('Results saved', 'success');
        loadSection(currentSection);
    }
}

async function viewReport(testId) {
    const res = await fetch(`/api/lab/tests/${testId}`);
    const test = await res.json();

    // Simple alert for now
    alert(JSON.stringify(test.results, null, 2));
}

async function addInventoryItem() {
    const name = prompt("Item Name:");
    const qty = prompt("Quantity:");
    const unit = prompt("Unit:");

    if (name && qty) {
        await fetch('/api/lab/inventory', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ itemName: name, quantity: qty, unit: unit || 'units', minLevel: 10 })
        });
        showToast('Item added', 'success');
        loadSection('inventory');
    }
}

async function updateStock(itemId, change) {
    // This endpoint might need to be created or adjusted
    // For now assuming we can update quantity
    // Implementation skipped for brevity, but UI is there
    showToast('Stock update not implemented yet', 'info');
}

function showToast(message, type = 'info') {
    const container = document.querySelector('.toast-container') || createToastContainer();
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function createToastContainer() {
    const container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
    return container;
}