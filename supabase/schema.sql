-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables
DROP TABLE IF EXISTS telemetry;
DROP TABLE IF EXISTS active_routes;
DROP TABLE IF EXISTS bins;
DROP TABLE IF EXISTS depots;
DROP TABLE IF EXISTS regions;

-- 1. Regions
CREATE TABLE regions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    display_name VARCHAR(200) NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    allocated_trucks INTEGER DEFAULT 5
);

-- 2. Depots
CREATE TABLE depots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    region_name VARCHAR(100) REFERENCES regions(name) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL
);

-- 3. Bins
CREATE TABLE bins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    region_name VARCHAR(100) REFERENCES regions(name) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    zone_type VARCHAR(50) DEFAULT 'Residential',
    status VARCHAR(50) DEFAULT 'Pending',
    time_window VARCHAR(50) DEFAULT '6:00 AM - 10:00 AM',
    collected_at TIMESTAMP WITH TIME ZONE
);

-- 4. Routes
CREATE TABLE active_routes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    region_name VARCHAR(100) REFERENCES regions(name) ON DELETE CASCADE,
    truck_id VARCHAR(50) NOT NULL,
    route_sequence JSONB NOT NULL,
    distance_saved DOUBLE PRECISION DEFAULT 0.0,
    fuel_saved DOUBLE PRECISION DEFAULT 0.0,
    co2_saved DOUBLE PRECISION DEFAULT 0.0,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Telemetry
CREATE TABLE telemetry (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    truck_id VARCHAR(50) NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    speed DOUBLE PRECISION DEFAULT 0.0,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
