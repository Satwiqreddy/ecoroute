-- Database Schema for Bin Flow

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables if they exist
DROP TABLE IF EXISTS active_route;
DROP TABLE IF EXISTS truck_telemetry;
DROP TABLE IF EXISTS bins;

-- Bins table
CREATE TABLE bins (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    zone_type VARCHAR(50) NOT NULL CHECK (zone_type IN ('Main Road', 'Residential')),
    status VARCHAR(50) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Collected')),
    time_window VARCHAR(50) NOT NULL,
    collected_at TIMESTAMP WITH TIME ZONE,
    photo_url TEXT
);

-- Truck telemetry table
CREATE TABLE truck_telemetry (
    id SERIAL PRIMARY KEY,
    truck_id VARCHAR(50) DEFAULT 'Truck-1',
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    speed DOUBLE PRECISION DEFAULT 0.0,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Active route table
CREATE TABLE active_route (
    id SERIAL PRIMARY KEY,
    route_sequence JSONB NOT NULL, -- Array of bin IDs: [4, 9, 1, 2]
    optimized_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    distance_saved_km DOUBLE PRECISION DEFAULT 0.0,
    fuel_saved_liters DOUBLE PRECISION DEFAULT 0.0,
    co2_saved_kg DOUBLE PRECISION DEFAULT 0.0
);

-- Seed Bins (Austin, Texas Coordinates)
INSERT INTO bins (name, latitude, longitude, zone_type, time_window) VALUES
('Bin 1 - Congress Ave (Main Road)', 30.2747, -97.7404, 'Main Road', '10:00 AM - 6:00 PM'),
('Bin 2 - South Congress (Main Road)', 30.2632, -97.7443, 'Main Road', '10:00 AM - 6:00 PM'),
('Bin 3 - West Austin Park (Residential)', 30.2789, -97.7554, 'Residential', '6:00 AM - 10:00 AM'),
('Bin 4 - Clarksville Community (Residential)', 30.2812, -97.7591, 'Residential', '6:00 AM - 10:00 AM'),
('Bin 5 - East 7th Street (Main Road)', 30.2690, -97.7280, 'Main Road', '10:00 AM - 6:00 PM'),
('Bin 6 - East Austin Community (Residential)', 30.2610, -97.7210, 'Residential', '6:00 AM - 10:00 AM'),
('Bin 7 - Holly Street Area (Residential)', 30.2580, -97.7250, 'Residential', '6:00 AM - 10:00 AM'),
('Bin 8 - I-35 Frontage Road (Main Road)', 30.2850, -97.7340, 'Main Road', '10:00 AM - 6:00 PM'),
('Bin 9 - Hyde Park North (Residential)', 30.2910, -97.7410, 'Residential', '6:00 AM - 10:00 AM'),
('Bin 10 - Hyde Park South (Residential)', 30.2950, -97.7460, 'Residential', '6:00 AM - 10:00 AM'),
('Bin 11 - MLK Boulevard (Main Road)', 30.2801, -97.7302, 'Main Road', '10:00 AM - 6:00 PM'),
('Bin 12 - Shoal Creek (Residential)', 30.2885, -97.7535, 'Residential', '6:00 AM - 10:00 AM');
