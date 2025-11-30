# 📱 Patient Portal QR Code Feature

## Overview
Patients can now scan a QR code on their printed prescription to access a secure, mobile-friendly digital copy of their prescription online.

## How It Works

### 1. **Automatic Token Generation**
- When a doctor generates a PDF prescription, the system automatically creates a unique, secure token for that patient
- This token is stored in the database (`publicToken` column in `patients` table)
- The token is a 64-character hexadecimal string (cryptographically secure)

### 2. **QR Code on PDF**
- Every prescription PDF now includes a QR code in the bottom right corner
- The QR code contains a link to: `http://localhost:3000/patient-view.html?token=<unique_token>`
- Below the QR code is the text "Scan for digital copy"

### 3. **Patient Portal Page**
- When scanned, the QR code opens a beautiful, mobile-optimized page
- The page displays:
  - Hospital name and address
  - Patient information (name, age, gender)
  - Visit date
  - Diagnosis
  - Complete list of prescribed medications
  - Doctor's name

### 4. **Security**
- No login required - access is via the unique token only
- Each token is patient-specific and cannot be guessed
- The token never expires (but you can add expiry logic if needed)

## Files Created/Modified

### New Files:
1. **`public/patient-view.html`** - The patient portal page (mobile-responsive)

### Modified Files:
1. **`server.js`**
   - Added `qrcode` and `crypto` imports
   - Added `generatePublicToken()` helper function
   - Added `/api/public/prescription/:token` endpoint
   - Updated PDF generation to create tokens and embed QR codes

2. **`database.js`**
   - Added `publicToken TEXT` column to patients table

3. **`package.json`**
   - Added `qrcode` dependency

## Testing the Feature

### Step 1: Generate a Prescription PDF
1. Log in as a doctor
2. Select a patient
3. Add diagnosis and prescription
4. Click "📄 Download PDF"

### Step 2: Check the PDF
- Open the downloaded PDF
- Look for the QR code in the bottom right corner
- You should see "Scan for digital copy" below it

### Step 3: Access the Patient Portal
**Option A: Scan with phone**
- Use your phone's camera to scan the QR code
- It will open the patient portal page

**Option B: Manual testing**
- Right-click the QR code and "Copy link" (if your PDF viewer supports it)
- Or manually go to: `http://localhost:3000/patient-view.html?token=<token>`
- You can find the token in the database

### Step 4: View the Digital Prescription
- The page should load with all patient and prescription details
- It's mobile-responsive and looks great on phones

## Future Enhancements

### Possible Additions:
1. **SMS Integration**: Send the portal link via SMS to the patient's phone
2. **Token Expiry**: Add expiration dates for security
3. **Download Option**: Let patients download the PDF from the portal
4. **Appointment Reminders**: Show upcoming appointments
5. **Medication Reminders**: Add dosage schedules and reminders
6. **Multi-language Support**: Translate the portal to regional languages
7. **Print-friendly Version**: Add a print button for the digital copy

## Production Deployment Notes

⚠️ **Important**: Before deploying to production:

1. **Update the Portal URL**:
   - In `server.js` line ~838, change:
   ```javascript
   const portalUrl = `http://localhost:3000/patient-view.html?token=${patient.publicToken}`;
   ```
   - To your actual domain:
   ```javascript
   const portalUrl = `https://yourhospital.com/patient-view.html?token=${patient.publicToken}`;
   ```

2. **HTTPS Required**: The patient portal should be served over HTTPS in production

3. **Database Backup**: The `publicToken` column will be auto-created on server restart

## Benefits

✅ **For Patients:**
- Easy access to prescriptions anytime, anywhere
- No need to remember login credentials
- Can share with family members if needed
- Reduces risk of losing paper prescriptions

✅ **For Hospitals:**
- Modern, tech-forward image
- Reduced patient calls asking for prescription details
- Better patient satisfaction
- Eco-friendly (less need for reprints)

---

**Congratulations!** 🎉 You now have a fully functional QR code patient portal system!
