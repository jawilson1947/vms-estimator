# CCTV Surveillance Management System
## Complete Requirements & Design Package

---

# 1. Project Overview

## Project Name
CCTV Surveillance Management System (CSMS)

## Purpose

The purpose of this application is to provide a centralized web-based platform for managing:

- Customers
- CCTV surveillance projects
- Building/site locations
- Camera inventory
- Surveillance design documentation
- Network and infrastructure information
- Image uploads
- Maintenance tracking
- Cost accounting
- Project profitability
- Reporting and export functions

The system should support both internal operational management and customer-facing project documentation.

---

# 2. Typical Surveillance Camera Properties

A typical surveillance camera specification database should support:

- Camera selection
- Lens and coverage planning
- Network and storage calculations
- Power budgeting
- Installation documentation
- Maintenance and replacement tracking

## Common Camera Properties

| Category | Property | Description |
|---|---|---|
| Identification | Camera ID | Unique identifier |
| Identification | Camera Name | Friendly location name |
| Identification | Manufacturer | Camera manufacturer |
| Identification | Model Number | Exact model |
| Identification | Serial Number | Device serial |
| Identification | Asset Tag | Organizational tracking ID |
| Physical Location | Building | Building name |
| Physical Location | Area/Room | Lobby, hallway, parking lot |
| Physical Location | Mounting Position | Ceiling, wall, pole |
| Camera Type | Camera Style | Dome, bullet, PTZ, fisheye |
| Camera Type | Indoor/Outdoor | Environmental classification |
| Camera Type | Vandal Rating | IK rating |
| Camera Type | Weather Rating | IP rating |
| Imaging | Resolution | 1080p, 4MP, 8MP, 4K |
| Imaging | Sensor Size | Sensor format |
| Imaging | Frame Rate | FPS |
| Imaging | Codec | H.264, H.265 |
| Imaging | Bitrate | Mbps |
| Imaging | WDR | Wide Dynamic Range |
| Imaging | Low Light Rating | Lux rating |
| Imaging | IR Distance | Night vision range |
| Lens | Lens Type | Fixed, varifocal |
| Lens | Focal Length | mm |
| Lens | Field of View | Horizontal/vertical FOV |
| PTZ Features | Optical Zoom | Zoom ratio |
| Audio | Microphone | Built-in audio |
| AI/Analytics | Motion Detection | Analytics support |
| AI/Analytics | Facial Recognition | AI capability |
| Network | IP Address | Assigned IP |
| Network | MAC Address | NIC address |
| Network | VLAN | Surveillance VLAN |
| Network | ONVIF Support | Profile support |
| Network | PoE Standard | PoE, PoE+, PoE++ |
| Recording | NVR Assignment | Recording server |
| Recording | Retention Days | Storage retention |
| Recording | Recording Mode | Continuous/motion/event |
| Power | Voltage | Power input |
| Power | Power Consumption | Watts |
| Installation | Install Date | Deployment date |
| Maintenance | Firmware Version | Current firmware |
| Maintenance | Warranty Expiration | Warranty date |
| Security | HTTPS Enabled | Secure access |
| Security | Certificate Installed | SSL support |
| Costing | Unit Cost | Camera cost |
| Costing | Labor Cost | Install labor |
| Costing | Total Installed Cost | Complete installed cost |
| Notes | Comments | Miscellaneous notes |

---

# 3. Recommended Technology Stack

| Component | Recommendation |
|---|---|
| Frontend | React / Next.js |
| Backend | Node.js / Express or Next.js API |
| Database | MySQL 8.x |
| ORM | Prisma or Sequelize |
| Authentication | NextAuth or JWT |
| File Storage | Local filesystem or S3-compatible storage |
| Reporting | PDF/Excel export |
| Styling | Tailwind CSS |
| Charts | Recharts or Chart.js |

---

# 4. MySQL Database Definition

```sql
CREATE DATABASE cctv_inventory;
USE cctv_inventory;

CREATE TABLE customers (
    customer_id INT AUTO_INCREMENT PRIMARY KEY,
    customer_name VARCHAR(200) NOT NULL,
    contact_name VARCHAR(150),
    contact_title VARCHAR(100),
    phone VARCHAR(50),
    email VARCHAR(150),
    billing_address TEXT,
    notes TEXT
);

CREATE TABLE projects (
    project_id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    project_name VARCHAR(200) NOT NULL,
    project_number VARCHAR(50),
    project_status ENUM('Proposed','Approved','In Progress','Completed','On Hold','Cancelled') DEFAULT 'Proposed',
    start_date DATE,
    completion_date DATE,
    project_manager VARCHAR(150),
    consulting_rate DECIMAL(10,2),
    overhead_rate_percent DECIMAL(5,2),
    notes TEXT,
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
);

CREATE TABLE sites (
    site_id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT,
    project_id INT,
    site_name VARCHAR(150) NOT NULL,
    address VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(50),
    notes TEXT,
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id),
    FOREIGN KEY (project_id) REFERENCES projects(project_id)
);

CREATE TABLE buildings (
    building_id INT AUTO_INCREMENT PRIMARY KEY,
    site_id INT NOT NULL,
    building_name VARCHAR(150) NOT NULL,
    notes TEXT,
    FOREIGN KEY (site_id) REFERENCES sites(site_id)
);

CREATE TABLE camera_locations (
    location_id INT AUTO_INCREMENT PRIMARY KEY,
    building_id INT NOT NULL,
    floor VARCHAR(50),
    area_name VARCHAR(150),
    mounting_location VARCHAR(150),
    coverage_purpose VARCHAR(150),
    notes TEXT,
    FOREIGN KEY (building_id) REFERENCES buildings(building_id)
);

CREATE TABLE camera_models (
    model_id INT AUTO_INCREMENT PRIMARY KEY,
    manufacturer VARCHAR(100),
    model_number VARCHAR(100),
    camera_type ENUM('Dome','Bullet','Turret','PTZ','Fisheye','LPR','Other'),
    indoor_outdoor ENUM('Indoor','Outdoor','Both'),
    resolution VARCHAR(50),
    lens_type VARCHAR(100),
    focal_length VARCHAR(100),
    field_of_view VARCHAR(100),
    ir_distance VARCHAR(100),
    wdr VARCHAR(100),
    low_light_rating VARCHAR(100),
    codec_support VARCHAR(150),
    poe_standard VARCHAR(50),
    max_power_watts DECIMAL(6,2),
    weather_rating VARCHAR(50),
    vandal_rating VARCHAR(50),
    onvif_profile VARCHAR(100),
    notes TEXT
);

CREATE TABLE cameras (
    camera_id INT AUTO_INCREMENT PRIMARY KEY,
    camera_code VARCHAR(50) NOT NULL UNIQUE,
    camera_name VARCHAR(150) NOT NULL,
    model_id INT,
    location_id INT,
    serial_number VARCHAR(100),
    asset_tag VARCHAR(100),
    ip_address VARCHAR(45),
    mac_address VARCHAR(50),
    vlan_id INT,
    switch_name VARCHAR(100),
    switch_port VARCHAR(50),
    nvr_name VARCHAR(100),
    recording_mode ENUM('Continuous','Motion','Event','Scheduled'),
    retention_days INT,
    bitrate_mbps DECIMAL(6,2),
    frame_rate INT,
    install_date DATE,
    warranty_expiration DATE,
    firmware_version VARCHAR(100),
    username_changed BOOLEAN DEFAULT FALSE,
    https_enabled BOOLEAN DEFAULT FALSE,
    privacy_mask_enabled BOOLEAN DEFAULT FALSE,
    status ENUM('Planned','Installed','Active','Offline','Needs Repair','Retired') DEFAULT 'Planned',
    notes TEXT,
    FOREIGN KEY (model_id) REFERENCES camera_models(model_id),
    FOREIGN KEY (location_id) REFERENCES camera_locations(location_id)
);

CREATE TABLE camera_location_images (
    image_id INT AUTO_INCREMENT PRIMARY KEY,
    camera_id INT NULL,
    location_id INT NULL,

    image_type ENUM(
        'Site Survey',
        'Mounting Location',
        'Field of View',
        'Cable Path',
        'Installed Camera',
        'Maintenance',
        'Other'
    ) DEFAULT 'Other',

    file_name VARCHAR(255) NOT NULL,
    original_file_name VARCHAR(255),
    file_path VARCHAR(500) NOT NULL,
    file_url VARCHAR(500),
    mime_type VARCHAR(100),
    file_size_bytes BIGINT,

    description TEXT,
    uploaded_by VARCHAR(100),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (camera_id) REFERENCES cameras(camera_id) ON DELETE CASCADE,
    FOREIGN KEY (location_id) REFERENCES camera_locations(location_id) ON DELETE CASCADE
);

CREATE TABLE maintenance_records (
    maintenance_id INT AUTO_INCREMENT PRIMARY KEY,
    camera_id INT NOT NULL,
    service_date DATE NOT NULL,
    service_type VARCHAR(100),
    technician VARCHAR(100),
    issue_found TEXT,
    corrective_action TEXT,
    next_service_due DATE,
    FOREIGN KEY (camera_id) REFERENCES cameras(camera_id)
);

CREATE TABLE project_costs (
    cost_id INT AUTO_INCREMENT PRIMARY KEY,
    project_id INT NOT NULL,
    cost_category ENUM(
        'Camera Equipment',
        'Network Equipment',
        'Cabling',
        'Mounting Hardware',
        'Licensing',
        'Labor',
        'Consulting',
        'Project Management',
        'Overhead',
        'Travel',
        'Permits',
        'Contingency',
        'Other'
    ) NOT NULL,
    description VARCHAR(255),
    quantity DECIMAL(10,2) DEFAULT 1,
    unit_cost DECIMAL(10,2) DEFAULT 0,
    markup_percent DECIMAL(5,2) DEFAULT 0,
    line_total DECIMAL(12,2) GENERATED ALWAYS AS
        (quantity * unit_cost * (1 + markup_percent / 100)) STORED,
    vendor VARCHAR(150),
    cost_date DATE,
    billable BOOLEAN DEFAULT TRUE,
    notes TEXT,
    FOREIGN KEY (project_id) REFERENCES projects(project_id)
);

CREATE TABLE project_fee_summary (
    fee_id INT AUTO_INCREMENT PRIMARY KEY,
    project_id INT NOT NULL,
    direct_cost_total DECIMAL(12,2) DEFAULT 0,
    overhead_percent DECIMAL(5,2) DEFAULT 0,
    overhead_amount DECIMAL(12,2) DEFAULT 0,
    consulting_fee DECIMAL(12,2) DEFAULT 0,
    project_management_fee DECIMAL(12,2) DEFAULT 0,
    contingency_amount DECIMAL(12,2) DEFAULT 0,
    tax_amount DECIMAL(12,2) DEFAULT 0,
    grand_total DECIMAL(12,2) DEFAULT 0,
    FOREIGN KEY (project_id) REFERENCES projects(project_id)
);
```

---

# 5. Web-Based Inventory Dashboard

## Dashboard Modules

| Module | Purpose |
|---|---|
| Camera Inventory | View all cameras and status |
| Add/Edit Camera | Enter camera specifications |
| Site Map / Building View | Organize by building/floor |
| Network View | VLAN, switch, port tracking |
| Recording View | NVR and retention tracking |
| Maintenance Log | Service history |
| Cost Summary | Financial tracking |
| Security Compliance | Firmware/password compliance |
| Reports | Export PDF/Excel reports |

## Camera Detail Page

```text
Camera Detail Page
 ├── Camera Information
 ├── Network / Recording
 ├── Maintenance
 ├── Cost
 └── Location Images
      ├── Upload Image
      ├── Image Type
      ├── Description
      ├── Thumbnail Preview
      └── Download / Delete
```

---

# 6. Image Upload Requirements

## Image Categories

| Image Type | Purpose |
|---|---|
| Site Survey | Before installation |
| Mounting Location | Shows mounting surface |
| Field of View | Camera coverage |
| Cable Path | Conduit/cabling path |
| Installed Camera | Final installed condition |
| Maintenance | Repair documentation |

## Storage Recommendations

- Store image files outside database
- Store only file paths and metadata in MySQL
- Organize files by project/site/camera

Example:

```text
/uploads/projects/ProjectA/CAM-001/
```

---

# 7. Cost Tracking System

## Cost Categories

- Camera Equipment
- Network Equipment
- Cabling
- Mounting Hardware
- Licensing
- Labor
- Consulting
- Project Management
- Overhead
- Travel
- Permits
- Contingency
- Other

## Cost Formula

```text
Direct Costs
+ Overhead
+ Consulting Fees
+ Project Management Fees
+ Contingency
+ Taxes
= Total Project Cost
```

## Dashboard Financial Metrics

- Total Project Cost
- Total Labor Cost
- Total Equipment Cost
- Gross Margin
- Net Margin
- Billable vs Non-Billable

---

# 8. Surveillance Design Worksheet

## Worksheet Sections

### Site Information
- Site
- Building
- Area

### Camera Design
- Camera Type
- Resolution
- Lens
- Night Vision
- Coverage Purpose

### Network Design
- VLAN
- IP Address
- Switch
- Switch Port

### Power Design
- PoE Budget
- UPS Protected

### Recording Design
- Recording Mode
- Retention
- Estimated Storage

### Security
- Password Changed
- HTTPS Enabled
- Firmware Current

---

# 9. Reporting System

## Operational Reports

- Camera Inventory
- Offline Cameras
- Maintenance Due
- Firmware Compliance

## Financial Reports

- Cost Breakdown
- Profitability Summary
- Billable Cost Report

## Project Reports

- Site Survey
- Installation Report
- As-Built Documentation
- Camera Schedule

## Export Formats

- PDF
- Excel
- CSV

---

# 10. User Roles & Security

## Roles

| Role | Permissions |
|---|---|
| Administrator | Full access |
| Project Manager | Projects/costs/reports |
| Technician | Cameras/maintenance |
| Viewer | Read-only |

## Security Requirements

- HTTPS required
- Role-based access
- Audit logging
- Password hashing
- Session timeout
- File upload validation

---

# 11. REST API Requirements

## Suggested API Endpoints

### Customers
```text
/api/customers
```

### Projects
```text
/api/projects
```

### Cameras
```text
/api/cameras
```

### Uploads
```text
/api/uploads
```

### Reports
```text
/api/reports
```

---

# 12. Dashboard Widgets

| Widget | Purpose |
|---|---|
| Total Cameras | Inventory count |
| Cameras Offline | Health monitoring |
| Projects In Progress | Project status |
| Maintenance Due | Upcoming service |
| Total Project Cost | Financial tracking |
| Storage Usage | Recording capacity |

---

# 13. Search & Filtering

## Required Filters

- Customer
- Project
- Site
- Building
- Camera Type
- Camera Status
- VLAN
- Manufacturer
- Recording Type

---

# 14. File Upload Requirements

## Supported Formats

- JPG
- PNG
- WEBP
- PDF

## Maximum File Size

- 25 MB per upload

---

# 15. Future Enhancements

## Planned Expansion Areas

- ONVIF auto-discovery
- SNMP monitoring
- Live camera health polling
- GIS/map integration
- AI analytics integration
- Mobile app
- QR code asset tagging
- Integration with access control systems
- Integration with VMS platforms

---

# 16. Deliverables

The completed system should include:

1. MySQL database schema
2. Backend REST API
3. Responsive web dashboard
4. Authentication system
5. File upload system
6. Reporting engine
7. Export capability
8. Camera image management
9. Cost accounting engine
10. Surveillance worksheet generator
11. PDF project documentation generator
12. Deployment documentation
13. User manual

