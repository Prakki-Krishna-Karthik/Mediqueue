const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mongoose = require('mongoose');
const twilio = require('twilio');
const schedule = require('node-schedule');
const dotenv = require('dotenv');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// Twilio configuration
const twilioClient = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/mediqueue-chennai', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('✅ Connected to MongoDB');
    initializeData();
}).catch(err => {
    console.error('❌ MongoDB connection error:', err);
});

// ==================== DATABASE SCHEMAS ====================

// Chennai Hospitals Schema
const hospitalSchema = new mongoose.Schema({
    name: { type: String, required: true },
    locality: { type: String, required: true },
    address: { type: String, required: true },
    coordinates: {
        lat: { type: Number, required: true },
        lng: { type: Number, required: true }
    },
    phone: { type: String, required: true },
    emergencyContact: { type: String },
    specialties: [{ type: String }],
    prioritySlots: { type: Number, default: 2 },
    normalSlots: { type: Number, default: 5 },
    slotDuration: { type: Number, default: 5 }, // 5 minutes per slot
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now }
});

// Doctor Schema
const doctorSchema = new mongoose.Schema({
    name: { type: String, required: true },
    specialty: { type: String, required: true },
    hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital', required: true },
    availability: [{ type: String }], // Days of week
    currentToken: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    consultationFee: { type: Number, default: 500 },
    experience: { type: Number },
    qualifications: [{ type: String }],
    createdAt: { type: Date, default: Date.now }
});

// Appointment Schema with 5-minute slots
const appointmentSchema = new mongoose.Schema({
    patientName: { type: String, required: true },
    mobileNumber: { type: String, required: true },
    hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital', required: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor' },
    symptoms: { type: String, required: true },
    appointmentDate: { type: Date, required: true },
    tokenNumber: { type: String, required: true }, // Format: P-001 or N-001
    slotNumber: { type: Number, required: true },
    slotType: { type: String, enum: ['priority', 'normal'], required: true },
    status: { 
        type: String, 
        enum: ['waiting', 'notified', 'serving', 'completed', 'cancelled', 'no-show'],
        default: 'waiting'
    },
    isSeverity: { type: Boolean, default: false },
    severityScore: { type: Number },
    severityCategory: { type: String, enum: ['critical', 'urgent', 'moderate', 'mild'] },
    aiConfidence: { type: Number },
    
    // Location tracking
    patientLocation: {
        lat: { type: Number },
        lng: { type: Number },
        timestamp: { type: Date }
    },
    
    // Travel information
    travelInfo: {
        distance: { type: Number },
        travelTime: { type: Number },
        recommendedDeparture: { type: Date },
        isPeakHour: { type: Boolean }
    },
    
    // Estimated times
    estimatedStartTime: { type: Date },
    estimatedEndTime: { type: Date },
    actualStartTime: { type: Date },
    actualEndTime: { type: Date },
    
    // Notifications
    smsSent: { type: Boolean, default: false },
    notifiedAt: { type: Date },
    
    createdAt: { type: Date, default: Date.now }
});

// ESP32 Patient Device Schema
const patientDeviceSchema = new mongoose.Schema({
    deviceId: { type: String, required: true, unique: true },
    patientToken: { type: String, required: true },
    patientName: { type: String, required: true },
    apiKey: { type: String, required: true },
    
    // Location tracking
    currentLocation: {
        lat: { type: Number },
        lng: { type: Number },
        speed: { type: Number },
        timestamp: { type: Date }
    },
    
    // Health monitoring
    healthReadings: [{
        heartRate: { type: Number },
        spo2: { type: Number },
        temperature: { type: Number },
        timestamp: { type: Date, default: Date.now },
        isAbnormal: { type: Boolean }
    }],
    
    // Emergency
    emergencyMode: { type: Boolean, default: false },
    lastEmergency: { type: Date },
    
    // Device status
    batteryLevel: { type: Number },
    firmwareVersion: { type: String },
    lastSeen: { type: Date },
    isActive: { type: Boolean, default: true },
    
    registeredAt: { type: Date, default: Date.now }
});

// Emergency Alert Schema
const emergencyAlertSchema = new mongoose.Schema({
    alertId: { type: String, required: true, unique: true },
    deviceId: { type: String, required: true },
    patientToken: { type: String, required: true },
    patientName: { type: String },
    mobileNumber: { type: String },
    
    type: { type: String, enum: ['emergency_button', 'health_abnormal', 'fall_detected'] },
    
    location: {
        lat: { type: Number },
        lng: { type: Number },
        accuracy: { type: Number }
    },
    
    healthData: {
        heartRate: { type: Number },
        spo2: { type: Number },
        temperature: { type: Number }
    },
    
    status: { type: String, enum: ['active', 'acknowledged', 'resolved'], default: 'active' },
    priority: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'high' },
    
    hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital' },
    assignedAmbulance: { type: String },
    
    acknowledgedBy: { type: String },
    acknowledgedAt: { type: Date },
    resolvedAt: { type: Date },
    
    createdAt: { type: Date, default: Date.now }
});

// Admin User Schema
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    name: { type: String, required: true },
    role: { type: String, enum: ['admin', 'staff', 'doctor'], default: 'staff' },
    hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital' },
    lastLogin: { type: Date },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now }
});

// ESP32 Display Device Schema
const esp32DisplaySchema = new mongoose.Schema({
    deviceId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    location: { type: String },
    hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital' },
    apiKey: { type: String, required: true },
    displayMode: { type: String, enum: ['queue', 'hospital', 'token', 'status'], default: 'queue' },
    refreshInterval: { type: Number, default: 10 },
    
    // Display settings
    settings: {
        brightness: { type: Number, default: 128 },
        contrast: { type: Number, default: 128 },
        rotation: { type: Number, default: 0 },
        showTime: { type: Boolean, default: true },
        showDate: { type: Boolean, default: true },
        showEstimatedTime: { type: Boolean, default: true },
        customMessage: { type: String }
    },
    
    lastSeen: { type: Date },
    lastIp: { type: String },
    isActive: { type: Boolean, default: true },
    
    registeredAt: { type: Date, default: Date.now }
});

// Session Schema
const sessionSchema = new mongoose.Schema({
    sessionToken: { type: String, required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    username: { type: String },
    createdAt: { type: Date, default: Date.now, expires: 86400 } // 24 hours
});

// Create models
const Hospital = mongoose.model('Hospital', hospitalSchema);
const Doctor = mongoose.model('Doctor', doctorSchema);
const Appointment = mongoose.model('Appointment', appointmentSchema);
const PatientDevice = mongoose.model('PatientDevice', patientDeviceSchema);
const EmergencyAlert = mongoose.model('EmergencyAlert', emergencyAlertSchema);
const User = mongoose.model('User', userSchema);
const Esp32Display = mongoose.model('Esp32Display', esp32DisplaySchema);
const Session = mongoose.model('Session', sessionSchema);

// ==================== CHENNAI HOSPITALS DATA ====================
const CHENNAI_HOSPITALS = [
    {
        name: "Apollo Hospitals - Greams Road",
        locality: "Greams Road",
        address: "21, Greams Lane, Off Greams Road, Chennai - 600006",
        coordinates: { lat: 13.0649, lng: 80.2552 },
        phone: "+91-44-2829-3333",
        emergencyContact: "+91-44-2829-3421",
        specialties: ["Cardiology", "Neurology", "Orthopedics", "Oncology"],
        prioritySlots: 2,
        normalSlots: 5,
        slotDuration: 5
    },
    {
        name: "MIOT International",
        locality: "Manapakkam",
        address: "4/112, Mount Poonamallee Road, Manapakkam, Chennai - 600089",
        coordinates: { lat: 13.0197, lng: 80.1797 },
        phone: "+91-44-4200-2288",
        emergencyContact: "+91-44-2249-1111",
        specialties: ["Orthopedics", "Trauma Care", "Cardiology", "Neurology"],
        prioritySlots: 2,
        normalSlots: 5,
        slotDuration: 5
    },
    {
        name: "Fortis Malar Hospital",
        locality: "Adyar",
        address: "52, 1st Main Road, Gandhi Nagar, Adyar, Chennai - 600020",
        coordinates: { lat: 13.0046, lng: 80.2491 },
        phone: "+91-44-4289-2222",
        emergencyContact: "+91-44-4933-3333",
        specialties: ["Cardiology", "Gastroenterology", "Nephrology"],
        prioritySlots: 2,
        normalSlots: 5,
        slotDuration: 5
    },
    {
        name: "Kauvery Hospital",
        locality: "Alwarpet",
        address: "81, Dr Radhakrishnan Salai, Alwarpet, Chennai - 600004",
        coordinates: { lat: 13.0385, lng: 80.2549 },
        phone: "+91-44-4000-6000",
        emergencyContact: "+91-44-4000-6666",
        specialties: ["Cardiology", "Pulmonology", "Critical Care"],
        prioritySlots: 2,
        normalSlots: 5,
        slotDuration: 5
    },
    {
        name: "Billroth Hospitals",
        locality: "Shenoy Nagar",
        address: "52, West Mada Church Street, Shenoy Nagar, Chennai - 600030",
        coordinates: { lat: 13.0745, lng: 80.2249 },
        phone: "+91-44-2615-5555",
        emergencyContact: "+91-44-2615-5556",
        specialties: ["General Medicine", "Cardiology", "Diabetology"],
        prioritySlots: 2,
        normalSlots: 5,
        slotDuration: 5
    },
    {
        name: "SRM Institutes for Medical Science",
        locality: "Vadapalani",
        address: "No.1, Jawaharlal Nehru Road, Vadapalani, Chennai - 600026",
        coordinates: { lat: 13.0525, lng: 80.2125 },
        phone: "+91-44-4220-2222",
        emergencyContact: "+91-44-4395-9595",
        specialties: ["Multi-Specialty", "Cardiology", "Neurology"],
        prioritySlots: 2,
        normalSlots: 5,
        slotDuration: 5
    },
    {
        name: "Global Health City",
        locality: "Perumbakkam",
        address: "439, Cheran Nagar, Perumbakkam, Chennai - 600100",
        coordinates: { lat: 12.9069, lng: 80.2275 },
        phone: "+91-44-4477-7000",
        emergencyContact: "+91-44-4477-7111",
        specialties: ["Cardiology", "Transplant", "Oncology"],
        prioritySlots: 2,
        normalSlots: 5,
        slotDuration: 5
    },
    {
        name: "Chettinad Health City",
        locality: "Kelambakkam",
        address: "Rajiv Gandhi Salai, Kelambakkam, Chennai - 603103",
        coordinates: { lat: 12.8193, lng: 80.2218 },
        phone: "+91-44-4741-1000",
        emergencyContact: "+91-44-4741-1111",
        specialties: ["Cardiology", "Orthopedics", "Neurology"],
        prioritySlots: 2,
        normalSlots: 5,
        slotDuration: 5
    }
];

// Chennai Doctors Data
const CHENNAI_DOCTORS = [
    // Apollo Hospitals
    { name: "Dr. Devi Shetty", specialty: "Cardiology", hospitalName: "Apollo Hospitals - Greams Road", experience: 25 },
    { name: "Dr. Bhuwaneshwari", specialty: "Neurology", hospitalName: "Apollo Hospitals - Greams Road", experience: 20 },
    { name: "Dr. S. Rajasekaran", specialty: "Orthopedics", hospitalName: "Apollo Hospitals - Greams Road", experience: 22 },
    { name: "Dr. V. Shanta", specialty: "Oncology", hospitalName: "Apollo Hospitals - Greams Road", experience: 30 },
    
    // MIOT
    { name: "Dr. P.V.A. Mohandas", specialty: "Orthopedics", hospitalName: "MIOT International", experience: 28 },
    { name: "Dr. V. Bashi", specialty: "Cardiology", hospitalName: "MIOT International", experience: 24 },
    { name: "Dr. S. Elangovan", specialty: "Trauma Care", hospitalName: "MIOT International", experience: 18 },
    
    // Fortis
    { name: "Dr. C.N. Mani", specialty: "Cardiology", hospitalName: "Fortis Malar Hospital", experience: 22 },
    { name: "Dr. M. Balamurugan", specialty: "Gastroenterology", hospitalName: "Fortis Malar Hospital", experience: 16 },
    
    // Kauvery
    { name: "Dr. A. Duraisamy", specialty: "Cardiology", hospitalName: "Kauvery Hospital", experience: 20 },
    { name: "Dr. S. Chandrasekar", specialty: "Pulmonology", hospitalName: "Kauvery Hospital", experience: 18 },
    
    // Billroth
    { name: "Dr. V. S. Natarajan", specialty: "General Medicine", hospitalName: "Billroth Hospitals", experience: 25 },
    { name: "Dr. V. Mohan", specialty: "Diabetology", hospitalName: "Billroth Hospitals", experience: 27 },
    
    // SRM
    { name: "Dr. R. Balaji", specialty: "Cardiology", hospitalName: "SRM Institutes for Medical Science", experience: 19 },
    { name: "Dr. S. Ramesh", specialty: "Neurology", hospitalName: "SRM Institutes for Medical Science", experience: 17 },
    
    // Global Health City
    { name: "Dr. K. R. Balakrishnan", specialty: "Cardiology", hospitalName: "Global Health City", experience: 23 },
    { name: "Dr. R. Ravi", specialty: "Transplant", hospitalName: "Global Health City", experience: 21 },
    
    // Chettinad
    { name: "Dr. P. S. Rajan", specialty: "Cardiology", hospitalName: "Chettinad Health City", experience: 22 },
    { name: "Dr. M. S. Ravi", specialty: "Orthopedics", hospitalName: "Chettinad Health City", experience: 19 }
];

// ==================== INITIALIZATION ====================
async function initializeData() {
    try {
        // Initialize hospitals
        for (const hospitalData of CHENNAI_HOSPITALS) {
            const existing = await Hospital.findOne({ name: hospitalData.name });
            if (!existing) {
                await Hospital.create(hospitalData);
                console.log(`✅ Hospital created: ${hospitalData.name}`);
            }
        }
        
        // Initialize doctors
        for (const doctorData of CHENNAI_DOCTORS) {
            const hospital = await Hospital.findOne({ name: doctorData.hospitalName });
            if (hospital) {
                const existing = await Doctor.findOne({ 
                    name: doctorData.name, 
                    hospitalId: hospital._id 
                });
                if (!existing) {
                    await Doctor.create({
                        ...doctorData,
                        hospitalId: hospital._id,
                        availability: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
                    });
                    console.log(`✅ Doctor created: ${doctorData.name} at ${hospital.name}`);
                }
            }
        }
        
        // Create admin user if not exists
        const adminExists = await User.findOne({ username: 'admin' });
        if (!adminExists) {
            const hashedPassword = await bcrypt.hash('admin123', 10);
            await User.create({
                username: 'admin',
                password: hashedPassword,
                name: 'System Administrator',
                role: 'admin'
            });
            console.log('✅ Admin user created');
        }
        
        console.log('✅ Database initialization complete');
    } catch (error) {
        console.error('❌ Initialization error:', error);
    }
}

// ==================== UTILITY FUNCTIONS ====================

// Calculate distance using Haversine formula
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// Calculate travel time based on distance and Chennai traffic
function calculateTravelTime(distance, isEmergency = false) {
    const NORMAL_SPEED = 25; // km/h in Chennai
    const EMERGENCY_SPEED = 40; // km/h with siren
    const TRAFFIC_MULTIPLIER = 1.3;
    
    const hour = new Date().getHours();
    const isPeakHour = (hour >= 8 && hour <= 10) || (hour >= 17 && hour <= 20);
    
    let speed = isEmergency ? EMERGENCY_SPEED : NORMAL_SPEED;
    if (isPeakHour && !isEmergency) {
        speed = speed / TRAFFIC_MULTIPLIER;
    }
    
    const timeHours = distance / speed;
    const timeMinutes = Math.ceil(timeHours * 60);
    
    return {
        minutes: timeMinutes,
        distance: Math.round(distance * 10) / 10,
        isPeakHour,
        speed: Math.round(speed)
    };
}

// Generate token number
function generateTokenNumber(hospitalId, date, isSeverity, slotNumber) {
    const dateStr = new Date(date).toISOString().split('T')[0].replace(/-/g, '');
    const prefix = isSeverity ? 'P' : 'N'; // P for Priority, N for Normal
    return `${prefix}-${hospitalId}-${dateStr}-${String(slotNumber).padStart(3, '0')}`;
}

// Calculate estimated start time based on queue position
function calculateEstimatedStartTime(queuePosition, slotDuration = 5, baseTime = new Date()) {
    const estimatedMinutes = queuePosition * slotDuration;
    const startTime = new Date(baseTime.getTime() + estimatedMinutes * 60000);
    
    return {
        estimatedMinutes,
        startTime,
        startTimeFormatted: startTime.toLocaleTimeString('en-IN', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: true 
        })
    };
}

// Generate API key for ESP32
function generateApiKey() {
    return 'ESP-' + crypto.randomBytes(16).toString('hex').toUpperCase();
}

// Generate session token
function generateSessionToken() {
    return crypto.randomBytes(32).toString('hex');
}

// ==================== MIDDLEWARE ====================

// Authentication middleware
async function requireAuth(req, res, next) {
    const sessionToken = req.headers['x-session-token'] || req.cookies?.sessionToken;
    
    if (!sessionToken) {
        return res.status(401).json({ success: false, error: "Authentication required" });
    }
    
    const session = await Session.findOne({ sessionToken });
    if (!session) {
        return res.status(401).json({ success: false, error: "Invalid session" });
    }
    
    req.user = {
        userId: session.userId,
        username: session.username
    };
    next();
}

// ESP32 authentication middleware
async function authenticateESP32(req, res, next) {
    const apiKey = req.headers['x-api-key'] || req.query.apiKey;
    
    if (!apiKey) {
        return res.status(401).json({ success: false, error: "API key required" });
    }
    
    // Check patient devices first
    let device = await PatientDevice.findOne({ apiKey, isActive: true });
    
    if (!device) {
        // Check display devices
        device = await Esp32Display.findOne({ apiKey, isActive: true });
    }
    
    if (!device) {
        return res.status(403).json({ success: false, error: "Invalid API key" });
    }
    
    device.lastSeen = new Date();
    await device.save();
    
    req.device = device;
    next();
}

// ==================== API ROUTES ====================

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        success: true, 
        message: 'MediQueue Chennai Server Running',
        timestamp: new Date().toISOString(),
        hospitals: CHENNAI_HOSPITALS.length,
        mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    });
});

// ==================== HOSPITAL ROUTES ====================

// Get all hospitals
app.get('/api/hospitals', async (req, res) => {
    try {
        const hospitals = await Hospital.find({ isActive: true });
        
        // Get current queue counts for each hospital
        const now = new Date();
        const today = new Date(now.setHours(0, 0, 0, 0));
        
        const hospitalsWithStats = await Promise.all(hospitals.map(async (hospital) => {
            const waitingCount = await Appointment.countDocuments({
                hospitalId: hospital._id,
                appointmentDate: { $gte: today },
                status: 'waiting'
            });
            
            const priorityCount = await Appointment.countDocuments({
                hospitalId: hospital._id,
                appointmentDate: { $gte: today },
                status: 'waiting',
                slotType: 'priority'
            });
            
            return {
                ...hospital.toObject(),
                waitingCount,
                priorityCount,
                availableSlots: calculateAvailableSlots(hospital)
            };
        }));
        
        res.json({ success: true, hospitals: hospitalsWithStats });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get hospital by ID
app.get('/api/hospitals/:id', async (req, res) => {
    try {
        const hospital = await Hospital.findById(req.params.id);
        if (!hospital) {
            return res.status(404).json({ success: false, error: "Hospital not found" });
        }
        
        // Get doctors for this hospital
        const doctors = await Doctor.find({ hospitalId: hospital._id, isActive: true });
        
        // Get today's queue
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const queue = await Appointment.find({
            hospitalId: hospital._id,
            appointmentDate: { $gte: today, $lt: tomorrow },
            status: { $in: ['waiting', 'notified', 'serving'] }
        }).sort({ slotNumber: 1 });
        
        res.json({
            success: true,
            hospital,
            doctors,
            queue,
            availableSlots: calculateAvailableSlots(hospital)
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get hospitals by locality
app.get('/api/hospitals/locality/:locality', async (req, res) => {
    try {
        const hospitals = await Hospital.find({ 
            locality: req.params.locality,
            isActive: true 
        });
        res.json({ success: true, hospitals });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get all localities
app.get('/api/localities', async (req, res) => {
    try {
        const hospitals = await Hospital.find({ isActive: true });
        const localities = [...new Set(hospitals.map(h => h.locality))].sort();
        res.json({ success: true, localities });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== DOCTOR ROUTES ====================

// Get doctors by hospital
app.get('/api/doctors/:hospitalId', async (req, res) => {
    try {
        const doctors = await Doctor.find({ 
            hospitalId: req.params.hospitalId,
            isActive: true 
        });
        res.json({ success: true, doctors });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get doctor by ID
app.get('/api/doctor/:id', async (req, res) => {
    try {
        const doctor = await Doctor.findById(req.params.id).populate('hospitalId');
        if (!doctor) {
            return res.status(404).json({ success: false, error: "Doctor not found" });
        }
        res.json({ success: true, doctor });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== APPOINTMENT ROUTES ====================

// Book appointment
app.post('/api/appointments', async (req, res) => {
    try {
        const { patientName, mobileNumber, hospitalId, symptoms, appointmentDate, patientLocation } = req.body;
        
        // Validate required fields
        if (!patientName || !mobileNumber || !hospitalId || !symptoms || !appointmentDate) {
            return res.status(400).json({ 
                success: false, 
                error: "All fields are required" 
            });
        }
        
        // Get hospital
        const hospital = await Hospital.findById(hospitalId);
        if (!hospital) {
            return res.status(404).json({ success: false, error: "Hospital not found" });
        }
        
        // AI Severity Analysis (simplified version)
        const severityAnalysis = analyzeSymptoms(symptoms);
        const isSeverity = severityAnalysis.isSevere;
        
        // Check slot availability
        const today = new Date(appointmentDate);
        today.setHours(0, 0, 0, 0);
        
        // Count existing appointments for this day
        const existingPriority = await Appointment.countDocuments({
            hospitalId,
            appointmentDate: { $gte: today, $lt: new Date(today.getTime() + 86400000) },
            slotType: 'priority',
            status: { $in: ['waiting', 'notified', 'serving'] }
        });
        
        const existingNormal = await Appointment.countDocuments({
            hospitalId,
            appointmentDate: { $gte: today, $lt: new Date(today.getTime() + 86400000) },
            slotType: 'normal',
            status: { $in: ['waiting', 'notified', 'serving'] }
        });
        
        // Check if slots available
        if (isSeverity && existingPriority >= hospital.prioritySlots) {
            return res.status(400).json({ 
                success: false, 
                error: "No priority slots available for this date" 
            });
        }
        
        if (!isSeverity && existingNormal >= hospital.normalSlots) {
            return res.status(400).json({ 
                success: false, 
                error: "No normal slots available for this date" 
            });
        }
        
        // Determine slot number
        let slotNumber, slotType;
        if (isSeverity) {
            slotNumber = existingPriority + 1;
            slotType = 'priority';
        } else {
            slotNumber = existingNormal + 1;
            slotType = 'normal';
        }
        
        // Generate token number
        const tokenNumber = generateTokenNumber(hospitalId, appointmentDate, isSeverity, slotNumber);
        
        // Calculate queue position and estimated time
        const queuePosition = (isSeverity ? existingPriority : existingNormal);
        const estimatedStart = calculateEstimatedStartTime(queuePosition, hospital.slotDuration, new Date(appointmentDate));
        
        // Calculate travel time if location provided
        let travelInfo = null;
        if (patientLocation && patientLocation.lat && patientLocation.lng) {
            const distance = calculateDistance(
                patientLocation.lat,
                patientLocation.lng,
                hospital.coordinates.lat,
                hospital.coordinates.lng
            );
            travelInfo = calculateTravelTime(distance, isSeverity);
            
            // Calculate recommended departure
            const recommendedDeparture = new Date(estimatedStart.startTime.getTime() - travelInfo.minutes * 60000);
            travelInfo.recommendedDeparture = recommendedDeparture;
        }
        
        // Assign a doctor (simplified - randomly assign from available doctors)
        const doctors = await Doctor.find({ hospitalId, isActive: true });
        const assignedDoctor = doctors.length > 0 ? doctors[Math.floor(Math.random() * doctors.length)] : null;
        
        // Create appointment
        const appointment = new Appointment({
            patientName,
            mobileNumber,
            hospitalId,
            doctorId: assignedDoctor?._id,
            symptoms,
            appointmentDate: new Date(appointmentDate),
            tokenNumber,
            slotNumber,
            slotType,
            isSeverity,
            severityScore: severityAnalysis.score,
            severityCategory: severityAnalysis.category,
            aiConfidence: severityAnalysis.confidence,
            patientLocation: patientLocation ? {
                lat: patientLocation.lat,
                lng: patientLocation.lng,
                timestamp: new Date()
            } : undefined,
            travelInfo,
            estimatedStartTime: estimatedStart.startTime
        });
        
        await appointment.save();
        
        // Schedule SMS notification
        scheduleQueueProcessing(hospitalId);
        
        // Return success
        res.status(201).json({
            success: true,
            message: "Appointment booked successfully",
            appointment: {
                tokenNumber,
                patientName,
                hospitalName: hospital.name,
                appointmentDate,
                slotType,
                slotNumber,
                estimatedStartTime: estimatedStart.startTimeFormatted,
                travelInfo: travelInfo ? {
                    distance: travelInfo.distance,
                    travelTime: travelInfo.minutes,
                    recommendedDeparture: travelInfo.recommendedDeparture?.toLocaleTimeString('en-IN', {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true
                    })
                } : null
            },
            severityAnalysis
        });
        
    } catch (error) {
        console.error('Appointment booking error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// AI Symptom Analysis (simplified version)
function analyzeSymptoms(symptoms) {
    const symptoms_lower = symptoms.toLowerCase();
    
    // Keywords for different severity levels
    const critical_keywords = ['chest pain', 'heart attack', 'stroke', 'unconscious', 'severe bleeding', 'difficulty breathing', 'suffocating'];
    const urgent_keywords = ['high fever', 'severe pain', 'vomiting', 'broken bone', 'fracture', 'deep cut', 'burn'];
    const moderate_keywords = ['moderate fever', 'cough', 'cold', 'headache', 'stomach ache', 'diarrhea'];
    const mild_keywords = ['mild fever', 'rash', 'itch', 'minor cut', 'bruise', 'checkup'];
    
    // Check for critical
    for (const keyword of critical_keywords) {
        if (symptoms_lower.includes(keyword)) {
            return {
                category: 'critical',
                isSevere: true,
                score: 0.95,
                confidence: 0.9
            };
        }
    }
    
    // Check for urgent
    for (const keyword of urgent_keywords) {
        if (symptoms_lower.includes(keyword)) {
            return {
                category: 'urgent',
                isSevere: true,
                score: 0.85,
                confidence: 0.85
            };
        }
    }
    
    // Check for moderate
    for (const keyword of moderate_keywords) {
        if (symptoms_lower.includes(keyword)) {
            return {
                category: 'moderate',
                isSevere: false,
                score: 0.6,
                confidence: 0.8
            };
        }
    }
    
    // Check for mild
    for (const keyword of mild_keywords) {
        if (symptoms_lower.includes(keyword)) {
            return {
                category: 'mild',
                isSevere: false,
                score: 0.3,
                confidence: 0.75
            };
        }
    }
    
    // Default
    return {
        category: 'mild',
        isSevere: false,
        score: 0.3,
        confidence: 0.6
    };
}

// Get queue status
app.get('/api/queue/:hospitalId', async (req, res) => {
    try {
        const { hospitalId } = req.params;
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const queue = await Appointment.find({
            hospitalId,
            appointmentDate: { $gte: today, $lt: tomorrow },
            status: { $in: ['waiting', 'notified', 'serving'] }
        }).sort({ slotType: -1, slotNumber: 1 }); // Priority first, then by slot number
        
        const waitingCount = await Appointment.countDocuments({
            hospitalId,
            appointmentDate: { $gte: today, $lt: tomorrow },
            status: 'waiting'
        });
        
        const priorityCount = await Appointment.countDocuments({
            hospitalId,
            appointmentDate: { $gte: today, $lt: tomorrow },
            status: { $in: ['waiting', 'notified', 'serving'] },
            slotType: 'priority'
        });
        
        const completedCount = await Appointment.countDocuments({
            hospitalId,
            appointmentDate: { $gte: today, $lt: tomorrow },
            status: 'completed'
        });
        
        // Calculate estimated wait times
        const hospital = await Hospital.findById(hospitalId);
        const slotDuration = hospital ? hospital.slotDuration : 5;
        
        const priorityWait = priorityCount * slotDuration;
        const normalWait = (waitingCount - priorityCount) * slotDuration;
        
        res.json({
            success: true,
            queue,
            statistics: {
                totalWaiting: queue.length,
                waitingCount,
                priorityCount,
                completedCount,
                estimatedPriorityWait: priorityWait,
                estimatedNormalWait: normalWait,
                estimatedTotalWait: waitingCount * slotDuration
            }
        });
        
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get patient status by token
app.get('/api/patient/:token', async (req, res) => {
    try {
        const appointment = await Appointment.findOne({ tokenNumber: req.params.token })
            .populate('hospitalId')
            .populate('doctorId');
        
        if (!appointment) {
            return res.status(404).json({ success: false, error: "Patient not found" });
        }
        
        // Calculate queue position
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const patientsAhead = await Appointment.countDocuments({
            hospitalId: appointment.hospitalId._id,
            appointmentDate: { $gte: today },
            slotType: appointment.slotType,
            slotNumber: { $lt: appointment.slotNumber },
            status: { $in: ['waiting', 'notified', 'serving'] }
        });
        
        const estimatedStart = calculateEstimatedStartTime(
            patientsAhead,
            appointment.hospitalId.slotDuration,
            new Date()
        );
        
        res.json({
            success: true,
            patient: {
                token: appointment.tokenNumber,
                name: appointment.patientName,
                hospital: appointment.hospitalId.name,
                doctor: appointment.doctorId?.name,
                appointmentDate: appointment.appointmentDate,
                slotType: appointment.slotType,
                slotNumber: appointment.slotNumber,
                status: appointment.status,
                queuePosition: patientsAhead + 1,
                patientsAhead,
                estimatedStartTime: estimatedStart.startTimeFormatted,
                estimatedMinutes: estimatedStart.estimatedMinutes
            },
            travelInfo: appointment.travelInfo
        });
        
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Cancel appointment
app.put('/api/appointments/:token/cancel', async (req, res) => {
    try {
        const appointment = await Appointment.findOne({ tokenNumber: req.params.token });
        
        if (!appointment) {
            return res.status(404).json({ success: false, error: "Appointment not found" });
        }
        
        if (appointment.status === 'completed' || appointment.status === 'serving') {
            return res.status(400).json({ 
                success: false, 
                error: "Cannot cancel appointment that is already in progress or completed" 
            });
        }
        
        appointment.status = 'cancelled';
        await appointment.save();
        
        res.json({ success: true, message: "Appointment cancelled successfully" });
        
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== ESP32 PATIENT DEVICE ROUTES ====================

// Register patient device
app.post('/api/devices/register', async (req, res) => {
    try {
        const { patientToken, patientName, deviceName } = req.body;
        
        if (!patientToken || !patientName) {
            return res.status(400).json({ 
                success: false, 
                error: "Patient token and name required" 
            });
        }
        
        // Check if patient exists
        const appointment = await Appointment.findOne({ tokenNumber: patientToken });
        if (!appointment) {
            return res.status(404).json({ success: false, error: "Patient not found" });
        }
        
        // Check if device already registered
        const existingDevice = await PatientDevice.findOne({ patientToken });
        if (existingDevice) {
            return res.json({
                success: true,
                deviceId: existingDevice.deviceId,
                apiKey: existingDevice.apiKey,
                message: "Device already registered"
            });
        }
        
        // Generate device ID and API key
        const deviceId = 'DEV-' + crypto.randomBytes(4).toString('hex').toUpperCase();
        const apiKey = generateApiKey();
        
        // Create device
        const device = new PatientDevice({
            deviceId,
            patientToken,
            patientName,
            apiKey,
            firmwareVersion: '1.0.0'
        });
        
        await device.save();
        
        res.status(201).json({
            success: true,
            deviceId,
            apiKey,
            message: "Device registered successfully"
        });
        
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update patient location
app.post('/api/devices/location', authenticateESP32, async (req, res) => {
    try {
        const { lat, lng, speed } = req.body;
        
        if (!lat || !lng) {
            return res.status(400).json({ success: false, error: "Latitude and longitude required" });
        }
        
        // Update device location
        req.device.currentLocation = {
            lat,
            lng,
            speed: speed || 0,
            timestamp: new Date()
        };
        req.device.lastSeen = new Date();
        await req.device.save();
        
        // Get patient's appointment
        const appointment = await Appointment.findOne({ 
            tokenNumber: req.device.patientToken,
            status: { $in: ['waiting', 'notified'] }
        }).populate('hospitalId');
        
        if (appointment && appointment.hospitalId) {
            // Calculate distance to hospital
            const distance = calculateDistance(
                lat, lng,
                appointment.hospitalId.coordinates.lat,
                appointment.hospitalId.coordinates.lng
            );
            
            const travelInfo = calculateTravelTime(distance, appointment.isSeverity);
            
            // Calculate queue position
            const patientsAhead = await Appointment.countDocuments({
                hospitalId: appointment.hospitalId._id,
                slotType: appointment.slotType,
                slotNumber: { $lt: appointment.slotNumber },
                status: { $in: ['waiting', 'notified', 'serving'] }
            });
            
            const estimatedStart = calculateEstimatedStartTime(
                patientsAhead,
                appointment.hospitalId.slotDuration,
                new Date()
            );
            
            // Calculate recommended departure
            const recommendedDeparture = new Date(estimatedStart.startTime.getTime() - travelInfo.minutes * 60000);
            
            res.json({
                success: true,
                distance: travelInfo.distance,
                travelTime: travelInfo.minutes,
                queuePosition: patientsAhead + 1,
                estimatedStartTime: estimatedStart.startTimeFormatted,
                recommendedDeparture: recommendedDeparture.toLocaleTimeString('en-IN', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true
                }),
                isPeakHour: travelInfo.isPeakHour
            });
        } else {
            res.json({ success: true, message: "Location updated" });
        }
        
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Send health reading
app.post('/api/devices/health', authenticateESP32, async (req, res) => {
    try {
        const { heartRate, spo2, temperature } = req.body;
        
        // Check for abnormal readings
        const isAbnormal = (
            (heartRate && (heartRate < 50 || heartRate > 120)) ||
            (spo2 && spo2 < 92) ||
            (temperature && temperature > 38)
        );
        
        // Add reading to device
        const reading = {
            heartRate,
            spo2,
            temperature,
            timestamp: new Date(),
            isAbnormal
        };
        
        req.device.healthReadings.push(reading);
        
        // Keep only last 100 readings
        if (req.device.healthReadings.length > 100) {
            req.device.healthReadings = req.device.healthReadings.slice(-100);
        }
        
        await req.device.save();
        
        // Create emergency alert if abnormal
        if (isAbnormal) {
            let reason = '';
            if (heartRate && (heartRate < 50 || heartRate > 120)) reason = 'Abnormal heart rate';
            else if (spo2 && spo2 < 92) reason = 'Low SpO2';
            else if (temperature && temperature > 38) reason = 'High temperature';
            
            await createEmergencyAlert(req.device, 'health_abnormal', reason, { heartRate, spo2, temperature });
        }
        
        res.json({
            success: true,
            isAbnormal,
            message: isAbnormal ? 'Abnormal reading detected' : 'Reading recorded'
        });
        
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Emergency alert
app.post('/api/devices/emergency', authenticateESP32, async (req, res) => {
    try {
        const { fingerprintId, location } = req.body;
        
        // In production, verify fingerprint
        // For demo, accept any
        
        const alert = await createEmergencyAlert(
            req.device,
            'emergency_button',
            'Emergency button pressed',
            null,
            location
        );
        
        res.json({
            success: true,
            alertId: alert.alertId,
            message: "Emergency alert sent"
        });
        
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Helper function to create emergency alert
async function createEmergencyAlert(device, type, reason, healthData, location) {
    // Get patient's appointment
    const appointment = await Appointment.findOne({ tokenNumber: device.patientToken })
        .populate('hospitalId');
    
    const alertId = 'EMG-' + crypto.randomBytes(4).toString('hex').toUpperCase();
    
    const alert = new EmergencyAlert({
        alertId,
        deviceId: device.deviceId,
        patientToken: device.patientToken,
        patientName: device.patientName,
        mobileNumber: appointment?.mobileNumber,
        type,
        location: location || device.currentLocation,
        healthData,
        status: 'active',
        priority: 'critical',
        hospitalId: appointment?.hospitalId?._id
    });
    
    await alert.save();
    
    // Update device emergency mode
    device.emergencyMode = true;
    device.lastEmergency = new Date();
    await device.save();
    
    // Send SMS to hospital
    if (appointment?.hospitalId?.emergencyContact) {
        try {
            await sendSms(
                appointment.hospitalId.emergencyContact,
                `EMERGENCY: Patient ${device.patientName} (${device.patientToken}) requires immediate assistance. Type: ${type}`
            );
        } catch (err) {
            console.error('Failed to send emergency SMS:', err);
        }
    }
    
    return alert;
}

// ==================== ESP32 DISPLAY ROUTES ====================

// Register display device
app.post('/api/displays/register', requireAuth, async (req, res) => {
    try {
        const { name, location, hospitalId, displayMode } = req.body;
        
        if (!name) {
            return res.status(400).json({ success: false, error: "Device name required" });
        }
        
        const deviceId = 'DISP-' + crypto.randomBytes(4).toString('hex').toUpperCase();
        const apiKey = generateApiKey();
        
        const display = new Esp32Display({
            deviceId,
            name,
            location,
            hospitalId,
            apiKey,
            displayMode: displayMode || 'queue'
        });
        
        await display.save();
        
        res.status(201).json({
            success: true,
            deviceId,
            apiKey,
            message: "Display registered successfully"
        });
        
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get display data
app.get('/api/displays/data', authenticateESP32, async (req, res) => {
    try {
        const device = req.device;
        
        const now = new Date();
        const today = new Date(now.setHours(0, 0, 0, 0));
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        let queue = [];
        let hospital = null;
        
        if (device.hospitalId) {
            hospital = await Hospital.findById(device.hospitalId);
            
            queue = await Appointment.find({
                hospitalId: device.hospitalId,
                appointmentDate: { $gte: today, $lt: tomorrow },
                status: { $in: ['waiting', 'notified', 'serving'] }
            })
            .sort({ slotType: -1, slotNumber: 1 })
            .limit(10)
            .populate('doctorId');
        }
        
        const statistics = {
            totalWaiting: queue.length,
            priorityCount: queue.filter(q => q.slotType === 'priority').length,
            normalCount: queue.filter(q => q.slotType === 'normal').length
        };
        
        // Format queue for display
        const formattedQueue = queue.map((q, index) => ({
            position: index + 1,
            token: q.tokenNumber,
            name: q.patientName.substring(0, 15),
            isPriority: q.slotType === 'priority',
            doctor: q.doctorId?.name || 'Pending',
            estimatedTime: calculateEstimatedStartTime(index, hospital?.slotDuration || 5, now).startTimeFormatted
        }));
        
        res.json({
            success: true,
            deviceId: device.deviceId,
            timestamp: now,
            refreshInterval: device.refreshInterval || 10,
            hospital: hospital ? {
                name: hospital.name,
                address: hospital.address
            } : null,
            statistics,
            queue: formattedQueue,
            currentTime: now.toLocaleTimeString('en-IN'),
            currentDate: now.toLocaleDateString('en-IN'),
            display: device.settings
        });
        
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update display settings
app.put('/api/displays/settings', authenticateESP32, async (req, res) => {
    try {
        const { brightness, contrast, rotation, showTime, showDate, showEstimatedTime, customMessage } = req.body;
        
        req.device.settings = {
            ...req.device.settings,
            brightness: brightness || req.device.settings.brightness,
            contrast: contrast || req.device.settings.contrast,
            rotation: rotation || req.device.settings.rotation,
            showTime: showTime !== undefined ? showTime : req.device.settings.showTime,
            showDate: showDate !== undefined ? showDate : req.device.settings.showDate,
            showEstimatedTime: showEstimatedTime !== undefined ? showEstimatedTime : req.device.settings.showEstimatedTime,
            customMessage: customMessage || req.device.settings.customMessage
        };
        
        await req.device.save();
        
        res.json({
            success: true,
            message: "Settings updated",
            settings: req.device.settings
        });
        
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== ADMIN ROUTES ====================

// Admin login
app.post('/api/admin/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        const user = await User.findOne({ username, isActive: true });
        if (!user) {
            return res.status(401).json({ success: false, error: "Invalid credentials" });
        }
        
        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
            return res.status(401).json({ success: false, error: "Invalid credentials" });
        }
        
        const sessionToken = generateSessionToken();
        
        await Session.create({
            sessionToken,
            userId: user._id,
            username: user.username
        });
        
        user.lastLogin = new Date();
        await user.save();
        
        res.json({
            success: true,
            sessionToken,
            user: {
                id: user._id,
                username: user.username,
                name: user.name,
                role: user.role
            }
        });
        
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Admin logout
app.post('/api/admin/logout', requireAuth, async (req, res) => {
    try {
        const sessionToken = req.headers['x-session-token'];
        await Session.deleteOne({ sessionToken });
        
        res.json({ success: true, message: "Logged out successfully" });
        
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get dashboard stats
app.get('/api/admin/dashboard', requireAuth, async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const [
            totalHospitals,
            totalDoctors,
            todayAppointments,
            waitingCount,
            completedCount,
            emergencyAlerts,
            activeDevices
        ] = await Promise.all([
            Hospital.countDocuments({ isActive: true }),
            Doctor.countDocuments({ isActive: true }),
            Appointment.countDocuments({
                appointmentDate: { $gte: today, $lt: tomorrow }
            }),
            Appointment.countDocuments({
                appointmentDate: { $gte: today, $lt: tomorrow },
                status: { $in: ['waiting', 'notified'] }
            }),
            Appointment.countDocuments({
                appointmentDate: { $gte: today, $lt: tomorrow },
                status: 'completed'
            }),
            EmergencyAlert.countDocuments({ status: 'active' }),
            PatientDevice.countDocuments({ 
                isActive: true,
                lastSeen: { $gte: new Date(Date.now() - 300000) } // Last 5 minutes
            })
        ]);
        
        res.json({
            success: true,
            stats: {
                totalHospitals,
                totalDoctors,
                todayAppointments,
                waitingCount,
                completedCount,
                emergencyAlerts,
                activeDevices
            }
        });
        
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Call next patient
app.post('/api/admin/next-patient/:hospitalId', requireAuth, async (req, res) => {
    try {
        const { hospitalId } = req.params;
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Find current serving patient
        const currentServing = await Appointment.findOne({
            hospitalId,
            appointmentDate: { $gte: today },
            status: 'serving'
        });
        
        if (currentServing) {
            currentServing.status = 'completed';
            currentServing.actualEndTime = new Date();
            await currentServing.save();
        }
        
        // Find next patient
        const nextPatient = await Appointment.findOne({
            hospitalId,
            appointmentDate: { $gte: today },
            status: { $in: ['waiting', 'notified'] }
        }).sort({ slotType: -1, slotNumber: 1 });
        
        if (!nextPatient) {
            return res.json({ 
                success: true, 
                message: "No more patients in queue" 
            });
        }
        
        nextPatient.status = 'serving';
        nextPatient.actualStartTime = new Date();
        await nextPatient.save();
        
        // Process queue for notifications
        await processQueue(hospitalId);
        
        res.json({
            success: true,
            message: "Next patient called",
            patient: {
                token: nextPatient.tokenNumber,
                name: nextPatient.patientName,
                slotType: nextPatient.slotType
            }
        });
        
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get emergency alerts
app.get('/api/admin/emergency-alerts', requireAuth, async (req, res) => {
    try {
        const alerts = await EmergencyAlert.find({ status: 'active' })
            .sort({ createdAt: -1 })
            .limit(50);
        
        res.json({ success: true, alerts });
        
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Resolve emergency alert
app.post('/api/admin/resolve-alert/:alertId', requireAuth, async (req, res) => {
    try {
        const alert = await EmergencyAlert.findOne({ alertId: req.params.alertId });
        
        if (!alert) {
            return res.status(404).json({ success: false, error: "Alert not found" });
        }
        
        alert.status = 'resolved';
        alert.resolvedAt = new Date();
        alert.acknowledgedBy = req.user.username;
        await alert.save();
        
        // Update device emergency mode
        await PatientDevice.updateOne(
            { deviceId: alert.deviceId },
            { emergencyMode: false }
        );
        
        res.json({ success: true, message: "Alert resolved" });
        
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== UTILITY FUNCTIONS ====================

// Calculate available slots
function calculateAvailableSlots(hospital) {
    const now = new Date();
    const today = new Date(now.setHours(0, 0, 0, 0));
    
    return {
        priority: hospital.prioritySlots,
        normal: hospital.normalSlots
    };
}

// Send SMS notification
async function sendSms(to, message) {
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
        console.log('SMS not configured. Would send:', message);
        return;
    }
    
    try {
        await twilioClient.messages.create({
            body: message,
            from: process.env.TWILIO_PHONE_NUMBER,
            to
        });
        console.log(`SMS sent to ${to}`);
    } catch (error) {
        console.error('Error sending SMS:', error);
    }
}

// Process queue and send notifications
async function processQueue(hospitalId) {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Get current serving patient
        const currentServing = await Appointment.findOne({
            hospitalId,
            appointmentDate: { $gte: today },
            status: 'serving'
        });
        
        if (!currentServing) return;
        
        // Find patients that are 2 positions away
        const patientsToNotify = await Appointment.find({
            hospitalId,
            appointmentDate: { $gte: today },
            status: 'waiting',
            slotNumber: { 
                $lte: currentServing.slotNumber + 2,
                $gt: currentServing.slotNumber
            }
        });
        
        for (const patient of patientsToNotify) {
            if (!patient.smsSent) {
                const message = `MediQueue Alert: Your token ${patient.tokenNumber} will be called soon. There are ${patient.slotNumber - currentServing.slotNumber} patients ahead. Please proceed to the waiting area.`;
                
                await sendSms(patient.mobileNumber, message);
                
                patient.status = 'notified';
                patient.smsSent = true;
                patient.notifiedAt = new Date();
                await patient.save();
            }
        }
        
    } catch (error) {
        console.error('Queue processing error:', error);
    }
}

// Schedule queue processing
function scheduleQueueProcessing(hospitalId) {
    // Run every 5 minutes
    schedule.scheduleJob(`*/5 * * * *`, async function() {
        await processQueue(hospitalId);
    });
}

// ==================== SERVER START ====================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`\n🚀 MediQueue Chennai Server running on port ${PORT}`);
    console.log(`📅 ${new Date().toLocaleString()}`);
    console.log(`\n📍 Chennai Hospitals: ${CHENNAI_HOSPITALS.length} configured`);
    console.log(`👨‍⚕️ Doctors: ${CHENNAI_DOCTORS.length} registered`);
    console.log(`📱 ESP32 Integration: Active`);
    console.log(`🤖 AI Symptom Analysis: Enabled`);
    console.log(`\n📋 Endpoints:`);
    console.log(`   GET  /api/health - Server status`);
    console.log(`   GET  /api/hospitals - List hospitals`);
    console.log(`   POST /api/appointments - Book appointment`);
    console.log(`   GET  /api/queue/:hospitalId - View queue`);
    console.log(`   POST /api/devices/register - Register ESP32`);
    console.log(`   POST /api/admin/login - Admin login`);
    console.log(`\n✅ Server ready!`);
});

module.exports = app;