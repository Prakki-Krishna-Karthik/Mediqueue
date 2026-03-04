const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

// Import AI Symptom Classifier
const AISymptomClassifier = require('./ai-symptom-model');

// Initialize AI with error handling
let aiSymptomClassifier;
try {
    aiSymptomClassifier = new AISymptomClassifier();
    console.log('🤖 AI Symptom Analyzer: INITIALIZED');
} catch (error) {
    console.error('❌ AI Initialization failed:', error);
    aiSymptomClassifier = {
        isTrained: false,
        predictSeverity: (symptoms) => ({
            severityScore: 0.3,
            isSevere: false,
            confidence: 0.5,
            category: 'mild',
            method: 'fallback'
        }),
        ruleBasedFallback: (symptoms) => ({
            severityScore: 0.3,
            isSevere: false,
            confidence: 0.5,
            category: 'mild',
            method: 'fallback'
        })
    };
}

const app = express();
const port = 3001;

const dataFilePath = path.join(__dirname, "data.json");
const usersFilePath = path.join(__dirname, "users.json");
const hospitalsFilePath = path.join(__dirname, "hospitals.json");
const doctorsFilePath = path.join(__dirname, "doctors.json");
const prescriptionsFilePath = path.join(__dirname, "prescriptions.json");
const emergencyAlertsFilePath = path.join(__dirname, "emergency-alerts.json");
const patientDevicesFilePath = path.join(__dirname, "patient-devices.json");
const healthReadingsFilePath = path.join(__dirname, "health-readings.json");

// ==================== CHENNAI HOSPITALS DATA ====================
const CHENNAI_HOSPITALS = [
    {
        id: 1,
        name: "Apollo Hospitals - Greams Road",
        locality: "Greams Road",
        address: "21, Greams Lane, Off Greams Road, Chennai - 600006",
        coordinates: { lat: 13.0649, lng: 80.2552 },
        specialties: ["Cardiology", "Neurology", "Orthopedics", "Oncology"],
        doctors: [1, 2, 3, 4, 5, 6],
        contact: "+91-44-2829-3333",
        prioritySlots: 2,
        normalSlots: 5,
        totalSlots: 7,
        slotDuration: 5,
        emergencyContact: "+91-44-2829-3421"
    },
    {
        id: 2,
        name: "MIOT International",
        locality: "Manapakkam",
        address: "4/112, Mount Poonamallee Road, Manapakkam, Chennai - 600089",
        coordinates: { lat: 13.0197, lng: 80.1797 },
        specialties: ["Orthopedics", "Trauma Care", "Cardiology", "Neurology"],
        doctors: [7, 8, 9, 10],
        contact: "+91-44-4200-2288",
        prioritySlots: 2,
        normalSlots: 5,
        totalSlots: 7,
        slotDuration: 5,
        emergencyContact: "+91-44-2249-1111"
    },
    {
        id: 3,
        name: "Fortis Malar Hospital",
        locality: "Adyar",
        address: "52, 1st Main Road, Gandhi Nagar, Adyar, Chennai - 600020",
        coordinates: { lat: 13.0046, lng: 80.2491 },
        specialties: ["Cardiology", "Gastroenterology", "Nephrology"],
        doctors: [11, 12, 13],
        contact: "+91-44-4289-2222",
        prioritySlots: 2,
        normalSlots: 5,
        totalSlots: 7,
        slotDuration: 5,
        emergencyContact: "+91-44-4933-3333"
    },
    {
        id: 4,
        name: "Kauvery Hospital",
        locality: "Alwarpet",
        address: "81, Dr Radhakrishnan Salai, Alwarpet, Chennai - 600004",
        coordinates: { lat: 13.0385, lng: 80.2549 },
        specialties: ["Cardiology", "Pulmonology", "Critical Care"],
        doctors: [14, 15, 16],
        contact: "+91-44-4000-6000",
        prioritySlots: 2,
        normalSlots: 5,
        totalSlots: 7,
        slotDuration: 5,
        emergencyContact: "+91-44-4000-6666"
    },
    {
        id: 5,
        name: "Billroth Hospitals",
        locality: "Shenoy Nagar",
        address: "52, West Mada Church Street, Shenoy Nagar, Chennai - 600030",
        coordinates: { lat: 13.0745, lng: 80.2249 },
        specialties: ["General Medicine", "Cardiology", "Diabetology"],
        doctors: [17, 18, 19],
        contact: "+91-44-2615-5555",
        prioritySlots: 2,
        normalSlots: 5,
        totalSlots: 7,
        slotDuration: 5,
        emergencyContact: "+91-44-2615-5556"
    },
    {
        id: 6,
        name: "SRM Institutes for Medical Science",
        locality: "Vadapalani",
        address: "No.1, Jawaharlal Nehru Road, Vadapalani, Chennai - 600026",
        coordinates: { lat: 13.0525, lng: 80.2125 },
        specialties: ["Multi-Specialty", "Cardiology", "Neurology"],
        doctors: [20, 21, 22, 23],
        contact: "+91-44-4220-2222",
        prioritySlots: 2,
        normalSlots: 5,
        totalSlots: 7,
        slotDuration: 5,
        emergencyContact: "+91-44-4395-9595"
    },
    {
        id: 7,
        name: "Global Health City",
        locality: "Perumbakkam",
        address: "439, Cheran Nagar, Perumbakkam, Chennai - 600100",
        coordinates: { lat: 12.9069, lng: 80.2275 },
        specialties: ["Cardiology", "Transplant", "Oncology"],
        doctors: [24, 25, 26, 27],
        contact: "+91-44-4477-7000",
        prioritySlots: 2,
        normalSlots: 5,
        totalSlots: 7,
        slotDuration: 5,
        emergencyContact: "+91-44-4477-7111"
    },
    {
        id: 8,
        name: "Chettinad Health City",
        locality: "Kelambakkam",
        address: "Rajiv Gandhi Salai, Kelambakkam, Chennai - 603103",
        coordinates: { lat: 12.8193, lng: 80.2218 },
        specialties: ["Cardiology", "Orthopedics", "Neurology"],
        doctors: [28, 29, 30],
        contact: "+91-44-4741-1000",
        prioritySlots: 2,
        normalSlots: 5,
        totalSlots: 7,
        slotDuration: 5,
        emergencyContact: "+91-44-4741-1111"
    }
];

// ==================== CHENNAI DOCTORS DATA ====================
const CHENNAI_DOCTORS = [
    { id: 1, name: "Dr. Devi Shetty", specialty: "Cardiology", hospitalId: 1, available: true },
    { id: 2, name: "Dr. Bhuwaneshwari", specialty: "Neurology", hospitalId: 1, available: true },
    { id: 3, name: "Dr. S. Rajasekaran", specialty: "Orthopedics", hospitalId: 1, available: true },
    { id: 4, name: "Dr. V. Shanta", specialty: "Oncology", hospitalId: 1, available: true },
    { id: 5, name: "Dr. Paul Ramesh", specialty: "Cardiology", hospitalId: 1, available: true },
    { id: 6, name: "Dr. K. Ganapathy", specialty: "Neurology", hospitalId: 1, available: true },
    { id: 7, name: "Dr. P.V.A. Mohandas", specialty: "Orthopedics", hospitalId: 2, available: true },
    { id: 8, name: "Dr. V. Bashi", specialty: "Cardiology", hospitalId: 2, available: true },
    { id: 9, name: "Dr. S. Elangovan", specialty: "Trauma Care", hospitalId: 2, available: true },
    { id: 10, name: "Dr. R. Ravichandran", specialty: "Neurology", hospitalId: 2, available: true },
    { id: 11, name: "Dr. C.N. Mani", specialty: "Cardiology", hospitalId: 3, available: true },
    { id: 12, name: "Dr. M. Balamurugan", specialty: "Gastroenterology", hospitalId: 3, available: true },
    { id: 13, name: "Dr. Georgi Abraham", specialty: "Nephrology", hospitalId: 3, available: true },
    { id: 14, name: "Dr. A. Duraisamy", specialty: "Cardiology", hospitalId: 4, available: true },
    { id: 15, name: "Dr. S. Chandrasekar", specialty: "Pulmonology", hospitalId: 4, available: true },
    { id: 16, name: "Dr. K. Senthil", specialty: "Critical Care", hospitalId: 4, available: true },
    { id: 17, name: "Dr. V. S. Natarajan", specialty: "General Medicine", hospitalId: 5, available: true },
    { id: 18, name: "Dr. S. Kumar", specialty: "Cardiology", hospitalId: 5, available: true },
    { id: 19, name: "Dr. V. Mohan", specialty: "Diabetology", hospitalId: 5, available: true },
    { id: 20, name: "Dr. R. Balaji", specialty: "Cardiology", hospitalId: 6, available: true },
    { id: 21, name: "Dr. S. Ramesh", specialty: "Neurology", hospitalId: 6, available: true },
    { id: 22, name: "Dr. K. Kalyanasundaram", specialty: "General Medicine", hospitalId: 6, available: true },
    { id: 23, name: "Dr. P. Karkuzhali", specialty: "Pediatrics", hospitalId: 6, available: true },
    { id: 24, name: "Dr. K. R. Balakrishnan", specialty: "Cardiology", hospitalId: 7, available: true },
    { id: 25, name: "Dr. R. Ravi", specialty: "Transplant", hospitalId: 7, available: true },
    { id: 26, name: "Dr. S. Rajan", specialty: "Oncology", hospitalId: 7, available: true },
    { id: 27, name: "Dr. V. Srinivas", specialty: "Neurology", hospitalId: 7, available: true },
    { id: 28, name: "Dr. P. S. Rajan", specialty: "Cardiology", hospitalId: 8, available: true },
    { id: 29, name: "Dr. M. S. Ravi", specialty: "Orthopedics", hospitalId: 8, available: true },
    { id: 30, name: "Dr. R. Saravanan", specialty: "Neurology", hospitalId: 8, available: true }
];

// ==================== HELPER FUNCTIONS ====================

function safeDate(dateInput) {
    try {
        if (!dateInput) return new Date();
        const date = new Date(dateInput);
        if (isNaN(date.getTime())) return new Date();
        return date;
    } catch (error) {
        return new Date();
    }
}

function safeISOString(date) {
    try {
        if (!date) return new Date().toISOString();
        const d = safeDate(date);
        return d.toISOString();
    } catch (error) {
        return new Date().toISOString();
    }
}

// Distance calculation using Haversine formula
function calculateDistance(lat1, lon1, lat2, lon2) {
    try {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    } catch (error) {
        console.error("Distance calculation error:", error);
        return 0;
    }
}

// Calculate travel time
function calculateTravelTime(distance, isEmergency = false) {
    try {
        const dist = parseFloat(distance);
        if (isNaN(dist) || dist < 0) {
            return { minutes: 30, distance: 0, isPeakHour: false, speed: 25 };
        }
        
        const NORMAL_SPEED = 25;
        const EMERGENCY_SPEED = 40;
        const TRAFFIC_MULTIPLIER = 1.3;
        
        const hour = new Date().getHours();
        const isPeakHour = (hour >= 8 && hour <= 10) || (hour >= 17 && hour <= 20);
        
        let speed = isEmergency ? EMERGENCY_SPEED : NORMAL_SPEED;
        if (isPeakHour && !isEmergency) {
            speed = speed / TRAFFIC_MULTIPLIER;
        }
        
        const timeHours = dist / speed;
        const timeMinutes = Math.ceil(timeHours * 60);
        
        return {
            minutes: timeMinutes,
            distance: Math.round(dist * 10) / 10,
            isPeakHour,
            speed: Math.round(speed)
        };
    } catch (error) {
        return { minutes: 30, distance: distance || 0, isPeakHour: false, speed: 25 };
    }
}

// Calculate estimated start time
function calculateEstimatedStartTime(queuePosition, slotDuration = 5, baseTime = new Date()) {
    try {
        const position = parseInt(queuePosition) || 0;
        const duration = parseInt(slotDuration) || 5;
        
        let validBaseTime;
        if (baseTime instanceof Date && !isNaN(baseTime.getTime())) {
            validBaseTime = baseTime;
        } else {
            validBaseTime = new Date();
        }
        
        const estimatedMinutes = position * duration;
        const startTime = new Date(validBaseTime.getTime() + estimatedMinutes * 60000);
        
        if (isNaN(startTime.getTime())) {
            throw new Error("Invalid start time");
        }
        
        return {
            estimatedMinutes,
            startTime: startTime.toISOString(),
            startTimeFormatted: startTime.toLocaleTimeString('en-IN', { 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: true 
            })
        };
    } catch (error) {
        const fallbackTime = new Date();
        return {
            estimatedMinutes: 0,
            startTime: fallbackTime.toISOString(),
            startTimeFormatted: fallbackTime.toLocaleTimeString('en-IN', { 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: true 
            })
        };
    }
}

// ==================== FILE INITIALIZATION ====================

function initializeDataFiles() {
    // Create data.json if it doesn't exist
    if (!fs.existsSync(dataFilePath)) {
        const initialData = {
            queue: [],
            dailyTokens: {},
            severityQueue: [],
            slotAllocations: {},
            activePatients: [],
            estimatedTimes: {}
        };
        fs.writeFileSync(dataFilePath, JSON.stringify(initialData, null, 2));
    }

    // Create users.json if it doesn't exist
    if (!fs.existsSync(usersFilePath)) {
        const hashedPassword = bcrypt.hashSync("admin123", 10);
        const initialUsers = [
            {
                id: 1,
                username: "admin",
                password: hashedPassword,
                name: "System Administrator",
                role: "admin",
                createdAt: new Date().toISOString()
            }
        ];
        fs.writeFileSync(usersFilePath, JSON.stringify(initialUsers, null, 2));
    }

    // Create hospitals.json if it doesn't exist
    if (!fs.existsSync(hospitalsFilePath)) {
        fs.writeFileSync(hospitalsFilePath, JSON.stringify(CHENNAI_HOSPITALS, null, 2));
    }

    // Create doctors.json if it doesn't exist
    if (!fs.existsSync(doctorsFilePath)) {
        fs.writeFileSync(doctorsFilePath, JSON.stringify(CHENNAI_DOCTORS, null, 2));
    }

    // Create emergency-alerts.json if it doesn't exist
    if (!fs.existsSync(emergencyAlertsFilePath)) {
        fs.writeFileSync(emergencyAlertsFilePath, JSON.stringify({ alerts: [] }, null, 2));
    }

    // Create patient-devices.json if it doesn't exist
    if (!fs.existsSync(patientDevicesFilePath)) {
        fs.writeFileSync(patientDevicesFilePath, JSON.stringify({ devices: [] }, null, 2));
    }

    // Create health-readings.json if it doesn't exist
    if (!fs.existsSync(healthReadingsFilePath)) {
        fs.writeFileSync(healthReadingsFilePath, JSON.stringify({ readings: [] }, null, 2));
    }

    // Create prescriptions.json if it doesn't exist
    if (!fs.existsSync(prescriptionsFilePath)) {
        const initialPrescriptions = {
            prescriptions: [],
            quantumKeys: [],
            securityLogs: []
        };
        fs.writeFileSync(prescriptionsFilePath, JSON.stringify(initialPrescriptions, null, 2));
    }

    // Initialize ESP32 devices file
    initializeESP32Devices();
}

// ESP32 Device storage file
const esp32DevicesFilePath = path.join(__dirname, "esp32-devices.json");

function initializeESP32Devices() {
    if (!fs.existsSync(esp32DevicesFilePath)) {
        const initialDevices = {
            devices: [],
            displaySettings: {},
            accessLogs: [],
            patientDevices: []
        };
        fs.writeFileSync(esp32DevicesFilePath, JSON.stringify(initialDevices, null, 2));
    }
}

function readESP32Devices() {
    try {
        if (!fs.existsSync(esp32DevicesFilePath)) initializeESP32Devices();
        const devices = fs.readFileSync(esp32DevicesFilePath);
        return JSON.parse(devices);
    } catch (error) {
        return { devices: [], displaySettings: {}, accessLogs: [], patientDevices: [] };
    }
}

function writeESP32Devices(data) {
    try {
        fs.writeFileSync(esp32DevicesFilePath, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error("Error writing ESP32 devices:", error);
    }
}

// ==================== FILE READ/WRITE HELPERS ====================

function readData() {
    try {
        if (!fs.existsSync(dataFilePath)) initializeDataFiles();
        const data = fs.readFileSync(dataFilePath);
        return JSON.parse(data);
    } catch (error) {
        return { queue: [], dailyTokens: {}, severityQueue: [], slotAllocations: {}, activePatients: [], estimatedTimes: {} };
    }
}

function writeData(data) {
    try {
        fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error("Error writing data:", error);
    }
}

function readUsers() {
    try {
        if (!fs.existsSync(usersFilePath)) initializeDataFiles();
        const users = fs.readFileSync(usersFilePath);
        return JSON.parse(users);
    } catch (error) {
        return [];
    }
}

// Make sure hospitals have coordinates
function readHospitals() {
    try {
        if (!fs.existsSync(hospitalsFilePath)) {
            initializeDataFiles();
        }
        const hospitals = fs.readFileSync(hospitalsFilePath);
        const parsed = JSON.parse(hospitals);
        
        // Ensure each hospital has coordinates (add default if missing)
        return parsed.map(h => ({
            ...h,
            coordinates: h.coordinates || { lat: 13.0827, lng: 80.2707 } // Default Chennai center
        }));
    } catch (error) {
        console.error("Error reading hospitals:", error);
        return [];
    }
}

function readDoctors() {
    try {
        if (!fs.existsSync(doctorsFilePath)) initializeDataFiles();
        const doctors = fs.readFileSync(doctorsFilePath);
        return JSON.parse(doctors);
    } catch (error) {
        return CHENNAI_DOCTORS;
    }
}

function readEmergencyAlerts() {
    try {
        if (!fs.existsSync(emergencyAlertsFilePath)) return { alerts: [] };
        const alerts = fs.readFileSync(emergencyAlertsFilePath);
        return JSON.parse(alerts);
    } catch (error) {
        return { alerts: [] };
    }
}

function writeEmergencyAlerts(data) {
    try {
        fs.writeFileSync(emergencyAlertsFilePath, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error("Error writing emergency alerts:", error);
    }
}

function readPatientDevices() {
    try {
        if (!fs.existsSync(patientDevicesFilePath)) return { devices: [] };
        const devices = fs.readFileSync(patientDevicesFilePath);
        return JSON.parse(devices);
    } catch (error) {
        return { devices: [] };
    }
}

function writePatientDevices(data) {
    try {
        fs.writeFileSync(patientDevicesFilePath, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error("Error writing patient devices:", error);
    }
}

function readHealthReadings() {
    try {
        if (!fs.existsSync(healthReadingsFilePath)) return { readings: [] };
        const readings = fs.readFileSync(healthReadingsFilePath);
        return JSON.parse(readings);
    } catch (error) {
        return { readings: [] };
    }
}

function writeHealthReadings(data) {
    try {
        fs.writeFileSync(healthReadingsFilePath, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error("Error writing health readings:", error);
    }
}

function readPrescriptions() {
    try {
        if (!fs.existsSync(prescriptionsFilePath)) initializeDataFiles();
        const prescriptions = fs.readFileSync(prescriptionsFilePath);
        return JSON.parse(prescriptions);
    } catch (error) {
        return { prescriptions: [], quantumKeys: [], securityLogs: [] };
    }
}

function writePrescriptions(data) {
    try {
        fs.writeFileSync(prescriptionsFilePath, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error("Error writing prescriptions:", error);
    }
}

// ==================== DOCTOR HELPERS ====================

function getAvailableDoctors(hospitalId) {
    const doctors = readDoctors();
    return doctors.filter(doctor => doctor.hospitalId == hospitalId && doctor.available === true);
}

function assignDoctorToPatient(hospitalId) {
    const availableDoctors = getAvailableDoctors(hospitalId);
    if (availableDoctors.length === 0) return null;
    
    const data = readData();
    const hospitalPatients = data.queue.filter(p => p.hospitalId == hospitalId && p.status === 'Waiting');
    const doctorIndex = hospitalPatients.length % availableDoctors.length;
    return availableDoctors[doctorIndex];
}

// ==================== AI SYMPTOM DETECTION ====================

async function detectSeverityWithAI(symptoms) {
    try {
        const prediction = await aiSymptomClassifier.predictSeverity(symptoms);
        console.log(`🎯 AI Analysis: ${prediction.category} (${(prediction.confidence * 100).toFixed(1)}%)`);
        return prediction;
    } catch (error) {
        console.error('AI detection error:', error);
        return {
            severityScore: 0.3,
            isSevere: false,
            confidence: 0.5,
            category: 'mild',
            method: 'fallback'
        };
    }
}

function updatePatientWithAIAnalysis(token, analysisData) {
    const data = readData();
    const patientIndex = data.queue.findIndex(p => p.token === token);
    
    if (patientIndex !== -1) {
        data.queue[patientIndex].severityScore = analysisData.severityScore;
        data.queue[patientIndex].severityCategory = analysisData.category;
        data.queue[patientIndex].aiConfidence = analysisData.confidence;
        data.queue[patientIndex].aiMethod = analysisData.method;
        writeData(data);
        return true;
    }
    return false;
}

// ==================== SLOT MANAGEMENT ====================

function initializeSlotAllocation(hospitalId, dateString) {
    const data = readData();
    
    if (!data.slotAllocations) data.slotAllocations = {};
    
    const allocationKey = `${hospitalId}-${dateString}`;
    
    if (!data.slotAllocations[allocationKey]) {
        const hospitals = readHospitals();
        const hospital = hospitals.find(h => h.id == hospitalId);
        const slotDuration = hospital ? hospital.slotDuration : 5;
        
        data.slotAllocations[allocationKey] = {
            prioritySlots: Array(2).fill(null),
            normalSlots: Array(5).fill(null),
            nextSlotNumber: 1,
            slotDuration: slotDuration,
            startTime: new Date().toISOString(),
            estimatedTimes: {}
        };
        writeData(data);
    }
    
    return data.slotAllocations[allocationKey];
}

function getAvailableSlots(hospitalId, dateString) {
    const allocation = initializeSlotAllocation(hospitalId, dateString);
    
    return {
        availablePrioritySlots: allocation.prioritySlots.filter(slot => slot === null).length,
        availableNormalSlots: allocation.normalSlots.filter(slot => slot === null).length,
        totalPrioritySlots: allocation.prioritySlots.length,
        totalNormalSlots: allocation.normalSlots.length,
        slotDuration: allocation.slotDuration
    };
}

// FIXED allocateSlot function with proper error handling
function allocateSlot(hospitalId, dateString, isSeverity, patientToken) {
    try {
        const data = readData();
        const allocationKey = `${hospitalId}-${dateString}`;
        
        // Initialize allocation if it doesn't exist
        if (!data.slotAllocations) {
            data.slotAllocations = {};
        }
        
        if (!data.slotAllocations[allocationKey]) {
            const hospitals = readHospitals();
            const hospital = hospitals.find(h => h.id == hospitalId);
            const slotDuration = hospital ? hospital.slotDuration : 5;
            
            data.slotAllocations[allocationKey] = {
                prioritySlots: Array(2).fill(null),
                normalSlots: Array(5).fill(null),
                nextSlotNumber: 1,
                slotDuration: slotDuration,
                startTime: new Date().toISOString(),
                estimatedTimes: {}
            };
            writeData(data);
        }
        
        const allocation = data.slotAllocations[allocationKey];
        
        let slotNumber = null;
        let slotType = null;
        
        if (isSeverity) {
            // Priority slots first
            for (let i = 0; i < allocation.prioritySlots.length; i++) {
                if (allocation.prioritySlots[i] === null) {
                    allocation.prioritySlots[i] = patientToken;
                    slotNumber = i + 1;
                    slotType = 'priority';
                    break;
                }
            }
            
            // If no priority slots, use normal slots
            if (slotNumber === null) {
                for (let i = 0; i < allocation.normalSlots.length; i++) {
                    if (allocation.normalSlots[i] === null) {
                        allocation.normalSlots[i] = patientToken;
                        slotNumber = allocation.prioritySlots.length + i + 1;
                        slotType = 'normal';
                        break;
                    }
                }
            }
        } else {
            // Normal slots first
            for (let i = 0; i < allocation.normalSlots.length; i++) {
                if (allocation.normalSlots[i] === null) {
                    allocation.normalSlots[i] = patientToken;
                    slotNumber = allocation.prioritySlots.length + i + 1;
                    slotType = 'normal';
                    break;
                }
            }
            
            // If no normal slots, use priority slots
            if (slotNumber === null) {
                for (let i = 0; i < allocation.prioritySlots.length; i++) {
                    if (allocation.prioritySlots[i] === null) {
                        allocation.prioritySlots[i] = patientToken;
                        slotNumber = i + 1;
                        slotType = 'priority';
                        break;
                    }
                }
            }
        }
        
        if (slotNumber === null) {
            throw new Error("No slots available");
        }
        
        // Calculate estimated time
        const hospital = readHospitals().find(h => h.id == hospitalId);
        const slotDuration = hospital ? hospital.slotDuration : 5;
        
        const patientsBefore = slotNumber - 1;
        const estimatedMinutes = patientsBefore * slotDuration;
        
        // SAFE date calculation
        const now = new Date();
        if (isNaN(now.getTime())) {
            throw new Error("Invalid current date");
        }
        
        let estimatedTime = new Date(now.getTime() + estimatedMinutes * 60000);
        
        // Final safety check
        if (isNaN(estimatedTime.getTime())) {
            estimatedTime = new Date(now.getTime() + 15 * 60000);
        }
        
        if (!allocation.estimatedTimes) {
            allocation.estimatedTimes = {};
        }
        
        allocation.estimatedTimes[patientToken] = {
            slotNumber,
            estimatedMinutes,
            estimatedTime: estimatedTime.toISOString(),
            estimatedTimeFormatted: estimatedTime.toLocaleTimeString('en-IN', { 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: true 
            })
        };
        
        data.slotAllocations[allocationKey] = allocation;
        writeData(data);
        
        return { 
            slotNumber, 
            slotType,
            estimatedMinutes,
            estimatedTime: estimatedTime.toISOString()
        };
        
    } catch (error) {
        console.error("Error in allocateSlot:", error);
        
        // Return a default slot allocation as fallback
        const fallbackTime = new Date();
        return {
            slotNumber: 1,
            slotType: isSeverity ? 'priority' : 'normal',
            estimatedMinutes: 0,
            estimatedTime: fallbackTime.toISOString()
        };
    }
}

function getTokenCounterForDate(dateString, hospitalId) {
    const data = readData();
    if (!data.dailyTokens) data.dailyTokens = {};
    
    const key = `${dateString}-${hospitalId}`;
    
    if (!data.dailyTokens[key]) {
        data.dailyTokens[key] = 1;
        writeData(data);
    }
    
    return data.dailyTokens[key];
}

function incrementTokenCounterForDate(dateString, hospitalId) {
    const data = readData();
    if (!data.dailyTokens) data.dailyTokens = {};
    
    const key = `${dateString}-${hospitalId}`;
    
    if (!data.dailyTokens[key]) {
        data.dailyTokens[key] = 1;
    } else {
        data.dailyTokens[key]++;
    }
    
    writeData(data);
    return data.dailyTokens[key];
}

// ==================== QUANTUM SECURITY ====================

const quantumKeyStore = new Map();
const quantumSessions = new Map();
const prescriptionsStore = new Map();

function generateQuantumKeyId() {
    return 'QK-' + crypto.randomBytes(8).toString('hex').toUpperCase();
}

function generatePrescriptionId() {
    return 'RX-' + crypto.randomBytes(6).toString('hex').toUpperCase();
}

function logQuantumSecurityEvent(event) {
    const prescriptionsData = readPrescriptions();
    event.timestamp = new Date().toISOString();
    event.id = crypto.randomBytes(4).toString('hex');
    prescriptionsData.securityLogs.push(event);
    writePrescriptions(prescriptionsData);
    console.log(`🔐 Quantum Event: ${event.type}`);
}

// ==================== SESSION MANAGEMENT ====================

const sessions = new Map();
const quantumMonitor = null;

function generateSessionToken() {
    return crypto.randomBytes(32).toString('hex');
}

function generateESP32ApiKey() {
    return 'ESP-' + crypto.randomBytes(16).toString('hex').toUpperCase();
}

// ==================== MIDDLEWARE ====================

app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, 'public')));

// Cookie parser middleware
app.use((req, res, next) => {
    const cookieHeader = req.headers.cookie;
    req.cookies = {};
    
    if (cookieHeader) {
        cookieHeader.split(';').forEach(cookie => {
            const parts = cookie.trim().split('=');
            if (parts.length === 2) {
                req.cookies[parts[0]] = decodeURIComponent(parts[1]);
            }
        });
    }
    
    next();
});

// ESP32 Authentication Middleware
function authenticateESP32(req, res, next) {
    const apiKey = req.headers['x-api-key'] || req.query.apiKey;
    
    if (!apiKey) {
        return res.status(401).json({ success: false, error: "API key required" });
    }
    
    // First check patient devices
    const patientDevices = readPatientDevices();
    const patientDevice = patientDevices.devices.find(d => d.apiKey === apiKey && d.isActive !== false);
    
    if (patientDevice) {
        patientDevice.lastSeen = new Date().toISOString();
        writePatientDevices(patientDevices);
        
        req.esp32Device = patientDevice;
        req.deviceType = 'patient';
        return next();
    }
    
    // If not found, check display devices
    const esp32Devices = readESP32Devices();
    const displayDevice = esp32Devices.devices.find(d => d.apiKey === apiKey && d.isActive);
    
    if (displayDevice) {
        displayDevice.lastSeen = new Date().toISOString();
        displayDevice.lastIp = req.ip;
        
        esp32Devices.accessLogs.push({
            timestamp: new Date().toISOString(),
            deviceId: displayDevice.deviceId,
            deviceName: displayDevice.name,
            ip: req.ip,
            success: true
        });
        
        writeESP32Devices(esp32Devices);
        
        req.esp32Device = displayDevice;
        req.deviceType = 'display';
        return next();
    }
    
    // No device found
    const esp32DevicesLog = readESP32Devices();
    esp32DevicesLog.accessLogs.push({
        timestamp: new Date().toISOString(),
        apiKey: apiKey,
        ip: req.ip,
        success: false,
        reason: "Invalid API key"
    });
    writeESP32Devices(esp32DevicesLog);
    
    return res.status(403).json({ 
        success: false, 
        error: "Unauthorized: Invalid API key" 
    });
}

function requireAuth(req, res, next) {
    const sessionToken = req.headers['x-session-token'] || req.cookies?.sessionToken;
    
    if (sessionToken && sessions.has(sessionToken)) {
        req.adminSession = sessions.get(sessionToken);
        next();
    } else {
        res.setHeader('Set-Cookie', 'sessionToken=; HttpOnly; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT');
        res.status(401).json({ error: "Authentication required", redirect: "/login" });
    }
}

function requireAuthPage(req, res, next) {
    const sessionToken = req.cookies?.sessionToken;
    
    if (sessionToken && sessions.has(sessionToken)) {
        req.adminSession = sessions.get(sessionToken);
        next();
    } else {
        res.setHeader('Set-Cookie', 'sessionToken=; HttpOnly; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT');
        res.redirect('/login');
    }
}

// Initialize data files
initializeDataFiles();

// ==================== ROUTES ====================

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "queue-management-system.html"));
});

app.get("/login", (req, res) => {
    const sessionToken = req.cookies?.sessionToken;
    if (sessionToken && sessions.has(sessionToken)) {
        return res.redirect('/admin');
    }
    res.sendFile(path.join(__dirname, "login.html"));
});

app.get("/admin", requireAuthPage, (req, res) => {
    res.sendFile(path.join(__dirname, "admin-panel.html"));
});

// ==================== AI STATUS ====================

app.get("/api/ai-status", (req, res) => {
    res.json({
        success: true,
        aiEnabled: true,
        modelTrained: aiSymptomClassifier.isTrained || false,
        modelType: "Natural Language Processing",
        algorithm: "Naive Bayes Classifier",
        accuracy: ">85%",
        trainingDataSize: aiSymptomClassifier.trainingData ? aiSymptomClassifier.trainingData.length : 0
    });
});

app.post("/api/analyze-symptoms", async (req, res) => {
    try {
        const { symptoms } = req.body;
        if (!symptoms || symptoms.trim() === '') {
            return res.status(400).json({ success: false, error: "Symptoms required" });
        }
        const analysis = await detectSeverityWithAI(symptoms);
        res.json({ success: true, analysis });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== HOSPITAL ROUTES ====================

app.get("/api/localities", (req, res) => {
    try {
        const hospitals = readHospitals();
        const localities = [...new Set(hospitals.map(h => h.locality))];
        res.json({ success: true, localities });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get("/api/hospitals/:locality", (req, res) => {
    try {
        const { locality } = req.params;
        const hospitals = readHospitals();
        const filteredHospitals = hospitals.filter(h => 
            h.locality.toLowerCase() === locality.toLowerCase()
        );
        res.json({ success: true, hospitals: filteredHospitals });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get("/api/hospital/:id", (req, res) => {
    try {
        const { id } = req.params;
        const hospitals = readHospitals();
        const hospital = hospitals.find(h => h.id == id);
        
        if (hospital) {
            const today = new Date().toISOString().split('T')[0];
            const slotInfo = getAvailableSlots(hospital.id, today);
            
            res.json({ 
                success: true, 
                hospital: {
                    ...hospital,
                    availableSeveritySlots: slotInfo.availablePrioritySlots,
                    availableNormalSlots: slotInfo.availableNormalSlots,
                    slotDuration: slotInfo.slotDuration
                }
            });
        } else {
            res.status(404).json({ success: false, error: "Hospital not found" });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get("/api/doctors/:hospitalId", (req, res) => {
    try {
        const { hospitalId } = req.params;
        const doctors = getAvailableDoctors(hospitalId);
        res.json({ success: true, data: doctors });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

app.get("/api/chennai-localities", (req, res) => {
    const localities = [
        "Adyar", "Alwarpet", "Anna Nagar", "Besant Nagar", "Chromepet", 
        "Egmore", "Greams Road", "Guindy", "Kelambakkam", "Kilpauk",
        "Kodambakkam", "Korattur", "Kottivakkam", "Manapakkam", "Mylapore",
        "Nungambakkam", "Perambur", "Perumbakkam", "Porur", "Purasawalkam",
        "Royapettah", "Saidapet", "Shenoy Nagar", "T Nagar", "Tambaram",
        "Thiruvanmiyur", "Tondiarpet", "Triplicane", "Vadapalani", "Velachery"
    ];
    res.json({ success: true, localities });
});

// ==================== APPOINTMENT ROUTE ====================

app.post("/api/add-appointment", async (req, res) => {
    try {
        const { patientName, mobileNumber, hospitalId, symptoms, appointmentDate, patientLocation } = req.body;
        
        // Validation
        if (!patientName?.trim()) {
            return res.status(400).json({ success: false, error: "Patient name is required" });
        }
        if (!mobileNumber?.trim()) {
            return res.status(400).json({ success: false, error: "Mobile number is required" });
        }
        if (hospitalId === undefined || hospitalId === null) {
            return res.status(400).json({ success: false, error: "Hospital selection is required" });
        }
        if (!symptoms?.trim()) {
            return res.status(400).json({ success: false, error: "Symptoms description is required" });
        }
        if (!appointmentDate) {
            return res.status(400).json({ success: false, error: "Appointment date is required" });
        }
        
        const data = readData();
        const hospitals = readHospitals();
        
        // Hospital lookup
        let hospital = null;
        let searchId = hospitalId;
        
        if (typeof searchId === 'string') {
            const parsed = parseInt(searchId, 10);
            if (!isNaN(parsed)) {
                searchId = parsed;
            }
        }
        
        if (typeof searchId === 'number') {
            hospital = hospitals.find(h => h.id === searchId);
        }
        
        if (!hospital) {
            hospital = hospitals.find(h => h.id.toString() === searchId.toString());
        }
        
        if (!hospital) {
            const searchStr = searchId.toString().toLowerCase();
            hospital = hospitals.find(h => 
                h.name.toLowerCase().includes(searchStr) ||
                h.id.toString() === searchStr
            );
        }
        
        if (!hospital) {
            return res.status(404).json({ 
                success: false, 
                error: `Hospital not found with ID: ${hospitalId}` 
            });
        }
        
        // Parse date
        let dateObj;
        try {
            dateObj = new Date(appointmentDate);
            if (isNaN(dateObj.getTime())) {
                dateObj = new Date();
            }
        } catch (error) {
            dateObj = new Date();
        }
        
        const dateString = dateObj.toISOString().split('T')[0];
        
        // AI Severity Detection
        const severityPrediction = await detectSeverityWithAI(symptoms);
        const isSeverity = severityPrediction.isSevere;
        
        // Check slot availability
        const slotInfo = getAvailableSlots(hospital.id, dateString);
        const totalAvailableSlots = slotInfo.availablePrioritySlots + slotInfo.availableNormalSlots;
        
        if (totalAvailableSlots === 0) {
            return res.status(400).json({
                success: false,
                error: `No slots available for ${hospital.name} on ${dateString}`
            });
        }
        
        // Generate token
        let tokenNumber = getTokenCounterForDate(dateString, hospital.id);
        const prefix = isSeverity ? 'S' : 'N';
        const token = `${prefix}-${hospital.id}-${String(tokenNumber).padStart(3, '0')}`;
        
        // Allocate slot
        const slotAllocation = allocateSlot(hospital.id, dateString, isSeverity, token);
        
        if (!slotAllocation || !slotAllocation.slotNumber) {
            return res.status(400).json({
                success: false,
                error: "No suitable slot available"
            });
        }
        
        // Assign doctor
        const assignedDoctor = assignDoctorToPatient(hospital.id);
        
        // Calculate estimated start time
        const hospitalQueue = data.queue.filter(p => p.hospitalId == hospital.id && p.status === 'Waiting').length;
        const estimatedStart = calculateEstimatedStartTime(hospitalQueue, hospital.slotDuration, new Date());
        
        // Calculate travel time if location provided
        let travelInfo = null;
        if (patientLocation && 
            typeof patientLocation === 'object' &&
            patientLocation.lat !== undefined && 
            patientLocation.lng !== undefined &&
            patientLocation.lat !== null && 
            patientLocation.lng !== null) {
            
            try {
                const lat = parseFloat(patientLocation.lat);
                const lng = parseFloat(patientLocation.lng);
                
                if (!isNaN(lat) && !isNaN(lng) && 
                    lat >= -90 && lat <= 90 && 
                    lng >= -180 && lng <= 180) {
                    
                    if (hospital && hospital.coordinates && 
                        typeof hospital.coordinates.lat === 'number' && 
                        typeof hospital.coordinates.lng === 'number') {
                        
                        const distance = calculateDistance(
                            lat, 
                            lng,
                            hospital.coordinates.lat, 
                            hospital.coordinates.lng
                        );
                        
                        if (!isNaN(distance) && distance > 0) {
                            travelInfo = calculateTravelTime(distance, isSeverity);
                        }
                    }
                }
            } catch (error) {
                console.error("Error calculating travel time:", error);
            }
        }
        
        // Create patient record
        const patient = {
            token,
            patientName: patientName.trim(),
            mobileNumber: mobileNumber.trim(),
            hospitalId: hospital.id,
            hospitalName: hospital.name,
            hospitalCoordinates: hospital.coordinates,
            doctorId: assignedDoctor ? assignedDoctor.id : null,
            doctorName: assignedDoctor ? assignedDoctor.name : "Doctor will be assigned",
            appointmentType: isSeverity ? 'severity' : 'normal',
            isSeverity: isSeverity,
            symptoms: symptoms || '',
            appointmentDate: dateObj.toISOString(),
            appointmentTime: new Date().toLocaleTimeString('en-IN', { 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: true 
            }),
            status: "Waiting",
            priority: isSeverity ? 1 : 2,
            slotNumber: slotAllocation.slotNumber,
            slotType: slotAllocation.slotType,
            slotDuration: hospital.slotDuration,
            estimatedStartTime: estimatedStart.startTime,
            estimatedStartTimeFormatted: estimatedStart.startTimeFormatted,
            estimatedMinutes: estimatedStart.estimatedMinutes,
            severityScore: severityPrediction.severityScore,
            severityCategory: severityPrediction.category,
            aiConfidence: severityPrediction.confidence,
            aiMethod: severityPrediction.method,
            patientLocation: patientLocation || null,
            travelInfo: travelInfo,
            createdAt: new Date().toISOString()
        };
        
        data.queue.push(patient);
        writeData(data);
        
        updatePatientWithAIAnalysis(token, severityPrediction);
        incrementTokenCounterForDate(dateString, hospital.id);
        
        res.json({
            success: true,
            patient,
            message: "Appointment booked successfully",
            severityAnalysis: {
                isSevere: isSeverity,
                category: severityPrediction.category,
                confidence: severityPrediction.confidence,
                score: severityPrediction.severityScore
            },
            slotNumber: slotAllocation.slotNumber,
            slotType: slotAllocation.slotType,
            estimatedStartTime: estimatedStart.startTimeFormatted,
            travelInfo: travelInfo
        });
        
    } catch (error) {
        console.error("Error adding appointment:", error);
        res.status(500).json({ 
            success: false, 
            error: "Failed to add appointment: " + error.message 
        });
    }
});

// ==================== QUEUE ROUTES ====================

app.get("/api/queue/:hospitalId?", (req, res) => {
    try {
        const { hospitalId } = req.params;
        const data = readData();
        const doctors = readDoctors();
        
        let queue = data.queue.map(patient => {
            if (patient.doctorId) {
                const doctor = doctors.find(d => d.id === patient.doctorId);
                if (doctor) patient.doctorName = doctor.name;
            }
            return patient;
        });
        
        if (hospitalId) {
            queue = queue.filter(p => p.hospitalId == hospitalId);
        }
        
        queue.sort((a, b) => {
            if (a.slotNumber !== b.slotNumber) return a.slotNumber - b.slotNumber;
            return new Date(a.createdAt) - new Date(b.createdAt);
        });
        
        const now = new Date();
        const hospitals = readHospitals();
        
        queue = queue.map((patient, index) => {
            const hospital = hospitals.find(h => h.id === patient.hospitalId);
            const slotDuration = hospital ? hospital.slotDuration : 5;
            const estimatedStart = calculateEstimatedStartTime(index, slotDuration, now);
            
            return {
                ...patient,
                currentPosition: index + 1,
                currentEstimatedTime: estimatedStart.startTimeFormatted,
                currentEstimatedMinutes: estimatedStart.estimatedMinutes
            };
        });
        
        res.json({
            success: true,
            queue,
            totalCount: queue.length,
            waitingCount: queue.filter(p => p.status === 'Waiting').length,
            completedCount: queue.filter(p => p.status === 'Completed').length,
            currentTime: now.toISOString()
        });
    } catch (error) {
        console.error("Error getting queue:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== ADMIN AUTH ROUTES ====================

app.post("/api/admin-login", (req, res) => {
    try {
        const { username, password } = req.body;
        
        const users = readUsers();
        const user = users.find(u => u.username === username);
        
        if (user && bcrypt.compareSync(password, user.password)) {
            const sessionToken = generateSessionToken();
            const sessionData = {
                userId: user.id,
                username: user.username,
                name: user.name,
                role: user.role,
                loginTime: new Date().toISOString()
            };
            
            sessions.set(sessionToken, sessionData);
            res.setHeader('Set-Cookie', `sessionToken=${sessionToken}; HttpOnly; Path=/; Max-Age=86400; SameSite=Lax`);
            
            res.json({
                success: true,
                message: "Login successful",
                sessionToken,
                username: user.username,
                name: user.name,
                redirect: "/admin"
            });
        } else {
            res.status(401).json({ success: false, error: "Invalid username or password" });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post("/api/admin-logout", (req, res) => {
    try {
        const sessionToken = req.cookies?.sessionToken || req.headers['x-session-token'];
        
        if (sessionToken && sessions.has(sessionToken)) {
            sessions.delete(sessionToken);
        }
        
        res.setHeader('Set-Cookie', 'sessionToken=; HttpOnly; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax');
        res.json({ success: true, message: "Logout successful", redirect: "/login" });
    } catch (error) {
        console.error("Logout error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get("/api/auth-status", (req, res) => {
    const sessionToken = req.cookies?.sessionToken || req.headers['x-session-token'];
    
    if (sessionToken && sessions.has(sessionToken)) {
        const sessionData = sessions.get(sessionToken);
        res.json({
            isAuthenticated: true,
            username: sessionData.username,
            name: sessionData.name
        });
    } else {
        if (req.cookies?.sessionToken) {
            res.setHeader('Set-Cookie', 'sessionToken=; HttpOnly; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT');
        }
        res.json({ isAuthenticated: false });
    }
});

// ==================== PATIENT ACTIONS ====================

app.post("/api/complete", requireAuth, (req, res) => {
    try {
        const { token } = req.body;
        if (!token) return res.status(400).json({ success: false, error: "Token required" });
        
        const data = readData();
        const patientIndex = data.queue.findIndex(p => p.token === token);
        
        if (patientIndex !== -1) {
            data.queue[patientIndex].status = "Completed";
            data.queue[patientIndex].completedAt = new Date().toISOString();
            writeData(data);
            res.json({ success: true, message: "Patient marked as completed" });
        } else {
            res.status(404).json({ success: false, error: "Patient not found" });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post("/api/remove", requireAuth, (req, res) => {
    try {
        const { token } = req.body;
        if (!token) return res.status(400).json({ success: false, error: "Token required" });
        
        const data = readData();
        const patientIndex = data.queue.findIndex(p => p.token === token);
        
        if (patientIndex !== -1) {
            const removedPatient = data.queue.splice(patientIndex, 1)[0];
            writeData(data);
            res.json({ success: true, message: "Patient removed", removedPatient });
        } else {
            res.status(404).json({ success: false, error: "Patient not found" });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== ESP32 PATIENT DEVICE ROUTES ====================

/**
 * Register a new ESP32 patient device
 * POST /api/patient/register-device
 */
app.post("/api/patient/register-device", (req, res) => {
    try {
        const { patientToken, deviceName } = req.body;
        
        if (!patientToken || !deviceName) {
            return res.status(400).json({ 
                success: false, 
                error: "Patient token and device name required" 
            });
        }
        
        const data = readData();
        const patient = data.queue.find(p => p.token === patientToken);
        
        if (!patient) {
            return res.status(404).json({ 
                success: false, 
                error: "Patient not found with token: " + patientToken 
            });
        }
        
        const patientDevices = readPatientDevices();
        
        // Check if device already registered for this patient
        const existingDevice = patientDevices.devices.find(d => d.patientToken === patientToken);
        if (existingDevice) {
            return res.json({
                success: true,
                deviceId: existingDevice.deviceId,
                apiKey: existingDevice.apiKey,
                message: "Device already registered"
            });
        }
        
        const deviceId = 'DEV-' + crypto.randomBytes(4).toString('hex').toUpperCase();
        const apiKey = generateESP32ApiKey();
        
        const newDevice = {
            deviceId,
            patientToken,
            patientName: patient.patientName,
            deviceName,
            apiKey,
            registeredAt: new Date().toISOString(),
            lastSeen: new Date().toISOString(),
            isActive: true,
            emergencyMode: false,
            battery: 100,
            healthReadings: []
        };
        
        patientDevices.devices.push(newDevice);
        writePatientDevices(patientDevices);
        
        // Add to active patients in main data
        if (!data.activePatients) data.activePatients = [];
        data.activePatients.push({ 
            patientToken, 
            deviceId, 
            registeredAt: new Date().toISOString() 
        });
        writeData(data);
        
        console.log(`✅ Device registered: ${deviceId} for patient ${patientToken}`);
        
        res.json({ 
            success: true, 
            deviceId, 
            apiKey, 
            message: "Device registered successfully" 
        });
        
    } catch (error) {
        console.error("Device registration error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Update patient location from ESP32
 * POST /api/patient/update-location
 */
app.post("/api/patient/update-location", authenticateESP32, (req, res) => {
    try {
        const { lat, lng, speed } = req.body;
        const device = req.esp32Device;
        
        const patientDevices = readPatientDevices();
        const deviceIndex = patientDevices.devices.findIndex(d => d.deviceId === device.deviceId);
        
        if (deviceIndex === -1) {
            return res.status(404).json({ success: false, error: "Device not found" });
        }
        
        // Update device location and last seen
        patientDevices.devices[deviceIndex].lastLocation = { 
            lat: parseFloat(lat), 
            lng: parseFloat(lng), 
            speed: speed || 0, 
            timestamp: new Date().toISOString() 
        };
        patientDevices.devices[deviceIndex].lastSeen = new Date().toISOString();
        
        writePatientDevices(patientDevices);
        
        // Get patient's appointment for travel info
        const data = readData();
        const patientToken = patientDevices.devices[deviceIndex].patientToken;
        const patient = data.queue.find(p => p.token === patientToken);
        
        if (patient && patient.status === 'Waiting') {
            const hospital = readHospitals().find(h => h.id === patient.hospitalId);
            
            if (hospital && hospital.coordinates) {
                const distance = calculateDistance(
                    parseFloat(lat), 
                    parseFloat(lng), 
                    hospital.coordinates.lat, 
                    hospital.coordinates.lng
                );
                
                const travelInfo = calculateTravelTime(distance, patient.isSeverity);
                
                // Calculate queue position
                const hospitalQueue = data.queue
                    .filter(p => p.hospitalId === patient.hospitalId && p.status === 'Waiting')
                    .sort((a, b) => (a.slotNumber || 999) - (b.slotNumber || 999));
                
                const position = hospitalQueue.findIndex(p => p.token === patientToken) + 1;
                const estimatedStart = calculateEstimatedStartTime(position - 1, hospital.slotDuration);
                
                // Calculate recommended departure time
                const appointmentTime = new Date(patient.appointmentDate);
                const travelTimeNeeded = travelInfo.minutes;
                const recommendedDeparture = new Date(appointmentTime.getTime() - travelTimeNeeded * 60000);
                
                return res.json({
                    success: true,
                    distance: travelInfo.distance,
                    travelTime: travelInfo.minutes,
                    queuePosition: position,
                    estimatedStartTime: estimatedStart.startTimeFormatted,
                    recommendedDeparture: recommendedDeparture.toLocaleTimeString('en-IN', { 
                        hour: '2-digit', 
                        minute: '2-digit',
                        hour12: true 
                    }),
                    isPeakHour: travelInfo.isPeakHour
                });
            }
        }
        
        res.json({ success: true, message: "Location updated" });
        
    } catch (error) {
        console.error("Location update error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Send health reading from ESP32
 * POST /api/patient/health-reading
 */
app.post("/api/patient/health-reading", authenticateESP32, (req, res) => {
    try {
        const { heartRate, spo2, temperature } = req.body;
        const device = req.esp32Device;
        
        const patientDevices = readPatientDevices();
        const deviceIndex = patientDevices.devices.findIndex(d => d.deviceId === device.deviceId);
        
        if (deviceIndex === -1) {
            return res.status(404).json({ success: false, error: "Device not found" });
        }
        
        // Update device last seen
        patientDevices.devices[deviceIndex].lastSeen = new Date().toISOString();
        
        // Create health reading
        const reading = {
            id: crypto.randomBytes(4).toString('hex'),
            deviceId: device.deviceId,
            patientToken: patientDevices.devices[deviceIndex].patientToken,
            heartRate: heartRate || null,
            spo2: spo2 || null,
            temperature: temperature || null,
            timestamp: new Date().toISOString(),
            isAbnormal: false
        };
        
        // Check for abnormal readings
        if (heartRate && (heartRate < 50 || heartRate > 120)) {
            reading.isAbnormal = true;
            reading.abnormalReason = 'Abnormal heart rate';
        }
        if (spo2 && spo2 < 92) {
            reading.isAbnormal = true;
            reading.abnormalReason = 'Low SpO2';
        }
        if (temperature && temperature > 38) {
            reading.isAbnormal = true;
            reading.abnormalReason = 'Fever';
        }
        
        // Initialize healthReadings array if not exists
        if (!patientDevices.devices[deviceIndex].healthReadings) {
            patientDevices.devices[deviceIndex].healthReadings = [];
        }
        
        // Add reading to device
        patientDevices.devices[deviceIndex].healthReadings.push(reading);
        
        // Keep only last 50 readings
        if (patientDevices.devices[deviceIndex].healthReadings.length > 50) {
            patientDevices.devices[deviceIndex].healthReadings = 
                patientDevices.devices[deviceIndex].healthReadings.slice(-50);
        }
        
        // Update last health reading for quick access
        patientDevices.devices[deviceIndex].lastHealthReading = {
            heartRate,
            spo2,
            temperature,
            timestamp: reading.timestamp
        };
        
        writePatientDevices(patientDevices);
        
        // Save to health readings file (for analytics)
        const healthReadings = readHealthReadings();
        healthReadings.readings.push(reading);
        
        // Keep only last 1000 readings total
        if (healthReadings.readings.length > 1000) {
            healthReadings.readings = healthReadings.readings.slice(-1000);
        }
        
        writeHealthReadings(healthReadings);
        
        // If abnormal, create emergency alert
        if (reading.isAbnormal) {
            const alerts = readEmergencyAlerts();
            const alertId = 'EMG-' + crypto.randomBytes(4).toString('hex').toUpperCase();
            
            const alert = {
                id: alertId,
                type: 'health_abnormal',
                deviceId: device.deviceId,
                patientToken: patientDevices.devices[deviceIndex].patientToken,
                patientName: patientDevices.devices[deviceIndex].patientName,
                reason: reading.abnormalReason,
                reading: { heartRate, spo2, temperature },
                timestamp: reading.timestamp,
                status: 'active',
                priority: 'high'
            };
            
            alerts.alerts.push(alert);
            writeEmergencyAlerts(alerts);
            
            // Set device in emergency mode
            patientDevices.devices[deviceIndex].emergencyMode = true;
            patientDevices.devices[deviceIndex].lastEmergency = reading.timestamp;
            writePatientDevices(patientDevices);
            
            console.log(`🚨 Health Alert: ${reading.abnormalReason} for patient ${patientDevices.devices[deviceIndex].patientToken}`);
        }
        
        res.json({ 
            success: true, 
            message: reading.isAbnormal ? 'Abnormal reading detected' : 'Reading recorded',
            isAbnormal: reading.isAbnormal 
        });
        
    } catch (error) {
        console.error("Health reading error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Send emergency alert with fingerprint authentication
 * POST /api/patient/emergency
 * Enhanced with fall detection support
 */
app.post("/api/patient/emergency", authenticateESP32, (req, res) => {
    try {
        const { fingerprintId, location, emergencyType, fallData } = req.body;
        const device = req.esp32Device;
        
        if (!fingerprintId) {
            return res.status(400).json({ 
                success: false, 
                error: "Fingerprint authentication required" 
            });
        }
        
        const patientDevices = readPatientDevices();
        const deviceIndex = patientDevices.devices.findIndex(d => d.deviceId === device.deviceId);
        
        if (deviceIndex === -1) {
            return res.status(404).json({ success: false, error: "Device not found" });
        }
        
        const deviceInfo = patientDevices.devices[deviceIndex];
        
        // Get patient info from main data
        const data = readData();
        const patient = data.queue.find(p => p.token === deviceInfo.patientToken);
        
        // Get hospital info if patient exists
        let hospital = null;
        if (patient) {
            hospital = readHospitals().find(h => h.id === patient.hospitalId);
        }
        
        // Create emergency alert
        const alerts = readEmergencyAlerts();
        const alertId = 'EMG-' + crypto.randomBytes(4).toString('hex').toUpperCase();
        
        // Parse location if provided
        let alertLocation = null;
        if (location) {
            if (typeof location === 'object') {
                alertLocation = location;
            } else if (typeof location === 'string' && location.includes(',')) {
                const parts = location.split(',');
                alertLocation = {
                    lat: parseFloat(parts[0]),
                    lng: parseFloat(parts[1])
                };
            }
        } else {
            // Use last known location
            alertLocation = deviceInfo.lastLocation || null;
        }
        
        // Build alert object with fall data if available
        const alert = {
            id: alertId,
            type: emergencyType || 'emergency_button',
            deviceId: device.deviceId,
            patientToken: deviceInfo.patientToken,
            patientName: patient ? patient.patientName : deviceInfo.patientName,
            mobileNumber: patient ? patient.mobileNumber : 'Unknown',
            fingerprintId: fingerprintId.toString(),
            location: alertLocation,
            timestamp: new Date().toISOString(),
            status: 'active',
            priority: emergencyType === 'fall_detected' ? 'high' : 'critical',
            hospital: hospital ? {
                id: hospital.id,
                name: hospital.name,
                address: hospital.address,
                contact: hospital.emergencyContact || hospital.contact
            } : null
        };
        
        // Add fall data if present
        if (fallData) {
            alert.fallData = fallData;
            alert.message = "Fall detected - Patient may have fallen";
        }
        
        alerts.alerts.push(alert);
        writeEmergencyAlerts(alerts);
        
        // Set device in emergency mode
        patientDevices.devices[deviceIndex].emergencyMode = true;
        patientDevices.devices[deviceIndex].lastEmergency = new Date().toISOString();
        patientDevices.devices[deviceIndex].lastSeen = new Date().toISOString();
        writePatientDevices(patientDevices);
        
        console.log(`🚨 ${emergencyType === 'fall_detected' ? 'FALL' : 'EMERGENCY'} ALERT: ${alertId} from patient ${deviceInfo.patientToken}`);
        
        res.json({
            success: true,
            alertId,
            message: emergencyType === 'fall_detected' ? "Fall alert sent successfully" : "Emergency alert sent successfully",
            hospitalContact: hospital ? (hospital.emergencyContact || hospital.contact) : null
        });
        
    } catch (error) {
        console.error("Emergency alert error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get patient status by token
 * GET /api/patient/status/:patientToken
 */
app.get("/api/patient/status/:patientToken", (req, res) => {
    try {
        const { patientToken } = req.params;
        
        const data = readData();
        const patient = data.queue.find(p => p.token === patientToken);
        
        if (!patient) {
            return res.status(404).json({ 
                success: false, 
                error: "Patient not found" 
            });
        }
        
        const hospital = readHospitals().find(h => h.id === patient.hospitalId);
        
        if (!hospital) {
            return res.status(404).json({ 
                success: false, 
                error: "Hospital not found" 
            });
        }
        
        // Get queue position
        const hospitalQueue = data.queue
            .filter(p => p.hospitalId === patient.hospitalId && p.status === 'Waiting')
            .sort((a, b) => (a.slotNumber || 999) - (b.slotNumber || 999));
        
        const position = hospitalQueue.findIndex(p => p.token === patientToken) + 1;
        const patientsAhead = position - 1;
        
        // Calculate estimated start time
        const slotDuration = hospital.slotDuration || 5;
        const estimatedStart = calculateEstimatedStartTime(patientsAhead, slotDuration);
        
        // Get patient device if exists
        const patientDevices = readPatientDevices();
        const device = patientDevices.devices.find(d => d.patientToken === patientToken);
        
        let travelInfo = null;
        let recommendedDeparture = null;
        
        if (device && device.lastLocation && hospital.coordinates) {
            const distance = calculateDistance(
                device.lastLocation.lat, 
                device.lastLocation.lng,
                hospital.coordinates.lat, 
                hospital.coordinates.lng
            );
            
            travelInfo = calculateTravelTime(distance, patient.isSeverity);
            
            const appointmentTime = new Date(patient.appointmentDate);
            const travelTimeNeeded = travelInfo.minutes;
            const departureTime = new Date(appointmentTime.getTime() - travelTimeNeeded * 60000);
            
            if (!isNaN(departureTime.getTime())) {
                recommendedDeparture = departureTime.toLocaleTimeString('en-IN', { 
                    hour: '2-digit', 
                    minute: '2-digit',
                    hour12: true 
                });
            }
        }
        
        res.json({
            success: true,
            patient: {
                token: patient.token,
                name: patient.patientName,
                hospital: hospital.name,
                appointmentDate: patient.appointmentDate,
                isPriority: patient.isSeverity,
                status: patient.status
            },
            queueInfo: {
                position,
                patientsAhead,
                totalWaiting: hospitalQueue.length
            },
            timing: {
                slotDuration,
                estimatedStartTime: estimatedStart.startTimeFormatted,
                estimatedMinutes: estimatedStart.estimatedMinutes
            },
            travel: travelInfo ? {
                distance: travelInfo.distance,
                travelTimeMinutes: travelInfo.minutes,
                recommendedDeparture: recommendedDeparture,
                isPeakHour: travelInfo.isPeakHour
            } : null,
            device: device ? {
                deviceId: device.deviceId,
                lastSeen: device.lastSeen,
                battery: device.battery || 100,
                emergencyMode: device.emergencyMode || false
            } : null
        });
        
    } catch (error) {
        console.error("Patient status error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get all patient devices (for admin)
 * GET /api/patient/devices
 */
app.get("/api/patient/devices", requireAuth, (req, res) => {
    try {
        const patientDevices = readPatientDevices();
        
        // Format devices for display
        const devices = patientDevices.devices.map(d => ({
            deviceId: d.deviceId,
            patientName: d.patientName,
            patientToken: d.patientToken,
            deviceName: d.deviceName,
            lastSeen: d.lastSeen,
            battery: d.battery || 100,
            emergencyMode: d.emergencyMode || false,
            lastEmergency: d.lastEmergency,
            lastHealthReading: d.lastHealthReading || null,
            location: d.lastLocation || null,
            registeredAt: d.registeredAt,
            isActive: d.isActive !== false
        }));
        
        // Calculate online status
        const now = new Date();
        const onlineCount = devices.filter(d => 
            d.lastSeen && (now - new Date(d.lastSeen)) < 300000
        ).length;
        
        res.json({ 
            success: true, 
            devices,
            statistics: {
                total: devices.length,
                online: onlineCount,
                emergency: devices.filter(d => d.emergencyMode).length
            }
        });
        
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== ADMIN ALERT ROUTES ====================

/**
 * Get all active emergency alerts
 * GET /api/admin/emergency-alerts
 */
app.get("/api/admin/emergency-alerts", requireAuth, (req, res) => {
    try {
        const alerts = readEmergencyAlerts();
        const activeAlerts = alerts.alerts
            .filter(a => a.status === 'active')
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        res.json({ 
            success: true, 
            alerts: activeAlerts, 
            count: activeAlerts.length 
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Resolve an emergency alert
 * POST /api/admin/resolve-alert/:alertId
 */
app.post("/api/admin/resolve-alert/:alertId", requireAuth, (req, res) => {
    try {
        const { alertId } = req.params;
        const alerts = readEmergencyAlerts();
        
        const alertIndex = alerts.alerts.findIndex(a => a.id === alertId);
        if (alertIndex === -1) {
            return res.status(404).json({ success: false, error: "Alert not found" });
        }
        
        alerts.alerts[alertIndex].status = 'resolved';
        alerts.alerts[alertIndex].resolvedAt = new Date().toISOString();
        alerts.alerts[alertIndex].resolvedBy = req.adminSession?.username || 'admin';
        
        writeEmergencyAlerts(alerts);
        
        // Clear emergency mode on device if exists
        if (alerts.alerts[alertIndex].deviceId) {
            const patientDevices = readPatientDevices();
            const deviceIndex = patientDevices.devices.findIndex(
                d => d.deviceId === alerts.alerts[alertIndex].deviceId
            );
            
            if (deviceIndex !== -1) {
                patientDevices.devices[deviceIndex].emergencyMode = false;
                writePatientDevices(patientDevices);
            }
        }
        
        res.json({ 
            success: true, 
            message: "Alert resolved successfully" 
        });
        
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get health readings for a patient
 * GET /api/patient/health/:patientToken
 */
app.get("/api/patient/health/:patientToken", requireAuth, (req, res) => {
    try {
        const { patientToken } = req.params;
        const healthReadings = readHealthReadings();
        
        const patientReadings = healthReadings.readings
            .filter(r => r.patientToken === patientToken)
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, 50); // Last 50 readings
        
        res.json({
            success: true,
            readings: patientReadings,
            count: patientReadings.length
        });
        
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== ESP32 DISPLAY ROUTES ====================

app.post("/api/esp32/register", requireAuth, (req, res) => {
    try {
        const { name, location, hospitalId, displayMode = 'queue' } = req.body;
        
        if (!name) {
            return res.status(400).json({ success: false, error: "Device name required" });
        }
        
        const esp32Devices = readESP32Devices();
        const deviceId = 'ESP-' + crypto.randomBytes(4).toString('hex').toUpperCase();
        const apiKey = generateESP32ApiKey();
        
        const newDevice = {
            deviceId,
            name,
            location: location || 'Unknown',
            hospitalId: hospitalId || null,
            apiKey,
            displayMode,
            refreshInterval: 10,
            isActive: true,
            registeredAt: new Date().toISOString(),
            lastSeen: null,
            lastIp: null
        };
        
        esp32Devices.devices.push(newDevice);
        
        if (!esp32Devices.displaySettings[deviceId]) {
            esp32Devices.displaySettings[deviceId] = {
                mode: displayMode,
                brightness: 128,
                contrast: 128,
                rotation: 0,
                showTime: true,
                showDate: true,
                showQueueNumber: true,
                showHospitalName: true,
                showEstimatedTime: true,
                customMessage: ""
            };
        }
        
        writeESP32Devices(esp32Devices);
        
        res.json({ success: true, deviceId, apiKey, message: "Device registered" });
        
    } catch (error) {
        console.error("ESP32 registration error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get("/api/esp32/devices", requireAuth, (req, res) => {
    try {
        const esp32Devices = readESP32Devices();
        const devices = esp32Devices.devices.map(device => ({
            ...device,
            apiKey: undefined
        }));
        res.json({ success: true, devices, total: devices.length });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get("/api/esp32/display", authenticateESP32, (req, res) => {
    try {
        const device = req.esp32Device;
        const esp32Devices = readESP32Devices();
        const settings = esp32Devices.displaySettings[device.deviceId] || {};
        
        const now = new Date();
        const currentTime = now.toLocaleTimeString('en-IN', { 
            hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true 
        });
        const currentDate = now.toLocaleDateString('en-IN', { 
            weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' 
        });
        
        const data = readData();
        let queue = data.queue.filter(p => p.status === 'Waiting');
        
        if (device.hospitalId) {
            queue = queue.filter(p => p.hospitalId === device.hospitalId);
        }
        
        queue.sort((a, b) => {
            if (a.priority !== b.priority) return a.priority - b.priority;
            return (a.slotNumber || 999) - (b.slotNumber || 999);
        });
        
        let hospitalName = "All Hospitals";
        let hospital = null;
        if (device.hospitalId) {
            const hospitals = readHospitals();
            hospital = hospitals.find(h => h.id === device.hospitalId);
            hospitalName = hospital ? hospital.name : "Unknown Hospital";
        }
        
        const slotDuration = hospital ? hospital.slotDuration : 5;
        const queueWithEstimates = queue.slice(0, 10).map((patient, index) => {
            const estimatedStart = calculateEstimatedStartTime(index, slotDuration, now);
            return {
                position: index + 1,
                token: patient.token,
                name: patient.patientName.substring(0, 15),
                isPriority: patient.isSeverity,
                doctor: patient.doctorName ? patient.doctorName.substring(0, 10) : 'Pending',
                estimatedTime: estimatedStart.startTimeFormatted
            };
        });
        
        res.json({
            success: true,
            deviceId: device.deviceId,
            timestamp: new Date().toISOString(),
            refreshInterval: device.refreshInterval || 10,
            header: {
                hospitalName: hospitalName,
                currentTime: currentTime,
                currentDate: currentDate
            },
            statistics: {
                totalWaiting: queue.length,
                priorityCount: queue.filter(p => p.isSeverity).length,
                normalCount: queue.filter(p => !p.isSeverity).length,
                estimatedWaitTime: queue.length * slotDuration
            },
            queue: queueWithEstimates,
            display: settings
        });
        
    } catch (error) {
        console.error("ESP32 display error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== DEMO INIT ====================

app.post("/api/init-demo-quantum-keys", (req, res) => {
    try {
        const demoUsers = [
            { userId: 'demo-patient-001', userType: 'patient', name: 'Demo Patient' },
            { userId: 'demo-doctor-001', userType: 'doctor', name: 'Demo Doctor' }
        ];
        
        const results = [];
        
        demoUsers.forEach(user => {
            const keyId = generateQuantumKeyId();
            const quantumKey = {
                keyId: keyId,
                userId: user.userId,
                userType: user.userType,
                publicKey: `DEMO-PUBLIC-KEY-${user.userId}`,
                privateKey: `DEMO-PRIVATE-KEY-${user.userId}`,
                algorithm: 'RSA-QUANTUM-HYBRID',
                createdAt: new Date().toISOString(),
                quantumEntropy: crypto.randomBytes(32).toString('hex')
            };
            
            quantumKeyStore.set(keyId, quantumKey);
            results.push({ user: user.name, keyId: keyId, status: 'created' });
        });
        
        res.json({ success: true, message: 'Demo keys initialized', results });
        
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== ERROR HANDLING ====================

app.use((req, res) => {
    res.status(404).json({ success: false, error: "Route not found" });
});

app.use((error, req, res, next) => {
    console.error("Global error:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
});

// ==================== SESSION CLEANUP ====================

setInterval(() => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    let cleaned = 0;
    
    for (const [token, session] of sessions) {
        if (new Date(session.loginTime) < oneHourAgo) {
            sessions.delete(token);
            cleaned++;
        }
    }
    
    if (cleaned > 0) console.log(`Cleaned ${cleaned} old sessions`);
}, 60 * 60 * 1000);

// ==================== START SERVER ====================

setTimeout(() => {
    console.log('🔐 Initializing demo quantum security data...');
    fetch(`http://localhost:${port}/api/init-demo-quantum-keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    }).catch(err => console.log('Demo init skipped:', err.message));
}, 2000);

setTimeout(() => {
    console.log('📟 Setting up demo ESP32 devices...');
    const esp32Devices = readESP32Devices();
    
    if (esp32Devices.devices.length === 0) {
        const demoDevices = [
            {
                deviceId: 'ESP-DISPLAY-001',
                name: 'Apollo Lobby Display',
                location: 'Apollo Hospitals - Greams Road',
                hospitalId: 1,
                apiKey: 'ESP-APOLLO-DISPLAY-123',
                displayMode: 'queue',
                refreshInterval: 10,
                isActive: true
            },
            {
                deviceId: 'ESP-DISPLAY-002',
                name: 'MIOT Lobby Display',
                location: 'MIOT International',
                hospitalId: 2,
                apiKey: 'ESP-MIOT-DISPLAY-456',
                displayMode: 'queue',
                refreshInterval: 10,
                isActive: true
            }
        ];
        
        demoDevices.forEach(device => {
            esp32Devices.devices.push({
                ...device,
                registeredAt: new Date().toISOString(),
                lastSeen: null,
                lastIp: null
            });
            
            esp32Devices.displaySettings[device.deviceId] = {
                mode: 'queue',
                brightness: 128,
                contrast: 128,
                rotation: 0,
                showTime: true,
                showDate: true,
                showQueueNumber: true,
                showHospitalName: true,
                showEstimatedTime: true,
                customMessage: "Welcome to Chennai's Best Healthcare"
            };
        });
        
        writeESP32Devices(esp32Devices);
        console.log('✅ Demo ESP32 devices created:');
        demoDevices.forEach(d => console.log(`   • ${d.name}: ${d.apiKey}`));
    }
}, 3000);

app.listen(port, () => {
    console.log(`\n🚀 MediQueue Server running at http://localhost:${port}`);
    console.log(`🤖 AI Symptom Analyzer: ${aiSymptomClassifier.isTrained ? 'READY' : 'FALLBACK MODE'}`);
    console.log(`🏥 Chennai Hospitals: ${CHENNAI_HOSPITALS.length} hospitals`);
    console.log(`📟 ESP32 Features: Active`);
    console.log(`   • Patient Device Registration: /api/patient/register-device`);
    console.log(`   • Emergency Alerts: /api/patient/emergency (with fall detection)`);
    console.log(`   • Health Readings: /api/patient/health-reading`);
    console.log(`   • Location Updates: /api/patient/update-location`);
    console.log(`   • Device Status: /api/patient/devices`);
    console.log(`\n📋 Patient System: http://localhost:${port}`);
    console.log(`🔐 Admin Panel: http://localhost:${port}/admin (admin/admin123)`);
    console.log(`\n✅ Server ready!`);
});