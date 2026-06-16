CREATE TABLE IF NOT EXISTS site_documents (
  document_id        INT          NOT NULL AUTO_INCREMENT,
  site_id            INT          NOT NULL,
  file_name          VARCHAR(255) NOT NULL,
  original_file_name VARCHAR(255),
  file_path          VARCHAR(500) NOT NULL,
  file_url           VARCHAR(500),
  mime_type          VARCHAR(100),
  file_size_bytes    BIGINT,
  uploaded_by        VARCHAR(100),
  uploaded_at        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (document_id),
  KEY idx_site_documents_site (site_id),
  CONSTRAINT fk_doc_site FOREIGN KEY (site_id)
    REFERENCES sites(site_id) ON DELETE CASCADE
);
