// Prescription Settings JavaScript
let currentTemplate = null;

// Load existing template on page load
document.addEventListener('DOMContentLoaded', async () => {
    await loadTemplate();
    setupEventListeners();
});

// Load template from server
async function loadTemplate() {
    try {
        const response = await fetch('/api/prescription-template');
        const data = await response.json();

        if (data) {
            currentTemplate = data;
            populateForm(data);
            updatePreview();
        }
    } catch (error) {
        console.error('Failed to load template:', error);
    }
}

// Populate form with template data
function populateForm(template) {
    document.getElementById('templateName').value = template.templateName || 'Default Template';
    document.getElementById('hospitalName').value = template.hospitalName || '';
    document.getElementById('hospitalAddress').value = template.hospitalAddress || '';
    document.getElementById('hospitalPhone').value = template.hospitalPhone || '';
    document.getElementById('hospitalEmail').value = template.hospitalEmail || '';
    document.getElementById('headerText').value = template.headerText || '';
    document.getElementById('footerText').value = template.footerText || '';
    document.getElementById('fontSize').value = template.fontSize || 12;
    document.getElementById('paperSize').value = template.paperSize || 'A4';
    document.getElementById('primaryColor').value = template.primaryColor || '#0EA5E9';
    document.getElementById('primaryColorText').value = template.primaryColor || '#0EA5E9';
    document.getElementById('secondaryColor').value = template.secondaryColor || '#666666';
    document.getElementById('secondaryColorText').value = template.secondaryColor || '#666666';
    document.getElementById('marginTop').value = template.marginTop || 50;
    document.getElementById('marginBottom').value = template.marginBottom || 50;
    document.getElementById('marginLeft').value = template.marginLeft || 50;
    document.getElementById('marginRight').value = template.marginRight || 50;
    document.getElementById('showLetterhead').checked = template.showLetterhead !== 0;
    document.getElementById('showWatermark').checked = template.showWatermark === 1;
    document.getElementById('watermarkText').value = template.watermarkText || '';

    // Show/hide watermark text field
    document.getElementById('showVitals').checked = template.showVitals !== 0;
    document.getElementById('showDiagnosis').checked = template.showDiagnosis !== 0;
    document.getElementById('showHistory').checked = template.showHistory !== 0;
    document.getElementById('layoutStyle').value = template.layoutStyle || 'classic';

    // Handle images
    if (template.hospitalLogo) {
        document.getElementById('hospitalLogoBase64').value = template.hospitalLogo;
        const preview = document.getElementById('logoPreview');
        preview.querySelector('img').src = template.hospitalLogo;
        preview.style.display = 'block';
    }

    if (template.doctorSignature) {
        document.getElementById('doctorSignatureBase64').value = template.doctorSignature;
        const preview = document.getElementById('signaturePreview');
        preview.querySelector('img').src = template.doctorSignature;
        preview.style.display = 'block';
    }

    // Show/hide watermark text field
    toggleWatermarkField();
}

// Setup event listeners
function setupEventListeners() {
    const form = document.getElementById('templateForm');
    form.addEventListener('submit', handleSubmit);

    // Live preview updates
    const inputs = form.querySelectorAll('input, textarea, select');
    inputs.forEach(input => {
        input.addEventListener('input', updatePreview);
    });

    // Color picker sync
    document.getElementById('primaryColor').addEventListener('input', (e) => {
        document.getElementById('primaryColorText').value = e.target.value;
        updatePreview();
    });

    document.getElementById('primaryColorText').addEventListener('input', (e) => {
        document.getElementById('primaryColor').value = e.target.value;
        updatePreview();
    });

    document.getElementById('secondaryColor').addEventListener('input', (e) => {
        document.getElementById('secondaryColorText').value = e.target.value;
        updatePreview();
    });

    document.getElementById('secondaryColorText').addEventListener('input', (e) => {
        document.getElementById('secondaryColor').value = e.target.value;
        updatePreview();
    });

    // Watermark toggle
    // Watermark toggle
    document.getElementById('showWatermark').addEventListener('change', toggleWatermarkField);

    // File inputs
    document.getElementById('hospitalLogo').addEventListener('change', (e) => handleFileSelect(e, 'hospitalLogoBase64', 'logoPreview'));
    document.getElementById('doctorSignature').addEventListener('change', (e) => handleFileSelect(e, 'doctorSignatureBase64', 'signaturePreview'));

    // Toggles & Layout
    ['showVitals', 'showDiagnosis', 'showHistory', 'layoutStyle'].forEach(id => {
        document.getElementById(id).addEventListener('change', updatePreview);
    });
}

function handleFileSelect(event, hiddenInputId, previewId) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            const base64 = e.target.result;
            document.getElementById(hiddenInputId).value = base64;
            const preview = document.getElementById(previewId);
            preview.querySelector('img').src = base64;
            preview.style.display = 'block';
            updatePreview();
        };
        reader.readAsDataURL(file);
    }
}

function clearLogo() {
    document.getElementById('hospitalLogo').value = '';
    document.getElementById('hospitalLogoBase64').value = '';
    document.getElementById('logoPreview').style.display = 'none';
    updatePreview();
}

function clearSignature() {
    document.getElementById('doctorSignature').value = '';
    document.getElementById('doctorSignatureBase64').value = '';
    document.getElementById('signaturePreview').style.display = 'none';
    updatePreview();
}

// Toggle watermark text field visibility
function toggleWatermarkField() {
    const showWatermark = document.getElementById('showWatermark').checked;
    const watermarkGroup = document.getElementById('watermarkTextGroup');
    watermarkGroup.style.display = showWatermark ? 'block' : 'none';
}

// Update live preview
function updatePreview() {
    const primaryColor = document.getElementById('primaryColor').value;
    const secondaryColor = document.getElementById('secondaryColor').value;
    const hospitalName = document.getElementById('hospitalName').value || 'Medical Center';
    const hospitalAddress = document.getElementById('hospitalAddress').value || 'Hospital Address';
    const hospitalPhone = document.getElementById('hospitalPhone').value || '+91 XXXXXXXXXX';
    const hospitalEmail = document.getElementById('hospitalEmail').value || 'email@hospital.com';
    const headerText = document.getElementById('headerText').value;
    const footerText = document.getElementById('footerText').value;
    const showLetterhead = document.getElementById('showLetterhead').checked;
    const fontSize = document.getElementById('fontSize').value;
    const showVitals = document.getElementById('showVitals').checked;
    const showDiagnosis = document.getElementById('showDiagnosis').checked;
    const showHistory = document.getElementById('showHistory').checked;
    const layoutStyle = document.getElementById('layoutStyle').value;
    const logoBase64 = document.getElementById('hospitalLogoBase64').value;
    const signatureBase64 = document.getElementById('doctorSignatureBase64').value;

    // Update CSS variables
    document.documentElement.style.setProperty('--primary-color', primaryColor);
    document.documentElement.style.setProperty('--secondary-color', secondaryColor);

    // Update preview content
    document.getElementById('previewHospitalName').textContent = hospitalName;
    document.getElementById('previewHospitalName').style.color = primaryColor;
    document.getElementById('previewAddress').textContent = hospitalAddress;
    document.getElementById('previewContact').textContent = `${hospitalPhone} | ${hospitalEmail}`;
    document.getElementById('previewHeaderText').textContent = headerText;
    document.getElementById('previewFooterText').textContent = footerText;

    // Update Logo
    const headerDiv = document.getElementById('previewHeader');
    // Remove existing logo if any
    const existingLogo = headerDiv.querySelector('.preview-logo');
    if (existingLogo) existingLogo.remove();

    if (logoBase64 && showLetterhead) {
        const img = document.createElement('img');
        img.src = logoBase64;
        img.className = 'preview-logo';
        img.style.height = '50px';
        img.style.float = 'left';
        img.style.marginRight = '15px';
        headerDiv.insertBefore(img, headerDiv.firstChild);
    }

    // Apply letterhead visibility
    const previewHeader = document.getElementById('previewHeader');
    previewHeader.style.display = showLetterhead ? 'block' : 'none';

    // Apply font size
    const previewDoc = document.getElementById('previewDoc');
    previewDoc.style.fontSize = fontSize + 'px';

    // Update section titles color
    document.querySelectorAll('.preview-section-title').forEach(el => {
        el.style.color = primaryColor;
    });

    // Update header border color
    if (previewHeader) {
        previewHeader.style.borderBottomColor = primaryColor;
        previewHeader.style.borderBottomColor = primaryColor;
    }

    // Toggle Sections
    // Note: In a real implementation, we'd toggle specific divs. 
    // For this preview, we'll just toggle visibility of sample content blocks if they existed with IDs.
    // Since the HTML is static in the preview, let's try to target them by content or add IDs in HTML first.
    // Assuming we can't easily change HTML structure right now, we'll skip hiding specific sample blocks 
    // in the preview unless we add IDs to them in the HTML file.
    // But we CAN show the signature.

    // Update Signature
    const sigDiv = document.getElementById('previewSignature');
    if (!sigDiv) {
        const d = document.createElement('div');
        d.id = 'previewSignature';
        d.style.textAlign = 'right';
        d.style.marginTop = '10px';
        document.querySelector('.preview-content').appendChild(d);
    }
    const signatureContainer = document.getElementById('previewSignature') || document.querySelector('.preview-content').lastElementChild;

    // Find the signature area (Doctor Name)
    const docNameDiv = Array.from(document.querySelectorAll('div')).find(el => el.textContent.trim() === 'Dr. John Doe');
    if (docNameDiv && docNameDiv.parentElement.style.textAlign === 'right') {
        const container = docNameDiv.parentElement;
        const existingSig = container.querySelector('img');
        if (existingSig) existingSig.remove();

        if (signatureBase64) {
            const img = document.createElement('img');
            img.src = signatureBase64;
            img.style.height = '40px';
            img.style.display = 'block';
            img.style.marginLeft = 'auto';
            container.insertBefore(img, container.children[0]); // Insert before line
        }
    }
}

// Handle form submission
async function handleSubmit(e) {
    e.preventDefault();

    const templateData = {
        templateName: document.getElementById('templateName').value,
        hospitalName: document.getElementById('hospitalName').value,
        hospitalAddress: document.getElementById('hospitalAddress').value,
        hospitalPhone: document.getElementById('hospitalPhone').value,
        hospitalEmail: document.getElementById('hospitalEmail').value,
        headerText: document.getElementById('headerText').value,
        footerText: document.getElementById('footerText').value,
        fontSize: parseInt(document.getElementById('fontSize').value),
        paperSize: document.getElementById('paperSize').value,
        primaryColor: document.getElementById('primaryColor').value,
        secondaryColor: document.getElementById('secondaryColor').value,
        marginTop: parseInt(document.getElementById('marginTop').value),
        marginBottom: parseInt(document.getElementById('marginBottom').value),
        marginLeft: parseInt(document.getElementById('marginLeft').value),
        marginRight: parseInt(document.getElementById('marginRight').value),
        showLetterhead: document.getElementById('showLetterhead').checked ? 1 : 0,
        showWatermark: document.getElementById('showWatermark').checked ? 1 : 0,
        watermarkText: document.getElementById('watermarkText').value,
        doctorNamePosition: 'top-left',
        showVitals: document.getElementById('showVitals').checked ? 1 : 0,
        showDiagnosis: document.getElementById('showDiagnosis').checked ? 1 : 0,
        showHistory: document.getElementById('showHistory').checked ? 1 : 0,
        layoutStyle: document.getElementById('layoutStyle').value,
        hospitalLogo: document.getElementById('hospitalLogoBase64').value,
        doctorSignature: document.getElementById('doctorSignatureBase64').value
    };

    try {
        const response = await fetch('/api/prescription-template', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(templateData)
        });

        const result = await response.json();

        if (result.success) {
            // Show success message
            const successMsg = document.getElementById('successMessage');
            successMsg.classList.add('show');
            setTimeout(() => {
                successMsg.classList.remove('show');
            }, 3000);

            // Reload template
            await loadTemplate();
        } else {
            alert('Failed to save template: ' + (result.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Failed to save template:', error);
        alert('Failed to save template. Please try again.');
    }
}
