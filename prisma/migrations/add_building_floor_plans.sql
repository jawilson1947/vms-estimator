CREATE TABLE IF NOT EXISTS building_floor_plans (
  plan_id            INT          NOT NULL AUTO_INCREMENT,
  building_id        INT          NOT NULL,
  floor              VARCHAR(50)  NOT NULL,
  file_name          VARCHAR(255) NOT NULL,
  original_file_name VARCHAR(255),
  file_path          VARCHAR(500) NOT NULL,
  file_url           VARCHAR(500),
  file_size_bytes    BIGINT,
  uploaded_by        VARCHAR(100),
  uploaded_at        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (plan_id),
  UNIQUE KEY uq_building_floor (building_id, floor),
  CONSTRAINT fk_fp_building FOREIGN KEY (building_id)
    REFERENCES buildings(building_id) ON DELETE CASCADE
);
