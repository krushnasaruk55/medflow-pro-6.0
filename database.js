const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }
};

// --- Schemas ---

const HospitalSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: String,
  address: String,
  subscriptionStatus: { type: String, default: 'active' },
  subscriptionExpiry: String,
  createdAt: { type: Date, default: Date.now },
  lastLogin: Date
}, { toJSON: { virtuals: true }, toObject: { virtuals: true } });

const UserSchema = new mongoose.Schema({
  hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital', required: true },
  username: { type: String, required: true },
  email: String,
  role: { type: String, required: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  lastLogin: Date
}, { toJSON: { virtuals: true }, toObject: { virtuals: true } });
// Compound index for unique username per hospital
UserSchema.index({ hospitalId: 1, username: 1 }, { unique: true });

const PatientSchema = new mongoose.Schema({
  hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital', required: true },
  token: Number, // Keeping as Number for token display logic if needed, or could be String
  publicToken: String,
  name: String,
  age: Number,
  gender: String,
  phone: String,
  address: String,
  bloodGroup: String,
  emergencyContact: String,
  emergencyPhone: String,
  insuranceId: String,
  medicalHistory: String,
  allergies: String,
  chronicConditions: String,
  patientType: String,
  opdIpd: String,
  department: String,
  doctorId: Number, // Keeping as Number to match static doctors array in server.js
  reason: String,
  status: String,
  registeredAt: { type: Date, default: Date.now },
  appointmentDate: String,
  vitals: String, // JSON string in SQLite, can be Object here but keeping String for minimal refactor
  prescription: String, // JSON string
  diagnosis: String,
  pharmacyState: String,
  history: String, // JSON string
  cost: { type: Number, default: 0 },
  reports: String // JSON string
}, { toJSON: { virtuals: true }, toObject: { virtuals: true } });

const VitalSchema = new mongoose.Schema({
  hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital', required: true },
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient' },
  bloodPressure: String,
  temperature: Number,
  pulse: Number,
  oxygenSaturation: Number,
  weight: Number,
  height: Number,
  recordedAt: { type: Date, default: Date.now },
  recordedBy: String
}, { toJSON: { virtuals: true }, toObject: { virtuals: true } });

const LabTestSchema = new mongoose.Schema({
  hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital', required: true },
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient' },
  testName: String,
  testType: String,
  orderedBy: String,
  orderedAt: { type: Date, default: Date.now },
  status: { type: String, default: 'pending' },
  result: String, // Summary result
  resultDate: Date,
  priority: { type: String, default: 'normal' },
  sampleStatus: { type: String, default: 'pending' },
  technicianId: Number,
  machineId: String,
  sampleCollectedAt: Date,
  sampleCollectedBy: String,
  rejectionReason: String,
  startedAt: Date,
  completedAt: Date
}, { toJSON: { virtuals: true }, toObject: { virtuals: true } });

const LabResultSchema = new mongoose.Schema({
  testId: { type: mongoose.Schema.Types.ObjectId, ref: 'LabTest', required: true },
  parameterName: { type: String, required: true },
  value: String,
  unit: String,
  referenceRange: String,
  isAbnormal: { type: Boolean, default: false },
  notes: String
}, { toJSON: { virtuals: true }, toObject: { virtuals: true } });

const InventorySchema = new mongoose.Schema({
  hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital', required: true },
  medicationName: String,
  batchNumber: String,
  quantity: Number,
  unitPrice: Number,
  expiryDate: String,
  manufacturer: String,
  category: String,
  addedAt: { type: Date, default: Date.now },
  lastUpdated: Date
}, { toJSON: { virtuals: true }, toObject: { virtuals: true } });

const AppointmentSchema = new mongoose.Schema({
  hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital', required: true },
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient' },
  patientName: String,
  phone: String,
  department: String,
  doctorId: Number,
  appointmentDate: String,
  appointmentTime: String,
  status: { type: String, default: 'scheduled' },
  notes: String,
  createdAt: { type: Date, default: Date.now }
}, { toJSON: { virtuals: true }, toObject: { virtuals: true } });

const LabInventorySchema = new mongoose.Schema({
  hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital', required: true },
  itemName: { type: String, required: true },
  batchNumber: String,
  quantity: { type: Number, default: 0 },
  unit: String,
  expiryDate: String,
  minLevel: { type: Number, default: 10 },
  status: { type: String, default: 'ok' },
  addedAt: { type: Date, default: Date.now },
  updatedAt: Date
}, { toJSON: { virtuals: true }, toObject: { virtuals: true } });

const LabTestTypeSchema = new mongoose.Schema({
  hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital', required: true },
  name: { type: String, required: true },
  category: String,
  parameters: String, // JSON
  price: { type: Number, default: 0 },
  turnaroundTime: Number
}, { toJSON: { virtuals: true }, toObject: { virtuals: true } });

const PrescriptionTemplateSchema = new mongoose.Schema({
  hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital', required: true, unique: true },
  templateName: { type: String, default: 'Default Template' },
  hospitalName: String,
  hospitalAddress: String,
  hospitalPhone: String,
  hospitalEmail: String,
  hospitalLogo: String,
  doctorNamePosition: { type: String, default: 'top-left' },
  headerText: String,
  footerText: String,
  showQRCode: { type: Boolean, default: true },
  showWatermark: { type: Boolean, default: false },
  watermarkText: String,
  fontSize: { type: Number, default: 12 },
  fontFamily: { type: String, default: 'Helvetica' },
  primaryColor: { type: String, default: '#0EA5E9' },
  secondaryColor: { type: String, default: '#666666' },
  paperSize: { type: String, default: 'A4' },
  marginTop: { type: Number, default: 50 },
  marginBottom: { type: Number, default: 50 },
  marginLeft: { type: Number, default: 50 },
  marginRight: { type: Number, default: 50 },
  showLetterhead: { type: Boolean, default: true },
  showVitals: { type: Boolean, default: true },
  showDiagnosis: { type: Boolean, default: true },
  showHistory: { type: Boolean, default: true },
  layoutStyle: { type: String, default: 'classic' },
  doctorSignature: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: Date
}, { toJSON: { virtuals: true }, toObject: { virtuals: true } });

// --- Models ---
const Hospital = mongoose.model('Hospital', HospitalSchema);
const User = mongoose.model('User', UserSchema);
const Patient = mongoose.model('Patient', PatientSchema);
const Vital = mongoose.model('Vital', VitalSchema);
const LabTest = mongoose.model('LabTest', LabTestSchema);
const LabResult = mongoose.model('LabResult', LabResultSchema);
const Inventory = mongoose.model('Inventory', InventorySchema);
const Appointment = mongoose.model('Appointment', AppointmentSchema);
const LabInventory = mongoose.model('LabInventory', LabInventorySchema);
const LabTestType = mongoose.model('LabTestType', LabTestTypeSchema);
const PrescriptionTemplate = mongoose.model('PrescriptionTemplate', PrescriptionTemplateSchema);

module.exports = {
  connectDB,
  Hospital,
  User,
  Patient,
  Vital,
  LabTest,
  LabResult,
  Inventory,
  Appointment,
  LabInventory,
  LabTestType,
  PrescriptionTemplate
};
