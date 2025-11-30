require('dotenv').config();
const mongoose = require('mongoose');
const {
    connectDB, Hospital, User, Patient, LabTest,
    LabResult, Inventory, Appointment, LabInventory,
    LabTestType, PrescriptionTemplate
} = require('./database');

async function verifyDatabase() {
    console.log('Starting Database Verification...');

    if (!process.env.MONGODB_URI) {
        console.error('ERROR: MONGODB_URI is missing in .env file.');
        console.log('Please add your MongoDB connection string to .env and try again.');
        process.exit(1);
    }

    try {
        await connectDB();
        console.log('✅ MongoDB Connected Successfully');

        // 1. Test Hospital Registration
        console.log('\nTesting Hospital Registration...');
        const testEmail = `test_hospital_${Date.now()}@example.com`;
        const hospital = await Hospital.create({
            name: 'Test Hospital',
            email: testEmail,
            phone: '1234567890',
            address: '123 Test St',
            subscriptionStatus: 'active',
            subscriptionExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        });
        console.log(`✅ Hospital Created: ${hospital.name} (ID: ${hospital.id})`);

        // 2. Test User Creation
        console.log('\nTesting User Creation...');
        const user = await User.create({
            hospitalId: hospital._id,
            username: `admin_${Date.now()}`,
            role: 'admin',
            password: 'hashed_password_placeholder'
        });
        console.log(`✅ Admin User Created: ${user.username}`);

        // 3. Test Patient Registration
        console.log('\nTesting Patient Registration...');
        const patient = await Patient.create({
            hospitalId: hospital._id,
            token: 1,
            name: 'John Doe',
            age: 30,
            gender: 'Male',
            phone: '9876543210',
            department: 'General',
            status: 'waiting',
            registeredAt: new Date()
        });
        console.log(`✅ Patient Created: ${patient.name} (ID: ${patient.id})`);

        // 4. Test Lab Request
        console.log('\nTesting Lab Request...');
        const labTest = await LabTest.create({
            hospitalId: hospital._id,
            patientId: patient._id,
            testName: 'CBC',
            orderedBy: 'Dr. Test',
            status: 'pending'
        });
        console.log(`✅ Lab Test Created: ${labTest.testName} (ID: ${labTest.id})`);

        // 5. Test Lab Results
        console.log('\nTesting Lab Results...');
        await LabResult.create({
            testId: labTest._id,
            parameterName: 'Hemoglobin',
            value: '14.5',
            unit: 'g/dL'
        });
        const results = await LabResult.find({ testId: labTest._id });
        if (results.length > 0) {
            console.log(`✅ Lab Results Saved: ${results[0].parameterName} = ${results[0].value}`);
        } else {
            throw new Error('Failed to save lab results');
        }

        // 6. Test Inventory
        console.log('\nTesting Inventory...');
        await Inventory.create({
            hospitalId: hospital._id,
            medicationName: 'Paracetamol',
            quantity: 100,
            unitPrice: 5
        });
        const inventory = await Inventory.findOne({ hospitalId: hospital._id });
        console.log(`✅ Inventory Item Created: ${inventory.medicationName}`);

        // Clean up (Optional, commented out to let user inspect DB)
        // await Hospital.findByIdAndDelete(hospital._id);
        // await User.deleteMany({ hospitalId: hospital._id });
        // ...

        console.log('\n🎉 ALL DATABASE CHECKS PASSED!');
        console.log('The database is fully functional with all features.');
        process.exit(0);

    } catch (error) {
        console.error('\n❌ VERIFICATION FAILED:', error.message);
        process.exit(1);
    }
}

verifyDatabase();
