const { body, validationResult } = require('express-validator');

// Middleware to handle validation errors
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: errors.array()
        });
    }
    next();
};

// Hospital Registration Validators
const registerValidators = [
    body('hospital.name').trim().notEmpty().withMessage('Hospital name is required'),
    body('hospital.email').isEmail().withMessage('Invalid email address'),
    body('admin.username').trim().notEmpty().withMessage('Username is required'),
    body('admin.password')
        .isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
    validate
];

// Login Validators
const loginValidators = [
    body('username').trim().notEmpty().withMessage('Username is required'),
    body('userPassword').notEmpty().withMessage('Password is required'),
    body('hospitalPassword').notEmpty().withMessage('Hospital password is required'),
    validate
];

// Patient Registration Validators
const patientValidators = [
    body('name').trim().notEmpty().withMessage('Patient name is required'),
    body('age').isInt({ min: 0, max: 150 }).withMessage('Age must be a valid number'),
    body('phone').optional().isMobilePhone().withMessage('Invalid phone number'),
    body('gender').isIn(['Male', 'Female', 'Other']).withMessage('Invalid gender'),
    validate
];

// Prescription Template Validators
const templateValidators = [
    body('templateName').trim().notEmpty().withMessage('Template name is required'),
    body('fontSize').isInt({ min: 8, max: 24 }).withMessage('Font size must be between 8 and 24'),
    body('primaryColor').isHexColor().withMessage('Invalid primary color'),
    body('secondaryColor').isHexColor().withMessage('Invalid secondary color'),
    validate
];

module.exports = {
    registerValidators,
    loginValidators,
    patientValidators,
    templateValidators
};
