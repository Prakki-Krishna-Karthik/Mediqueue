

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <HardwareSerial.h>
#include <Adafruit_Fingerprint.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <MPU6050_light.h>

const char* ssid = "Nadhe Net";
const char* password = "Saketh55";
const char* serverUrl = "http://10.26.181.39:3001";
#define EMERGENCY_BUTTON 4
#define BUZZER_PIN 5
#define LED_PIN 2
#define FINGERPRINT_RX 16
#define FINGERPRINT_TX 17

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);


HardwareSerial fingerSerial(2);
Adafruit_Fingerprint finger = Adafruit_Fingerprint(&fingerSerial);
MPU6050 mpu(Wire);


struct PatientData {
  String token;
  String apiKey;
  String name;
  String hospital;
  int queuePosition;
  int totalWaiting;
  String estimatedTime;
  bool isPriority;
  String status;
  int fingerprintID;
  bool registered;
};

PatientData patient;

struct MPUData {
  float angleX;
  float angleY;
  float angleZ;
  float accX;
  float accY;
  float accZ;
  float temp;
  bool fallDetected;
  unsigned long fallTime;
  bool possibleFall;
  unsigned long impactTime;
};

MPUData mpuData = {0, 0, 0, 0, 0, 0, 0, false, 0, false, 0};

bool deviceReady = true;
bool emergencyMode = false;
bool buttonPressed = false;
String lastAlertId = "";
unsigned long lastQueueUpdate = 0;
unsigned long lastDisplayUpdate = 0;
unsigned long alertDisplayTime = 0;
unsigned long lastMpuUpdate = 0;
int displayState = 0; 
bool wifiConnected = false;
String serialInput = "";
int displayMode = 0; 


bool connectToWiFi();
void checkWiFi();
bool registerPatient(String token);
bool enrollFingerprint(int id);
int verifyFingerprint();
bool deleteFingerprint(int id);
void fetchPatientStatus();
void sendEmergencyAlert(int fingerprintId, String type = "emergency_button");
void updateDisplay();
void beepBuzzer(int times, int delayMs);
void clearPatientData();
String formatTime(String timeStr);
void showMessage(const char* line1, const char* line2, const char* line3, const char* line4);
void showSplashScreen();
void processSerialCommand();
void initMPU6050();
void updateMPU6050();
void checkForFall();

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("\n\n=================================");
  Serial.println("MediQueue Patient Device");
  Serial.println("=================================");

  pinMode(EMERGENCY_BUTTON, INPUT_PULLUP);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);
  digitalWrite(LED_PIN, LOW);

  Wire.begin(21, 22);
  Wire.setClock(400000);

  bool oledOK = false;
  for(int i=0; i<3; i++) {
    if(display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
      oledOK = true;
      break;
    }
    delay(100);
  }
  
  if(oledOK) {
    Serial.println(" OLED initialized");
    showSplashScreen();
  } else {
    Serial.println(" OLED not found!");
  }

  fingerSerial.begin(57600, SERIAL_8N1, FINGERPRINT_RX, FINGERPRINT_TX);
  finger.begin(57600);
  
  if (finger.verifyPassword()) {
    Serial.println("Fingerprint sensor found");
    uint8_t count = finger.getTemplateCount();
    Serial.print("Stored fingerprints: ");
    Serial.println(count);
  } else {
    Serial.println("Fingerprint sensor not found!");
    showMessage("ERROR:", "Fingerprint", "Sensor not found", "Check wiring");
  }

  initMPU6050();

  showMessage("Connecting to", "WiFi", ssid, "Please wait...");

  wifiConnected = connectToWiFi();

  deviceReady = true;
  displayState = 0;
  updateDisplay();
  
  Serial.println("\n System ready!");
  Serial.println("Send: register TOKEN");
  Serial.println("Example: register S-7-001");
  Serial.println("Press 'm' to toggle angle display");
}

void loop() {
  unsigned long currentMillis = millis();

  if (millis() % 30000 < 10) {
    checkWiFi();
  }

  processSerialCommand();

  if (currentMillis - lastMpuUpdate > 50) {
    lastMpuUpdate = currentMillis;
    updateMPU6050();
    checkForFall();
  }

  if (!deviceReady && patient.registered) {
    if (digitalRead(EMERGENCY_BUTTON) == LOW && !buttonPressed) {
      buttonPressed = true;
      emergencyMode = true;
      displayState = 2;
      
      Serial.println("\n EMERGENCY BUTTON PRESSED");
      beepBuzzer(1, 100);
      
      int fingerprintID = verifyFingerprint();
      
      if (fingerprintID > 0 && fingerprintID == patient.fingerprintID) {
        Serial.print(" Fingerprint verified! ID: ");
        Serial.println(fingerprintID);
        displayState = 3;
        alertDisplayTime = currentMillis;
        updateDisplay();
        
        if (wifiConnected) {
          sendEmergencyAlert(fingerprintID);
        }
      } else {
        Serial.println(" Fingerprint verification failed!");
        beepBuzzer(3, 300);
        emergencyMode = false;
        displayState = 1;
      }
    }
    
    if (digitalRead(EMERGENCY_BUTTON) == HIGH) {
      buttonPressed = false;
    }
  }

  if (!deviceReady && patient.registered && wifiConnected && 
      currentMillis - lastQueueUpdate > 10000) {
    lastQueueUpdate = currentMillis;
    fetchPatientStatus();
    
    if (patient.status == "Completed") {
      Serial.println("✅ Appointment completed! Clearing data...");
      clearPatientData();
    }
  }

  if (currentMillis - lastDisplayUpdate > 200) {
    lastDisplayUpdate = currentMillis;
    updateDisplay();
  }

  if (displayState == 3 && currentMillis - alertDisplayTime > 5000) {
    displayState = 1;
    emergencyMode = false;
  }
  
  delay(10);
}



void initMPU6050() {
  Serial.println("\n Initializing MPU6050...");
  
  byte status = mpu.begin();
  if (status != 0) {
    Serial.println(" MPU6050 not found!");
    showMessage("MPU6050 ERROR", "Sensor not found", "Check wiring", "");
    mpuData.fallDetected = false;
    return;
  }
  
  Serial.println(" MPU6050 connected!");
  showMessage("MPU6050", "Calibrating...", "Keep still", "");

  mpu.calcOffsets(true, true);  
  
  Serial.println(" MPU6050 calibration complete!");
  Serial.print("Angle offsets - X:"); Serial.print(mpu.getAngleX());
  Serial.print(" Y:"); Serial.print(mpu.getAngleY());
  Serial.print(" Z:"); Serial.println(mpu.getAngleZ());
}

void updateMPU6050() {

  mpu.update();

  mpuData.angleX = mpu.getAngleX();
  mpuData.angleY = mpu.getAngleY();
  mpuData.angleZ = mpu.getAngleZ();

  mpuData.accX = mpu.getAccX();
  mpuData.accY = mpu.getAccY();
  mpuData.accZ = mpu.getAccZ();

  mpuData.temp = mpu.getTemp();
}

void checkForFall() {

  float accMagnitude = sqrt(mpuData.accX*mpuData.accX + 
                           mpuData.accY*mpuData.accY + 
                           mpuData.accZ*mpuData.accZ);
  

  if (accMagnitude > 3.2 && !mpuData.possibleFall) {
    mpuData.possibleFall = true;
    mpuData.impactTime = millis();
    Serial.print(" Impact detected! Acc: ");
    Serial.println(accMagnitude);

    digitalWrite(LED_PIN, HIGH);
    delay(100);
    digitalWrite(LED_PIN, LOW);
  }

  if (mpuData.possibleFall && millis() - mpuData.impactTime > 1500) {

    if (accMagnitude < 1.3 && 
        (abs(mpuData.angleX) > 45 || abs(mpuData.angleY) > 45)) {
      
      Serial.println(" FALL DETECTED!");
      Serial.print("Angles - X:"); Serial.print(mpuData.angleX);
      Serial.print(" Y:"); Serial.print(mpuData.angleY);
      Serial.print(" Z:"); Serial.println(mpuData.angleZ);
      
      mpuData.fallDetected = true;
      mpuData.fallTime = millis();

      if (!deviceReady && patient.registered && wifiConnected) {
        showMessage("🚨 FALL", "DETECTED!", "Sending alert...", "");
        sendEmergencyAlert(999, "fall_detected"); 
      }
    }
    mpuData.possibleFall = false;
  }

  if (mpuData.fallDetected && millis() - mpuData.fallTime > 30000) {
    mpuData.fallDetected = false;
  }
}

void processSerialCommand() {
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\n') {
      serialInput.trim();
      if (serialInput.startsWith("register ")) {
        String token = serialInput.substring(9);
        token.trim();
        Serial.print("Registering: ");
        Serial.println(token);
        registerPatient(token);
      } else if (serialInput == "clear") {
        clearPatientData();
        Serial.println("Data cleared");
      } else if (serialInput == "status") {
        Serial.print("WiFi: ");
        Serial.println(wifiConnected ? "Connected" : "Disconnected");
        Serial.print("Device ready: ");
        Serial.println(deviceReady ? "Yes" : "No");
        if (!deviceReady) {
          Serial.print("Patient: ");
          Serial.println(patient.name);
        }
        Serial.print("MPU Angles - X:"); Serial.print(mpuData.angleX);
        Serial.print(" Y:"); Serial.print(mpuData.angleY);
        Serial.print(" Z:"); Serial.println(mpuData.angleZ);
      } else if (serialInput == "restart") {
        ESP.restart();
      } else if (serialInput == "wifi") {
        wifiConnected = connectToWiFi();
      } else if (serialInput == "m") {
        displayMode = !displayMode;
        Serial.print("Display mode: ");
        Serial.println(displayMode ? "Angles" : "Patient Info");
      }
      serialInput = "";
    } else {
      serialInput += c;
    }
  }
}

bool connectToWiFi() {
  Serial.println("\n📡 ===== WIFI CONNECTION ATTEMPT =====");
  Serial.print("SSID: '");
  Serial.print(ssid);
  Serial.println("'");
  
  showMessage("Connecting to", "WiFi", ssid, "Please wait...");
  
  WiFi.mode(WIFI_STA);
  WiFi.disconnect();
  delay(100);

  Serial.println("\n🔍 Scanning for networks...");
  int n = WiFi.scanNetworks();
  
  if (n > 0) {
    bool networkFound = false;
    for (int i = 0; i < n; ++i) {
      if (WiFi.SSID(i) == ssid) {
        networkFound = true;
        break;
      }
    }
    if (!networkFound) {
      Serial.println(" Network not found in scan!");
    }
  }
  
  WiFi.scanDelete();

  WiFi.begin(ssid, password);
  
  int attempts = 0;
  const int maxAttempts = 30;
  
  while (WiFi.status() != WL_CONNECTED && attempts < maxAttempts) {
    delay(1000);
    Serial.print(".");
    attempts++;
    
    if (attempts % 5 == 0) {
      char attemptStr[30];
      sprintf(attemptStr, "Attempt %d/%d", attempts, maxAttempts);
      showMessage("Connecting to WiFi", ssid, attemptStr, "");
    }
    
    digitalWrite(LED_PIN, !digitalRead(LED_PIN));
  }
  
  Serial.println();
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println(" WiFi Connected!");
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());
    
    char ipStr[20];
    sprintf(ipStr, "IP: %s", WiFi.localIP().toString().c_str());
    showMessage(" WiFi Connected!", ipStr, "", "");
    
    digitalWrite(LED_PIN, HIGH);
    delay(2000);
    return true;
  } else {
    Serial.println(" WiFi Failed!");
    showMessage(" WiFi Failed", "Type 'wifi' to", "retry", "");
    return false;
  }
}

void checkWiFi() {
  if (WiFi.status() != WL_CONNECTED) {
    if (wifiConnected) {
      Serial.println(" WiFi lost!");
      wifiConnected = false;
    }
    wifiConnected = connectToWiFi();
  } else if (!wifiConnected) {
    wifiConnected = true;
    Serial.println(" WiFi reconnected!");
  }
}

bool registerPatient(String token) {
  Serial.println("\n ===== REGISTERING PATIENT =====");
  
  char tokenStr[20];
  token.toCharArray(tokenStr, 20);
  showMessage("Registering", "Patient:", tokenStr, "Please wait...");
  
  if (!wifiConnected) {
    wifiConnected = connectToWiFi();
    if (!wifiConnected) {
      showMessage("ERROR:", "No WiFi", "Cannot register", "Check connection");
      return false;
    }
  }
  
  if (!deviceReady) {
    clearPatientData();
  }
  
  HTTPClient http;
  http.begin(String(serverUrl) + "/api/patient/register-device");
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(5000);
  
  StaticJsonDocument<200> doc;
  doc["patientToken"] = token;
  doc["deviceName"] = "ESP32 Monitor";
  
  String requestBody;
  serializeJson(doc, requestBody);
  
  int httpCode = http.POST(requestBody);
  
  if (httpCode == 200 || httpCode == 201) {
    String response = http.getString();
    DynamicJsonDocument responseDoc(1024);
    deserializeJson(responseDoc, response);
    
    if (responseDoc["success"]) {
      patient.token = token;
      patient.apiKey = responseDoc["apiKey"].as<String>();
      patient.registered = true;
      
      Serial.println(" Registration successful!");
      http.end();
      
      fetchPatientStatus();
      beepBuzzer(2, 200);
      return enrollFingerprint(1);
    }
  }
  
  Serial.print(" Registration failed. Code: ");
  Serial.println(httpCode);
  http.end();
  return false;
}


bool enrollFingerprint(int id) {
  Serial.println("\n ===== FINGERPRINT ENROLLMENT =====");
  Serial.print("Enrolling ID: ");
  Serial.println(id);
  
  showMessage("Fingerprint Setup", "Place finger on", "sensor", "ID: 1");
  
  int p = -1;
  char errorMsg[32];
  

  Serial.println("Step 1: Waiting for finger...");
  Serial.println("Please place your finger on the sensor now!");
  
  display.clearDisplay();
  display.setCursor(0, 0);
  display.println("Step 1 of 4");
  display.println("");
  display.println("Place finger on");
  display.println("sensor...");
  display.display();

  unsigned long timeout = millis() + 30000; 
  p = FINGERPRINT_NOFINGER;
  int attempts = 0;
  
  Serial.println("Waiting for finger detection...");
  
  while (p == FINGERPRINT_NOFINGER && millis() < timeout) {
    p = finger.getImage();
    attempts++;
    
    if (attempts % 10 == 0) { 
      Serial.print(".");
    }

    static int dotCount = 0;
    if (millis() % 500 < 50) {
      dotCount = (dotCount + 1) % 4;
      display.fillRect(0, 48, 128, 16, SSD1306_BLACK);
      display.setCursor(0, 48);
      display.print("Waiting");
      for(int i=0; i<dotCount; i++) display.print(".");
      display.display();
    }
    
    delay(50);
  }
  
  Serial.println(); 
  
  if (p == FINGERPRINT_NOFINGER) {
    Serial.println(" Timeout - no finger detected after 30 seconds!");
    showMessage("ERROR:", "No finger", "detected", "Try again");
    delay(2000);
    return false;
  }
  
  if (p != FINGERPRINT_OK) {
    Serial.print(" Error reading finger. Error code: ");
    Serial.println(p);
    sprintf(errorMsg, "Code: %d", p);
    showMessage("ERROR:", "Sensor error", errorMsg, "Try again");
    delay(2000);
    return false;
  }
  
  Serial.println(" First image captured!");
  showMessage(" Image OK", "Remove finger", "", "");
  delay(1000);

  p = finger.image2Tz(1);
  if (p != FINGERPRINT_OK) {
    Serial.print(" Image conversion failed. Error code: ");
    Serial.println(p);
    return false;
  }
  
  Serial.println(" First image converted");

  Serial.println("Step 2: Remove finger");
  display.clearDisplay();
  display.setCursor(0, 0);
  display.println("Step 2 of 4");
  display.println("");
  display.println("Remove finger");
  display.println("from sensor");
  display.display();
  
  p = 0;
  timeout = millis() + 10000; 
  attempts = 0;
  
  Serial.println("Waiting for finger removal...");
  
  while (p != FINGERPRINT_NOFINGER && millis() < timeout) {
    p = finger.getImage();
    attempts++;
    if (attempts % 10 == 0) Serial.print(".");
    delay(100);
  }
  
  Serial.println();
  
  if (p != FINGERPRINT_NOFINGER) {
    Serial.println(" Finger not removed within timeout!");
    showMessage("ERROR:", "Please remove", "finger", "");
    delay(2000);
    return false;
  }
  
  Serial.println(" Finger removed");
  delay(1000);

  Serial.println("Step 3: Place same finger again");
  display.clearDisplay();
  display.setCursor(0, 0);
  display.println("Step 3 of 4");
  display.println("");
  display.println("Place SAME finger");
  display.println("again...");
  display.display();
  
  timeout = millis() + 30000; 
  p = FINGERPRINT_NOFINGER;
  attempts = 0;
  
  Serial.println("Waiting for finger again...");
  
  while (p == FINGERPRINT_NOFINGER && millis() < timeout) {
    p = finger.getImage();
    attempts++;
    if (attempts % 10 == 0) Serial.print(".");

    static int dotCount2 = 0;
    if (millis() % 500 < 50) {
      dotCount2 = (dotCount2 + 1) % 4;
      display.fillRect(0, 48, 128, 16, SSD1306_BLACK);
      display.setCursor(0, 48);
      display.print("Waiting");
      for(int i=0; i<dotCount2; i++) display.print(".");
      display.display();
    }
    
    delay(50);
  }
  
  Serial.println();
  
  if (p == FINGERPRINT_NOFINGER) {
    Serial.println(" Timeout - no finger detected!");
    showMessage("ERROR:", "No finger", "detected", "Try again");
    delay(2000);
    return false;
  }
  
  if (p != FINGERPRINT_OK) {
    Serial.print(" Error reading finger: ");
    Serial.println(p);
    sprintf(errorMsg, "Code: %d", p);
    showMessage("ERROR:", "Sensor error", errorMsg, "Try again");
    return false;
  }
  
  Serial.println(" Second image captured");
  showMessage(" Image OK", "Processing...", "", "");
  

  p = finger.image2Tz(2);
  if (p != FINGERPRINT_OK) {
    Serial.println(" Second image conversion failed");
    return false;
  }

  Serial.println("Step 4: Creating fingerprint model...");
  display.clearDisplay();
  display.setCursor(0, 0);
  display.println("Step 4 of 4");
  display.println("");
  display.println("Creating model...");
  display.display();
  
  p = finger.createModel();
  if (p == FINGERPRINT_OK) {
    Serial.println(" Fingerprints matched!");
  } else if (p == FINGERPRINT_ENROLLMISMATCH) {
    Serial.println(" Fingers did not match!");
    showMessage("ERROR:", "Fingers don't", "match", "Try again");
    delay(2000);
    return false;
  } else {
    Serial.print(" Error creating model: ");
    Serial.println(p);
    sprintf(errorMsg, "Code: %d", p);
    showMessage("ERROR:", "Model failed", errorMsg, "");
    return false;
  }
  
  Serial.print("Storing model as ID #");
  Serial.println(id);
  
  p = finger.storeModel(id);
  if (p == FINGERPRINT_OK) {
    patient.fingerprintID = id;
    deviceReady = false;
    displayState = 1;
    
    Serial.println(" Fingerprint stored successfully!");
    showMessage(" SUCCESS!", "Fingerprint", "stored", "Device ready");
    beepBuzzer(3, 200);
    delay(2000);
    return true;
  } else {
    Serial.print(" Failed to store: ");
    Serial.println(p);
    sprintf(errorMsg, "Code: %d", p);
    showMessage("ERROR:", "Storage failed", errorMsg, "");
    return false;
  }
}

int verifyFingerprint() {
  int p = -1;
  unsigned long timeout = millis() + 15000;
  
  while (p != FINGERPRINT_OK && millis() < timeout) {
    p = finger.getImage();
    delay(10);
  }
  
  if (p != FINGERPRINT_OK) return -1;
  
  p = finger.image2Tz();
  if (p != FINGERPRINT_OK) return -1;
  
  p = finger.fingerFastSearch();
  if (p == FINGERPRINT_OK) {
    return finger.fingerID;
  }
  
  return -1;
}

bool deleteFingerprint(int id) {
  return (finger.deleteModel(id) == FINGERPRINT_OK);
}

void fetchPatientStatus() {
  if (!wifiConnected || !patient.registered) return;
  
  HTTPClient http;
  String url = String(serverUrl) + "/api/patient/status/" + patient.token;
  http.begin(url);
  
  int httpCode = http.GET();
  
  if (httpCode == 200) {
    String response = http.getString();
    DynamicJsonDocument doc(1024);
    deserializeJson(doc, response);
    
    if (doc["success"]) {
      patient.name = doc["patient"]["name"].as<String>();
      patient.hospital = doc["patient"]["hospital"].as<String>();
      patient.status = doc["patient"]["status"].as<String>();
      patient.isPriority = doc["patient"]["isPriority"];
      patient.queuePosition = doc["queueInfo"]["position"] | 0;
      patient.totalWaiting = doc["queueInfo"]["totalWaiting"] | 0;
      patient.estimatedTime = doc["timing"]["estimatedStartTime"].as<String>();
      
      Serial.println("\n Patient Data:");
      Serial.print("Name: ");
      Serial.println(patient.name);
      Serial.print("Queue: ");
      Serial.print(patient.queuePosition);
      Serial.print("/");
      Serial.println(patient.totalWaiting);
    }
  }
  
  http.end();
}

void sendEmergencyAlert(int fingerprintId, String type) {
  if (!wifiConnected) return;
  
  HTTPClient http;
  http.begin(String(serverUrl) + "/api/patient/emergency");
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-api-key", patient.apiKey);
  
  StaticJsonDocument<300> doc;
  doc["fingerprintId"] = String(fingerprintId);
  doc["emergencyType"] = type;
  doc["patientToken"] = patient.token;
  doc["patientName"] = patient.name;
  
  // Include fall data if it's a fall detection
  if (type == "fall_detected") {
    JsonObject fallData = doc.createNestedObject("fallData");
    fallData["angleX"] = mpuData.angleX;
    fallData["angleY"] = mpuData.angleY;
    fallData["angleZ"] = mpuData.angleZ;
    fallData["accMagnitude"] = sqrt(mpuData.accX*mpuData.accX + mpuData.accY*mpuData.accY + mpuData.accZ*mpuData.accZ);
  }
  
  JsonObject location = doc.createNestedObject("location");
  location["lat"] = 13.0827;
  location["lng"] = 80.2707;
  
  String requestBody;
  serializeJson(doc, requestBody);
  
  int httpCode = http.POST(requestBody);
  
  if (httpCode == 200) {
    String response = http.getString();
    DynamicJsonDocument responseDoc(200);
    deserializeJson(responseDoc, response);
    
    if (responseDoc["success"]) {
      lastAlertId = responseDoc["alertId"].as<String>();
      Serial.print(" Alert sent! ID: ");
      Serial.println(lastAlertId);
      
      for(int i=0; i<5; i++) {
        digitalWrite(BUZZER_PIN, HIGH);
        delay(100);
        digitalWrite(BUZZER_PIN, LOW);
        delay(100);
      }
    }
  }
  
  http.end();
}

void clearPatientData() {
  if (patient.fingerprintID > 0) {
    deleteFingerprint(patient.fingerprintID);
  }
  
  patient.token = "";
  patient.apiKey = "";
  patient.name = "";
  patient.hospital = "";
  patient.estimatedTime = "";
  patient.queuePosition = 0;
  patient.totalWaiting = 0;
  patient.fingerprintID = -1;
  patient.registered = false;
  
  deviceReady = true;
  displayState = 0;
  
  Serial.println(" Device reset - Ready for next patient");
  beepBuzzer(2, 200);
}



void showSplashScreen() {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(20, 10);
  display.println("MediQueue");
  display.setCursor(15, 25);
  display.println("Patient Device");
  display.setCursor(25, 45);
  display.println("Starting...");
  display.display();
  delay(2000);
}

void showMessage(const char* line1, const char* line2, const char* line3, const char* line4) {
  display.clearDisplay();
  display.setCursor(0, 0);
  display.println(line1);
  display.setCursor(0, 16);
  display.println(line2);
  display.setCursor(0, 32);
  display.println(line3);
  display.setCursor(0, 48);
  display.println(line4);
  display.display();
}

String formatTime(String timeStr) {
  if (timeStr.length() == 0) return "--:--";
  int spaceIndex = timeStr.indexOf(' ');
  if (spaceIndex > 0) {
    return timeStr.substring(0, 5);
  }
  return timeStr;
}

void updateDisplay() {
  display.clearDisplay();
  
  // Top bar
  display.setCursor(0, 0);
  display.print(wifiConnected ? "📶" : "📡");
  
  if (!deviceReady && patient.token.length() > 0) {
    display.setCursor(20, 0);
    display.print(patient.token.substring(0, 8).c_str());
  }
  
  if (emergencyMode) {
    display.setCursor(100, 0);
    display.print("🚨");
  } else if (mpuData.fallDetected) {
    display.setCursor(100, 0);
    display.print("⚠️");
  }
  
  display.drawLine(0, 10, 128, 10, SSD1306_WHITE);
  

  if (deviceReady) {
    display.setCursor(15, 20);
    display.println("Ready for");
    display.setCursor(10, 35);
    display.println("Next Patient");
    display.setCursor(5, 50);
    display.println("Send token via Serial");
  } 
  else if (displayState == 1) {
    if (displayMode == 0) {

      if (patient.name.length() > 0) {
        display.setCursor(0, 15);
        display.print("Hello ");
        display.print(patient.name.substring(0, 12).c_str());
        
        display.setCursor(0, 27);
        display.print("Hosp: ");
        display.print(patient.hospital.substring(0, 10).c_str());
        
        display.setCursor(0, 39);
        display.print("Pos: ");
        display.print(patient.queuePosition);
        display.print("/");
        display.print(patient.totalWaiting);
        
        display.setCursor(0, 51);
        display.print("Est: ");
        display.print(formatTime(patient.estimatedTime).c_str());
        
        if (patient.isPriority) {
          display.fillRect(110, 35, 15, 12, SSD1306_WHITE);
          display.setTextColor(SSD1306_BLACK);
          display.setCursor(113, 37);
          display.print("P");
          display.setTextColor(SSD1306_WHITE);
        }
      }
    } else {

      display.setCursor(0, 15);
      display.print("Angles:");
      
      display.setCursor(0, 27);
      display.print("X: ");
      display.print(mpuData.angleX, 1);
      display.print("°");
      
      display.setCursor(0, 39);
      display.print("Y: ");
      display.print(mpuData.angleY, 1);
      display.print("°");
      
      display.setCursor(0, 51);
      display.print("Z: ");
      display.print(mpuData.angleZ, 1);
      display.print("°");

      if (mpuData.fallDetected) {
        display.fillRect(80, 35, 45, 20, SSD1306_WHITE);
        display.setTextColor(SSD1306_BLACK);
        display.setCursor(85, 40);
        display.print("FALL");
        display.setCursor(90, 50);
        display.print("DET");
        display.setTextColor(SSD1306_WHITE);
      }
    }
  }
  else if (displayState == 2) {
    display.setCursor(20, 20);
    display.println(" EMERGENCY");
    display.setCursor(10, 35);
    display.println("Place finger on");
    display.setCursor(25, 47);
    display.println("sensor...");
  }
  else if (displayState == 3) {
    display.setCursor(20, 15);
    display.println(" ALERT SENT!");
    display.setCursor(10, 30);
    display.print("ID: ");
    display.print(lastAlertId.substring(0, 12).c_str());
    display.setCursor(20, 45);
    display.println("Hospital notified");
  }
  
  // Bottom instruction
  display.drawLine(0, 60, 128, 60, SSD1306_WHITE);
  display.setCursor(5, 62);
  
  if (deviceReady) {
    display.print("Waiting for patient");
  } else {
    display.print("Hold for emergency");
  }
  
  display.display();
}

void beepBuzzer(int times, int delayMs) {
  for(int i=0; i<times; i++) {
    digitalWrite(BUZZER_PIN, HIGH);
    delay(delayMs);
    digitalWrite(BUZZER_PIN, LOW);
    if (i < times-1) delay(delayMs);
  }
}