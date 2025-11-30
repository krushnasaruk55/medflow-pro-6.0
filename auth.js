const crypto = require('crypto');
const bcrypt = require('bcryptjs');

// Secret key for password generation (keep this secret!)
const SECRET_KEY = 'MedFlowPro2025SecretKey';
const SUPER_ADMIN_PASSWORD = 'mrunal09032024';

function verifySuperAdminPassword(password) {
    return password === SUPER_ADMIN_PASSWORD;
}

/**
 * Generate monthly password for a specific hospital
 * Each hospital gets a unique password based on their ID
 */
function generateHospitalPassword(hospitalId) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // 1-12

    // Create a unique string for this hospital and month
    const monthString = `${hospitalId}-${year}-${month.toString().padStart(2, '0')}-${SECRET_KEY}`;

    // Generate hash
    const hash = crypto.createHash('sha256').update(monthString).digest('hex');

    // Take first 8 characters and format nicely
    const password = hash.substring(0, 8).toUpperCase();

    // Format as XXXX-XXXX for easier reading
    return `${password.substring(0, 4)}-${password.substring(4, 8)}`;
}

/**
 * Verify if provided password matches hospital's current month password
 */
function verifyHospitalPassword(hospitalId, inputPassword) {
    const currentPassword = generateHospitalPassword(hospitalId);
    return inputPassword === currentPassword;
}

/**
 * Hash user password for storage (Synchronous)
 */
function hashPassword(password) {
    return bcrypt.hashSync(password, 10);
}

/**
 * Verify user password (Synchronous)
 */
function comparePassword(password, hash) {
    return bcrypt.compareSync(password, hash);
}

/**
 * Get password expiry date (last day of current month)
 */
function getPasswordExpiry() {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return lastDay;
}

/**
 * Get current month name and year for display
 */
function getCurrentPeriod() {
    const now = new Date();
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
    return `${monthNames[now.getMonth()]} ${now.getFullYear()}`;
}

/**
 * Get days remaining until password expires
 */
function getDaysRemaining() {
    const now = new Date();
    const expiry = getPasswordExpiry();
    const diffTime = expiry - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
}

/**
 * Generate unique hospital ID (simple implementation)
 */
function generateHospitalId() {
    return 'H' + Date.now() + Math.random().toString(36).substring(2, 7).toUpperCase();
}

module.exports = {
    generateHospitalPassword,
    verifyHospitalPassword,
    hashPassword,
    comparePassword, // Export as comparePassword to match server usage
    verifyUserPassword: comparePassword, // Alias for backward compatibility
    getPasswordExpiry,
    getCurrentPeriod,
    getDaysRemaining,
    generateHospitalId,
    verifySuperAdminPassword
};
