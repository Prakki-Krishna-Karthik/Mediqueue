-- Database Schema for Queue Management System

-- Doctors table
CREATE TABLE doctors (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    specialty VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE,
    phone VARCHAR(20),
    current_token INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Patients table
CREATE TABLE patients (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    mobile_number VARCHAR(20) NOT NULL,
    email VARCHAR(100),
    age INTEGER,
    gender VARCHAR(10),
    address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Appointments table
CREATE TABLE appointments (
    id SERIAL PRIMARY KEY,
    doctor_id INTEGER REFERENCES doctors(id),
    patient_id INTEGER REFERENCES patients(id),
    token_number INTEGER NOT NULL,
    appointment_date DATE NOT NULL,
    appointment_time TIME,
    status VARCHAR(20) CHECK (status IN ('waiting', 'notified', 'serving', 'completed', 'cancelled', 'no_show')) DEFAULT 'waiting',
    priority VARCHAR(10) CHECK (priority IN ('normal', 'urgent')) DEFAULT 'normal',
    check_in_time TIMESTAMP,
    completion_time TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notifications table
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    appointment_id INTEGER REFERENCES appointments(id),
    message TEXT NOT NULL,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) CHECK (status IN ('pending', 'sent', 'failed')) DEFAULT 'pending',
    response TEXT,
    notification_type VARCHAR(20) CHECK (notification_type IN ('sms', 'email', 'push'))
);

-- Admin users table
CREATE TABLE admin_users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    role VARCHAR(20) CHECK (role IN ('admin', 'doctor', 'staff')) NOT NULL,
    doctor_id INTEGER REFERENCES doctors(id),
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Settings table
CREATE TABLE settings (
    id SERIAL PRIMARY KEY,
    setting_key VARCHAR(50) UNIQUE NOT NULL,
    setting_value TEXT,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Queue statistics table
CREATE TABLE queue_stats (
    id SERIAL PRIMARY KEY,
    doctor_id INTEGER REFERENCES doctors(id),
    date DATE NOT NULL,
    total_patients INTEGER DEFAULT 0,
    completed INTEGER DEFAULT 0,
    cancelled INTEGER DEFAULT 0,
    no_show INTEGER DEFAULT 0,
    avg_wait_time INTEGER DEFAULT 0, -- in minutes
    avg_service_time INTEGER DEFAULT 0, -- in minutes
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert sample data for doctors
INSERT INTO doctors (name, specialty, email, phone) VALUES
('Dr. Sarah Johnson', 'Cardiology', 'sarah.johnson@mediqueue.com', '+1-555-123-4567'),
('Dr. Michael Chen', 'Orthopedics', 'michael.chen@mediqueue.com', '+1-555-234-5678'),
('Dr. Emily Wilson', 'Pediatrics', 'emily.wilson@mediqueue.com', '+1-555-345-6789'),
('Dr. Robert Davis', 'Neurology', 'robert.davis@mediqueue.com', '+1-555-456-7890');

-- Insert sample data for settings
INSERT INTO settings (setting_key, setting_value, description) VALUES
('notification_threshold', '2', 'Number of patients ahead when notification should be sent'),
('avg_appointment_duration', '15', 'Average appointment duration in minutes'),
('clinic_open_time', '09:00:00', 'Clinic opening time'),
('clinic_close_time', '17:00:00', 'Clinic closing time'),
('max_daily_patients', '20', 'Maximum patients per doctor per day'),
('enable_sms_notifications', 'true', 'Whether SMS notifications are enabled'),
('sms_template', 'MediQueue Alert: Your token number {token} will be called shortly. There are {count} patients ahead of you. Please proceed to the waiting area.', 'Template for SMS notifications');

-- Insert sample admin users
INSERT INTO admin_users (username, password_hash, name, email, role, doctor_id) VALUES
('admin', '$2a$10$NBImpeA/5Pa6jFJ.zPcQeO5DgR1wGcGqWvfmHRZ2pBE1Qk.Owlr66', 'Admin User', 'admin@mediqueue.com', 'admin', NULL),
('sjohnson', '$2a$10$NBImpeA/5Pa6jFJ.zPcQeO5DgR1wGcGqWvfmHRZ2pBE1Qk.Owlr66', 'Dr. Sarah Johnson', 'sarah.johnson@mediqueue.com', 'doctor', 1),
('mchen', '$2a$10$NBImpeA/5Pa6jFJ.zPcQeO5DgR1wGcGqWvfmHRZ2pBE1Qk.Owlr66', 'Dr. Michael Chen', 'michael.chen@mediqueue.com', 'doctor', 2),
('staff1', '$2a$10$NBImpeA/5Pa6jFJ.zPcQeO5DgR1wGcGqWvfmHRZ2pBE1Qk.Owlr66', 'Reception Staff', 'reception@mediqueue.com', 'staff', NULL);
