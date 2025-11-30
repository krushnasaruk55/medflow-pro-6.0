require('dotenv').config();
const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const ExcelJS = require('exceljs');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const {
  connectDB, Hospital, User, Patient, Vital, LabTest,
  LabResult, Inventory, Appointment, LabInventory,
  LabTestType, PrescriptionTemplate
} = require('./database');
const auth = require('./auth');
const QRCode = require('qrcode');
const crypto = require('crypto');
const os = require('os');
const { registerValidators, loginValidators, templateValidators } = require('./middleware/validators');

// Connect to MongoDB
connectDB();

function getLocalExternalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Trust proxy - required for Render and other reverse proxies
app.set('trust proxy', 1);

// Enforce HTTPS in production
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') {
      res.redirect(`https://${req.header('host')}${req.url}`);
    } else {
      next();
    }
  });
}

// Security Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disabled for simplicity with inline scripts/styles in this project
}));
app.use(compression());

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Session middleware with persistent MongoDB storage
app.use(session({
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    collectionName: 'sessions',
    ttl: 24 * 60 * 60 // 1 day
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // Secure cookies in production (HTTPS)
    sameSite: process.env.NODE_ENV === 'production' ? 'lax' : 'lax' // CSRF protection
  }
}));

// Sample departments and doctors (Static for now)
const departments = [
  'General', 'Orthopedics', 'Gynecology', 'Pediatrics', 'ENT', 'Dermatology', 'Cardiology', 'Medicine'
];

const doctors = [
  { id: '1', name: 'Dr. Asha Patel', dept: 'General', status: 'available' },
  { id: '2', name: 'Dr. Rajesh Singh', dept: 'Orthopedics', status: 'available' },
  { id: '3', name: 'Dr. Nisha Rao', dept: 'Gynecology', status: 'available' },
  { id: '4', name: 'Dr. Vikram Shah', dept: 'Cardiology', status: 'available' }
];

// Helper to generate secure public token
function generatePublicToken() {
  return crypto.randomBytes(32).toString('hex');
}

// --- Public Patient Portal API ---
app.get('/api/public/prescription/:token', async (req, res) => {
  const token = req.params.token;

  try {
    const patient = await Patient.findOne({ publicToken: token });
    if (!patient) return res.status(404).json({ error: 'Invalid token' });

    // Fetch hospital details
    const hospital = await Hospital.findById(patient.hospitalId);

    // Fetch doctor details (if assigned)
    const doctor = doctors.find(d => d.id === patient.doctorId);

    res.json({
      patient: {
        name: patient.name,
        age: patient.age,
        gender: patient.gender,
        diagnosis: patient.diagnosis,
        prescription: patient.prescription,
        updatedAt: patient.appointmentDate || patient.registeredAt
      },
      hospital: hospital || { name: 'Medical Center' },
      doctor: doctor || { name: 'Attending Physician' }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Authentication & Hospital Management APIs ---

// Hospital Registration
app.post('/api/hospitals/register', registerValidators, async (req, res) => {
  const { hospital, admin } = req.body;

  if (!hospital || !hospital.name || !hospital.email || !admin || !admin.username || !admin.password) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  try {
    // Check if email already exists
    const existing = await Hospital.findOne({ email: hospital.email });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Hospital email already registered' });
    }

    // Insert hospital
    const subscriptionExpiry = new Date();
    subscriptionExpiry.setDate(subscriptionExpiry.getDate() + 30); // 30-day trial

    const newHospital = await Hospital.create({
      name: hospital.name,
      email: hospital.email,
      phone: hospital.phone || null,
      address: hospital.address || null,
      subscriptionStatus: 'active',
      subscriptionExpiry: subscriptionExpiry.toISOString(),
      createdAt: new Date()
    });

    const hospitalId = newHospital._id;

    // Generate monthly password for hospital
    // Note: generateHospitalPassword uses integer ID logic usually, but we can pass string ID
    // If auth.js expects number, we might need to adjust. Assuming it handles string or we just pass string.
    const monthlyPassword = auth.generateHospitalPassword(hospitalId.toString());

    // Hash admin password
    const hashedPassword = auth.hashPassword(admin.password);

    // Insert admin user
    await User.create({
      hospitalId: hospitalId,
      username: admin.username,
      email: admin.email || null,
      role: 'admin',
      password: hashedPassword,
      createdAt: new Date()
    });

    res.json({
      success: true,
      message: 'Hospital registered successfully',
      hospitalId: hospitalId,
      password: monthlyPassword
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to register: ' + err.message });
  }
});

// Login endpoint
app.post('/api/login', loginValidators, async (req, res) => {
  const { hospitalPassword, username, userPassword } = req.body;

  if (!hospitalPassword || !username || !userPassword) {
    return res.status(400).json({ success: false, message: 'Missing credentials' });
  }

  try {
    // First, find if any hospital has this password
    // Since password generation might depend on ID, and we can't easily reverse it without checking all,
    // we fetch all hospitals. (Inefficient for large scale, but fine for now)
    const hospitals = await Hospital.find({});

    // Check which hospital matches the password
    let matchedHospitalId = null;
    for (const hospital of hospitals) {
      if (auth.verifyHospitalPassword(hospital.id, hospitalPassword)) {
        if (hospital.subscriptionStatus !== 'active') {
          return res.status(403).json({ success: false, message: 'Subscription expired' });
        }
        matchedHospitalId = hospital._id;
        break;
      }
    }

    if (!matchedHospitalId) {
      return res.status(401).json({ success: false, message: 'Invalid hospital password' });
    }

    // Now verify user credentials for this hospital
    const user = await User.findOne({ hospitalId: matchedHospitalId, username: username });

    if (!user || !auth.comparePassword(userPassword, user.password)) {
      return res.status(401).json({ success: false, message: 'Invalid username or password' });
    }

    // Update last login
    await User.findByIdAndUpdate(user._id, { lastLogin: new Date() });
    await Hospital.findByIdAndUpdate(matchedHospitalId, { lastLogin: new Date() });

    // Set session
    req.session.userId = user._id;
    req.session.hospitalId = matchedHospitalId;
    req.session.username = user.username;
    req.session.role = user.role;

    res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        hospitalId: matchedHospitalId
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Database error: ' + err.message });
  }
});

// Auth status check
app.get('/api/auth/status', (req, res) => {
  if (req.session.userId) {
    res.json({
      authenticated: true,
      user: {
        id: req.session.userId,
        username: req.session.username,
        role: req.session.role,
        hospitalId: req.session.hospitalId
      }
    });
  } else {
    res.json({ authenticated: false });
  }
});

// Logout
app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// Get current user's hospital info
app.get('/api/hospital/info', async (req, res) => {
  if (!req.session.hospitalId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const hospital = await Hospital.findById(req.session.hospitalId);
    res.json(hospital);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Superadmin APIs ---

// Middleware for superadmin
const requireAdmin = (req, res, next) => {
  if (req.session.role === 'superadmin') {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
};

// Superadmin Login
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (auth.verifySuperAdminPassword(password)) {
    req.session.role = 'superadmin';
    req.session.username = 'Super Admin';
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, message: 'Invalid password' });
  }
});

// List all hospitals
app.get('/api/admin/hospitals', requireAdmin, async (req, res) => {
  try {
    const hospitals = await Hospital.find({}).sort({ createdAt: -1 });
    res.json(hospitals);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List all users
app.get('/api/admin/users', requireAdmin, async (req, res) => {
  try {
    const users = await User.find({}).sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get hospital password
app.get('/api/admin/hospital-password/:id', requireAdmin, (req, res) => {
  const hospitalId = req.params.id; // String ID
  const password = auth.generateHospitalPassword(hospitalId);
  res.json({ password });
});

// Update hospital subscription status
app.put('/api/admin/hospitals/:id/status', requireAdmin, async (req, res) => {
  const hospitalId = req.params.id;
  const { status } = req.body;

  try {
    await Hospital.findByIdAndUpdate(hospitalId, { subscriptionStatus: status });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update hospital subscription expiry
app.put('/api/admin/hospitals/:id/expiry', requireAdmin, async (req, res) => {
  const hospitalId = req.params.id;
  const { expiryDate, daysToAdd } = req.body;

  try {
    let newExpiry;
    if (expiryDate) {
      newExpiry = new Date(expiryDate).toISOString();
      await Hospital.findByIdAndUpdate(hospitalId, {
        subscriptionExpiry: newExpiry,
        subscriptionStatus: 'active'
      });
      res.json({ success: true, expiryDate: newExpiry });
    } else if (daysToAdd) {
      const hospital = await Hospital.findById(hospitalId);
      const baseDate = hospital && hospital.subscriptionExpiry ? new Date(hospital.subscriptionExpiry) : new Date();
      baseDate.setDate(baseDate.getDate() + parseInt(daysToAdd));
      newExpiry = baseDate.toISOString();

      await Hospital.findByIdAndUpdate(hospitalId, {
        subscriptionExpiry: newExpiry,
        subscriptionStatus: 'active'
      });
      res.json({ success: true, expiryDate: newExpiry });
    } else {
      return res.status(400).json({ error: 'Either expiryDate or daysToAdd required' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Public endpoint to get list of hospitals (for login page)
app.get('/api/hospitals', async (req, res) => {
  try {
    const hospitals = await Hospital.find({}, 'name email').sort({ name: 1 });
    res.json(hospitals);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get patients with hospital filtering and pagination
app.get('/api/patients', async (req, res) => {
  const { phone, page = 1, limit = 50 } = req.query;
  const hospitalId = req.session.hospitalId;
  const skip = (page - 1) * limit;

  const query = {};
  if (hospitalId) query.hospitalId = hospitalId;
  if (phone) query.phone = phone;

  try {
    const total = await Patient.countDocuments(query);
    const patients = await Patient.find(query)
      .sort({ _id: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.json({
      data: patients,
      pagination: {
        total,
        page: parseInt(page),
        totalPages: Math.ceil(total / limit),
        limit: parseInt(limit)
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/patients/:id', async (req, res) => {
  const hospitalId = req.session.hospitalId;
  const query = { _id: req.params.id };
  if (hospitalId) query.hospitalId = hospitalId;

  try {
    const patient = await Patient.findOne(query);
    if (!patient) return res.status(404).json({ error: 'Not found' });
    res.json(patient);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/doctors', (req, res) => {
  const { dept } = req.query;
  if (dept) return res.json(doctors.filter(d => d.dept === dept));
  res.json(doctors);
});

app.get('/api/departments', (req, res) => {
  res.json(departments);
});

app.get('/api/prescriptions', async (req, res) => {
  const hospitalId = req.session.hospitalId;
  const query = {
    $or: [
      { prescription: { $ne: null, $ne: '' } },
      { status: 'pharmacy' },
      { pharmacyState: { $ne: null } }
    ]
  };
  if (hospitalId) query.hospitalId = hospitalId;

  try {
    const patients = await Patient.find(query).sort({ token: 1 });
    res.json(patients);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Excel Export Endpoint
app.get('/api/export', async (req, res) => {
  const { type } = req.query; // 'month' or 'year'
  const now = new Date();
  let startDate;

  if (type === 'year') {
    startDate = new Date(now.getFullYear(), 0, 1);
  } else {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  try {
    const patients = await Patient.find({ registeredAt: { $gte: startDate } }).sort({ registeredAt: -1 });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Patients');

    sheet.columns = [
      { header: 'Patient Name', key: 'name', width: 25 },
      { header: 'Visit Date', key: 'registeredAt', width: 20 },
      { header: 'Phone', key: 'phone', width: 15 },
      { header: 'Age', key: 'age', width: 10 },
      { header: 'Gender', key: 'gender', width: 10 },
      { header: 'Department', key: 'department', width: 15 },
      { header: 'Reason', key: 'reason', width: 20 },
      { header: 'Prescription', key: 'prescription', width: 30 },
      { header: 'Cost Paid', key: 'cost', width: 12 },
      { header: 'Status', key: 'status', width: 15 }
    ];

    const formattedRows = patients.map(row => ({
      ...row.toObject(),
      registeredAt: new Date(row.registeredAt).toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short'
      }),
      cost: row.cost || 0
    }));

    sheet.addRows(formattedRows);

    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0EA5E9' }
    };
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=patients_${type}_${Date.now()}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).send('Database error: ' + err.message);
  }
});

// --- Lab Dashboard APIs ---

// Get Lab Stats
app.get('/api/lab/stats', async (req, res) => {
  const hospitalId = req.session.hospitalId;
  if (!hospitalId) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const pending = await LabTest.countDocuments({ hospitalId, status: 'pending' });
    const inProgress = await LabTest.countDocuments({ hospitalId, status: 'in_progress' });
    const completed = await LabTest.countDocuments({ hospitalId, status: 'completed' });
    const urgent = await LabTest.countDocuments({ hospitalId, priority: 'urgent', status: { $ne: 'completed' } });
    const samplesToCollect = await LabTest.countDocuments({ hospitalId, sampleStatus: 'pending' });

    res.json({ pending, inProgress, completed, urgent, samplesToCollect });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Lab Tests with Filters
app.get('/api/lab/tests', async (req, res) => {
  const hospitalId = req.session.hospitalId;
  if (!hospitalId) return res.status(401).json({ error: 'Not authenticated' });

  const { status, date, search } = req.query;
  const query = { hospitalId };

  if (status && status !== 'all') {
    query.status = status;
  }

  if (date) {
    // Assuming date is YYYY-MM-DD
    // Need to handle string date matching or range
    // Since orderedAt is Date, we need range
    const start = new Date(date);
    const end = new Date(date);
    end.setDate(end.getDate() + 1);
    query.orderedAt = { $gte: start, $lt: end };
  }

  try {
    let tests = await LabTest.find(query)
      .populate('patientId', 'name age gender phone')
      .sort({ priority: -1, orderedAt: -1 }); // Urgent first

    // Manual search filter if needed (or use regex in query)
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      // Since we populated, we can filter in memory or use aggregate
      // For simplicity, filter in memory
      tests = tests.filter(t =>
        (t.patientId && (searchRegex.test(t.patientId.name) || searchRegex.test(t.patientId.phone)))
      );
    }

    // Flatten structure for frontend compatibility
    const formattedTests = tests.map(t => {
      const obj = t.toObject();
      if (obj.patientId) {
        obj.patientName = obj.patientId.name;
        obj.patientAge = obj.patientId.age;
        obj.patientGender = obj.patientId.gender;
        obj.patientPhone = obj.patientId.phone;
        delete obj.patientId;
      }
      return obj;
    });

    res.json(formattedTests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Assign Technician
app.post('/api/lab/tests/:id/assign', async (req, res) => {
  const { technicianId } = req.body;
  try {
    await LabTest.findByIdAndUpdate(req.params.id, { technicianId });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Sample Status
app.post('/api/lab/tests/:id/sample', async (req, res) => {
  const { status, rejectionReason } = req.body;
  const user = req.session.username || 'Unknown';
  const now = new Date();

  const update = {
    sampleStatus: status,
    sampleCollectedBy: user,
    sampleCollectedAt: now
  };

  if (status === 'rejected') {
    update.rejectionReason = rejectionReason;
  }

  try {
    await LabTest.findByIdAndUpdate(req.params.id, update);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Test Processing Status
app.post('/api/lab/tests/:id/process', async (req, res) => {
  const { status, machineId } = req.body;
  const now = new Date();
  const update = { status };

  if (status === 'in_progress') {
    update.startedAt = now;
    update.machineId = machineId;
  } else if (status === 'completed') {
    update.completedAt = now;
  }

  try {
    await LabTest.findByIdAndUpdate(req.params.id, update);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Save Lab Results
app.post('/api/lab/tests/:id/results', async (req, res) => {
  const testId = req.params.id;
  const { results } = req.body;

  if (!results || !Array.isArray(results)) {
    return res.status(400).json({ error: 'Invalid results data' });
  }

  try {
    // Clear old results
    await LabResult.deleteMany({ testId });

    // Insert new results
    const resultDocs = results.map(r => ({
      testId,
      parameterName: r.parameterName,
      value: r.value,
      unit: r.unit,
      referenceRange: r.referenceRange,
      isAbnormal: r.isAbnormal,
      notes: r.notes
    }));

    await LabResult.insertMany(resultDocs);

    // Mark test as completed
    await LabTest.findByIdAndUpdate(testId, {
      status: 'completed',
      resultDate: new Date()
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Test Details & Results
app.get('/api/lab/tests/:id', async (req, res) => {
  try {
    const test = await LabTest.findById(req.params.id).populate('patientId');
    if (!test) return res.status(404).json({ error: 'Test not found' });

    const results = await LabResult.find({ testId: test._id });

    const testObj = test.toObject();
    if (testObj.patientId) {
      testObj.patientName = testObj.patientId.name;
      testObj.patientAge = testObj.patientId.age;
      testObj.patientGender = testObj.patientId.gender;
      testObj.patientPhone = testObj.patientId.phone;
    }

    res.json({ ...testObj, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Inventory Management
app.get('/api/lab/inventory', async (req, res) => {
  const hospitalId = req.session.hospitalId;
  try {
    const items = await LabInventory.find({ hospitalId });
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/lab/inventory', async (req, res) => {
  const hospitalId = req.session.hospitalId;
  const { itemName, quantity, unit, minLevel } = req.body;

  try {
    const newItem = await LabInventory.create({
      hospitalId, itemName, quantity, unit, minLevel, addedAt: new Date()
    });
    res.json({ success: true, id: newItem._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Test Types (Templates)
app.get('/api/lab/settings/test-types', async (req, res) => {
  const hospitalId = req.session.hospitalId;
  try {
    const types = await LabTestType.find({ hospitalId });
    res.json(types);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/lab/settings/test-types', async (req, res) => {
  const hospitalId = req.session.hospitalId;
  const { name, category, parameters, price } = req.body;

  try {
    const newType = await LabTestType.create({
      hospitalId, name, category, parameters: JSON.stringify(parameters), price
    });
    res.json({ success: true, id: newType._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Prescription Template APIs ---

app.get('/api/prescription-template', async (req, res) => {
  const hospitalId = req.session.hospitalId;
  if (!hospitalId) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const template = await PrescriptionTemplate.findOne({ hospitalId });

    if (!template) {
      return res.json({
        hospitalId,
        templateName: 'Default Template',
        fontSize: 12,
        fontFamily: 'Helvetica',
        primaryColor: '#0EA5E9',
        secondaryColor: '#666666',
        paperSize: 'A4',
        showQRCode: true,
        showWatermark: false,
        showLetterhead: true,
        marginTop: 50,
        marginBottom: 50,
        marginLeft: 50,
        marginRight: 50,
        showVitals: true,
        showDiagnosis: true,
        showHistory: true,
        layoutStyle: 'classic',
        doctorSignature: ''
      });
    }
    res.json(template);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/prescription-template', templateValidators, async (req, res) => {
  const hospitalId = req.session.hospitalId;
  if (!hospitalId) return res.status(401).json({ error: 'Not authenticated' });

  const data = req.body;
  data.hospitalId = hospitalId;
  data.updatedAt = new Date();

  try {
    await PrescriptionTemplate.findOneAndUpdate(
      { hospitalId },
      data,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json({ success: true, message: 'Template updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Generate Prescription PDF
app.get('/api/prescription-pdf/:patientId', async (req, res) => {
  let hospitalId = req.session.hospitalId;
  const patientId = req.params.patientId;
  const token = req.query.token;

  try {
    let patient;
    if (token) {
      patient = await Patient.findOne({ _id: patientId, publicToken: token });
      if (patient) hospitalId = patient.hospitalId;
    } else {
      if (!hospitalId) return res.status(401).json({ error: 'Not authenticated' });
      patient = await Patient.findOne({ _id: patientId, hospitalId });
    }

    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    // Generate public token if missing
    if (!patient.publicToken) {
      patient.publicToken = generatePublicToken();
      await patient.save();
    }

    // Generate QR Code
    const baseUrl = process.env.BASE_URL || `http://${getLocalExternalIp()}:${process.env.PORT || 3000}`;
    const portalUrl = `${baseUrl}/api/public/prescription/${patient.publicToken}`;

    const qrCodeBuffer = await QRCode.toBuffer(portalUrl, {
      errorCorrectionLevel: 'M', type: 'png', width: 150, margin: 1
    });

    // Get template
    const template = await PrescriptionTemplate.findOne({ hospitalId }) || {};

    // Get hospital info
    const hospital = await Hospital.findById(hospitalId);

    // Get doctor info
    const doctorName = req.session.username || 'Dr. Unknown';

    const PDFDocument = require('pdfkit');
    const validSizes = ['A4', 'LETTER', 'A5', 'LEGAL'];
    let paperSize = (template.paperSize || 'A4').toUpperCase();
    if (!validSizes.includes(paperSize)) paperSize = 'A4';

    const doc = new PDFDocument({
      size: paperSize,
      margins: {
        top: Number(template.marginTop) || 50,
        bottom: Number(template.marginBottom) || 50,
        left: Number(template.marginLeft) || 50,
        right: Number(template.marginRight) || 50
      }
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=prescription_${patient.name.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.pdf`);

    doc.pipe(res);

    // ... (PDF Generation Logic - mostly same, just using template/hospital objects)
    // I'll reuse the logic but adapted for object access
    const primaryColor = template.primaryColor || '#0EA5E9';
    const secondaryColor = template.secondaryColor || '#666666';
    const fontSize = Number(template.fontSize) || 12;

    if (template.showWatermark && template.watermarkText) {
      doc.save();
      doc.fontSize(60).fillColor('#f0f0f0').opacity(0.1)
        .rotate(45, { origin: [300, 300] })
        .text(template.watermarkText, 100, 100, { align: 'center', width: 400 });
      doc.restore();
    }

    if (template.showLetterhead) {
      doc.fontSize(20).fillColor(primaryColor)
        .text(template.hospitalName || hospital.name || 'Medical Center', { align: 'center' });
      doc.fontSize(10).fillColor(secondaryColor)
        .text(template.hospitalAddress || hospital.address || '', { align: 'center' })
        .text((template.hospitalPhone || hospital.phone || '') + (template.hospitalEmail ? ' | ' + template.hospitalEmail : ''), { align: 'center' });
      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor(primaryColor).stroke();
      doc.moveDown(1.5);
    }

    doc.fontSize(fontSize).fillColor('#000000')
      .text(`Doctor: ${doctorName}`, { continued: true })
      .text(`Date: ${new Date().toLocaleDateString('en-IN')}`, { align: 'right' });
    doc.moveDown(1);

    doc.fontSize(fontSize + 2).fillColor(primaryColor).text('Patient Information', { underline: true });
    doc.fontSize(fontSize).fillColor('#000000').moveDown(0.5)
      .text(`Name: ${patient.name}`)
      .text(`Age: ${patient.age} years | Gender: ${patient.gender}`)
      .text(`Phone: ${patient.phone}`)
      .text(`Token No: ${patient.token}`)
      .text(`Department: ${patient.department}`);
    doc.moveDown(1.5);

    if (patient.reason) {
      doc.fontSize(fontSize + 2).fillColor(primaryColor).text('Chief Complaint', { underline: true });
      doc.fontSize(fontSize).fillColor('#000000').moveDown(0.5).text(patient.reason);
      doc.moveDown(1.5);
    }

    if (patient.diagnosis) {
      doc.fontSize(fontSize + 2).fillColor(primaryColor).text('Diagnosis', { underline: true });
      doc.fontSize(fontSize).fillColor('#000000').moveDown(0.5).text(patient.diagnosis);
      doc.moveDown(1.5);
    }

    doc.fontSize(fontSize + 4).fillColor(primaryColor).text('℞ Prescription', { underline: true });
    doc.fontSize(fontSize).fillColor('#000000').moveDown(0.5);

    if (patient.prescription) {
      const prescriptionLines = patient.prescription.split('\n');
      prescriptionLines.forEach(line => {
        if (line.trim()) doc.text(`• ${line.trim()}`);
      });
    } else {
      doc.text('No prescription provided');
    }
    doc.moveDown(2);

    if (template.headerText) {
      doc.fontSize(fontSize - 2).fillColor(secondaryColor).text(template.headerText, { align: 'center' });
    }

    const bottomY = doc.page.height - (Number(template.marginBottom) || 50) - 50;
    if (doc.y < bottomY) doc.y = bottomY;

    if (template.footerText) {
      doc.fontSize(fontSize - 2).fillColor(secondaryColor).text(template.footerText, { align: 'center' });
    }

    doc.moveDown(2);
    const qrHeight = 120;
    const spaceNeeded = qrHeight + 50;
    if (doc.y + spaceNeeded > doc.page.height - (Number(template.marginBottom) || 50)) {
      doc.addPage();
    }

    const qrX = doc.page.width - 170;
    const qrY = doc.y;
    doc.image(qrCodeBuffer, qrX, qrY, { width: 100 });
    doc.fontSize(8).fillColor(secondaryColor).text('Scan to download PDF', qrX, qrY + 105, { width: 100, align: 'center' });

    doc.fontSize(fontSize - 1).fillColor('#000000')
      .text('_____________________', 50, qrY, { align: 'left' })
      .text(doctorName, 50, qrY + 15, { align: 'left', width: 200 });

    doc.end();

  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

io.on('connection', (socket) => {
  socket.on('join', (role) => {
    if (role === 'doctor') socket.join('doctors');
    if (role === 'reception') socket.join('reception');
    if (role === 'pharmacy') socket.join('pharmacy');
    if (role === 'lab') socket.join('lab');
    socket.role = role;
    console.log(`Socket ${socket.id} joined as ${role}`);
  });

  socket.on('register-patient', async (data) => {
    const dept = data.department || 'General';
    const hospitalId = data.hospitalId || '000000000000000000000000'; // Fallback ID if needed, but should be provided

    if (!data.name || !data.name.trim()) {
      return socket.emit('patient-registration-error', { message: 'Patient name is required' });
    }

    try {
      // Calculate token
      const count = await Patient.countDocuments({ department: dept, hospitalId });
      const token = count + 1;

      let assignedDoctor = data.doctorId || null;
      if (!assignedDoctor) {
        const avail = doctors.find(d => d.dept === dept && d.status === 'available');
        if (avail) assignedDoctor = avail.id;
      }

      const newPatient = await Patient.create({
        hospitalId,
        token,
        name: data.name || 'Unknown',
        age: data.age,
        gender: data.gender,
        phone: data.phone,
        address: data.address,
        patientType: data.patientType || 'New',
        opdIpd: data.opdIpd || 'OPD',
        department: dept,
        doctorId: assignedDoctor,
        reason: data.reason,
        status: 'waiting',
        registeredAt: new Date(),
        vitals: JSON.stringify(data.vitals || {}),
        prescription: data.prescription,
        history: JSON.stringify(data.history || []),
        pharmacyState: null,
        cost: data.cost || 0
      });

      console.log(`Registered patient ${newPatient.id} token ${token}`);

      io.to('doctors').emit('patient-registered', newPatient);
      io.to('reception').emit('patient-registered', newPatient);
      io.emit('queue-updated', { patient: newPatient });
      socket.emit('patient-registered', newPatient);

    } catch (err) {
      console.error(err);
      socket.emit('patient-registration-error', { message: err.message });
    }
  });

  socket.on('move-patient', async ({ id, status, doctorId, pharmacyState }) => {
    try {
      const patient = await Patient.findById(id);
      if (!patient) return;

      if (status) patient.status = status;
      if (doctorId) patient.doctorId = doctorId;
      if (pharmacyState) patient.pharmacyState = pharmacyState;

      await patient.save();

      io.emit('patient-updated', patient);
      io.to('doctors').emit('queue-updated', { patient });
      io.to('reception').emit('queue-updated', { patient });
      io.to('pharmacy').emit('queue-updated', { patient });
    } catch (err) {
      console.error(err);
    }
  });

  socket.on('update-prescription', async ({ id, prescription }) => {
    try {
      const patient = await Patient.findByIdAndUpdate(id, { prescription }, { new: true });
      if (!patient) return;

      // Check for lab keywords
      const labKeywords = ['test', 'lab', 'cbc', 'blood', 'urine', 'x-ray', 'scan', 'profile', 'panel'];
      const lowerPrescription = prescription.toLowerCase();
      const hasLabRequest = labKeywords.some(keyword => lowerPrescription.includes(keyword));

      if (hasLabRequest) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const existing = await LabTest.findOne({
          patientId: id,
          orderedAt: { $gte: today },
          status: 'pending'
        });

        if (!existing) {
          const testName = "Lab Test Request (from Prescription)";
          let doctorName = 'Doctor';
          const doc = doctors.find(d => d.id === patient.doctorId);
          if (doc) doctorName = doc.name;

          await LabTest.create({
            hospitalId: patient.hospitalId,
            patientId: id,
            testName,
            orderedBy: doctorName,
            orderedAt: new Date(),
            status: 'pending',
            priority: 'normal',
            sampleStatus: 'pending'
          });

          io.to('lab').emit('lab-update');
        }
      }

      io.to('doctors').emit('prescription-updated', patient);
      io.to('reception').emit('prescription-updated', patient);
      socket.emit('prescription-updated', patient);
    } catch (err) {
      console.error(err);
    }
  });

  socket.on('create-lab-request', async ({ patientId, testName, doctorId }) => {
    try {
      console.log('create-lab-request received:', { patientId, testName, doctorId });
      const patient = await Patient.findById(patientId);
      if (!patient) {
        console.error('Patient not found for ID:', patientId);
        socket.emit('lab-request-created', { success: false, message: 'Patient not found' });
        return;
      }

      let doctorName = 'Doctor';
      const doc = doctors.find(d => d.id === doctorId);
      if (doc) doctorName = doc.name;

      const newTest = await LabTest.create({
        hospitalId: patient.hospitalId,
        patientId,
        testName: testName || "Manual Lab Request",
        orderedBy: doctorName,
        orderedAt: new Date(),
        status: 'pending',
        priority: 'normal',
        sampleStatus: 'pending'
      });

      io.to('lab').emit('lab-update');
      socket.emit('lab-request-created', { success: true, testId: newTest._id });
    } catch (err) {
      socket.emit('lab-request-created', { success: false, message: err.message });
    }
  });

  socket.on('disconnect', () => { });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
