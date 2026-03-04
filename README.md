# Mediqueue
# MediQueue - IoT Healthcare Queue Management System

## 📋 Project Overview

MediQueue is a comprehensive IoT-based healthcare queue management system that integrates ESP32 devices with a web-based platform. The system allows patients to book appointments online, receive real-time queue updates on their ESP32 device, and trigger emergency alerts with fingerprint authentication and fall detection.

## 🏥 Features

### Web Application
- **Patient Interface**: Book appointments with AI-powered symptom analysis
- **Admin Dashboard**: Real-time queue management, ESP32 device monitoring, emergency alerts
- **Hospital Network**: 8 major Chennai hospitals with 5-minute slot system
- **AI Symptom Analysis**: Natural language processing for severity classification

### ESP32 Patient Device
- **OLED Display**: Shows queue position, hospital name, estimated time
- **Fingerprint Authentication**: R307 sensor for secure emergency alerts
- **Fall Detection**: MPU6050 accelerometer/gyroscope for automatic fall alerts
- **Emergency Button**: Physical button with fingerprint verification
- **WiFi Connectivity**: Real-time communication with server
- **Auto-cleanup**: Automatically clears patient data when appointment completes


## 📦 Software Requirements

### Arduino Libraries
Install these libraries via Arduino Library Manager (Sketch → Include Library → Manage Libraries):

```cpp
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <HardwareSerial.h>
#include <Adafruit_Fingerprint.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <MPU6050_light.h>
```

### Node.js Dependencies
```json
{
  "dependencies": {
    "express": "^4.18.2",
    "body-parser": "^1.20.2",
    "bcryptjs": "^2.4.3",
    "crypto": "^1.0.1",
    "fs": "^0.0.1-security",
    "path": "^0.12.7"
  }
}
```

## 🚀 Installation & Setup

### 1. Server Setup

```bash
# Clone or create project directory
cd C:\Users\Krishna Karthik\Documents\cloud project basics

# Install Node.js dependencies
npm install express body-parser bcryptjs

# Start the server
node server.js
```

Server will run at: `http://localhost:3001`

### 2. ESP32 Setup

1. Open Arduino IDE
2. Select board: **ESP32 Dev Module**
3. Select port: **COM5** (or your ESP32 port)
4. Install required libraries (see Software Requirements)
5. Update WiFi credentials in the code:
```cpp
const char* ssid = "xyzpq";
const char* password = "rgergefewf";
const char* serverUrl = "http://10.101.40.39:3001";
```
6. Upload the code to ESP32

### 3. Web Interfaces

- **Patient Interface**: `http://10.101.40.39:3001`
- **Admin Panel**: `http://10.101.40.39:3001/admin`
- **Admin Login**: username: `admin`, password: `xyzqr`

## 📱 Usage Guide

### For Patients

1. **Book Appointment** on the website
2. Note down your token (e.g., `S-7-001`)
3. On ESP32 Serial Monitor, type: `register S-7-001`
4. Follow OLED prompts to enroll fingerprint
5. View queue position and estimated time on OLED
6. Press emergency button + fingerprint for emergencies

### For Administrators

1. Login to Admin Panel
2. Monitor queue in **Queue Management** tab
3. View connected ESP32 devices in **ESP32 Devices** tab
4. Handle emergency alerts in **Emergency Alerts** tab
5. View fall detections in **Fall Detections** tab
6. Mark patients as completed when done

### ESP32 Commands

| Command | Function |
|---------|----------|
| `register TOKEN` | Register patient with token |
| `status` | Show device status |
| `m` | Toggle display mode (patient info/angles) |
| `clear` | Manually clear patient data |
| `wifi` | Reconnect to WiFi |
| `restart` | Restart ESP32 |

## 📁 Project Structure

```
cloud project basics/
├── server.js                 # Main Node.js server
├── queue-management-system.html  # Patient interface
├── admin-panel.html          # Admin dashboard
├── login.html                # Admin login page
├── data.json                 # Queue data storage
├── users.json                # User credentials
├── hospitals.json            # Chennai hospitals data
├── doctors.json              # Doctors data
├── patient-devices.json      # ESP32 device registry
├── emergency-alerts.json     # Emergency alerts storage
├── esp32-devices.json        # Display devices
├── health-readings.json      # Patient health data
└── prescriptions.json        # Prescription records
```

## 🧪 Testing

### Test Sequence

1. **Start Server**: `node server.js`
2. **Book Appointment** on patient interface
3. **Register Patient** on ESP32: `register S-7-001`
4. **Enroll Fingerprint** following OLED prompts
5. **Verify Queue** on OLED and admin panel
6. **Test Emergency Button** with enrolled finger
7. **Test Fall Detection** by gently dropping device
8. **Complete Appointment** in admin panel
9. **Verify Auto-cleanup** on ESP32

## ⚠️ Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| WiFi not connecting | Check SSID/password, ensure 2.4GHz network |
| Fingerprint not enrolling | Check R307 wiring, clean sensor |
| No OLED display | Check I2C address (0x3C), wiring |
| MPU6050 not responding | Check I2C connections, address (0x68) |
| 404 errors | Ensure server is running |
| Emergency alerts not appearing | Check API key in code |

### Debug Commands

```cpp
// Add to Serial Monitor for debugging
status      // Show current status
m           // Toggle display mode
clear       // Clear patient data
wifi        // Reconnect WiFi
restart     // Restart ESP32
```

## 🔐 Security Features

- **Fingerprint Authentication**: Only registered fingerprints can trigger emergencies
- **Session Management**: Admin panel requires login
- **API Keys**: Each ESP32 device gets unique API key
- **Auto-cleanup**: Fingerprints deleted after appointment completion

## 🎯 Future Enhancements

- [ ] GPS module for real-time location tracking
- [ ] MAX30100 heart rate and SpO2 monitoring
- [ ] SMS alerts via Twilio
- [ ] Mobile app for patients
- [ ] Multiple language support
- [ ] Cloud database integration
- [ ] Video consultation feature

## 📞 Support

For issues or questions:
- Check Serial Monitor for error messages
- Verify all connections
- Ensure server is running
- Check JSON files for data integrity

## 👨‍💻 Credits

Developed by Krishna Karthik as a comprehensive IoT healthcare solution integrating ESP32 with web technologies.

## 📄 License

This project is for educational purposes. All rights reserved.

---

**MediQueue - Smart Healthcare Queue Management System** 🚀
