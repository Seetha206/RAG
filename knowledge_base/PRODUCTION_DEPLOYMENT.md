# Production Deployment Guide

This guide covers deploying your RAG system to production with pgvector, BAAI/bge-large-en-v1.5, and Gemini.

## Quick Start

```bash
# 1. Clone/copy your project to production server
cd /home/seetha/Documents/Seetha/RAG

# 2. Install dependencies
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install --no-cache-dir -r requirements_production.txt

# 3. Set environment variables
cp .env.example .env  # Then edit with your keys

# 4. Setup PostgreSQL
sudo -u postgres psql -c "CREATE DATABASE rag_db;"
sudo -u postgres psql rag_db -c "CREATE EXTENSION vector;"

# 5. Run production server
gunicorn app:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

---

## 1. Server Requirements

### Minimum Specifications
- **OS:** Ubuntu 20.04+ / Debian 11+ / RHEL 8+
- **CPU:** 2+ cores (4+ recommended)
- **RAM:** 4 GB minimum (8 GB recommended)
- **Storage:** 10 GB free space
- **Python:** 3.9-3.11 (3.11 recommended)
- **PostgreSQL:** 12+ with pgvector extension

### Recommended Production Specifications
- **CPU:** 4-8 cores
- **RAM:** 16 GB
- **Storage:** 50 GB SSD
- **Network:** 100 Mbps+

---

## 2. PostgreSQL Setup

### Install PostgreSQL

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib postgresql-server-dev-all
```

**RHEL/CentOS:**
```bash
sudo yum install postgresql-server postgresql-contrib postgresql-devel
sudo postgresql-setup initdb
sudo systemctl start postgresql
```

### Install pgvector Extension

```bash
# Clone pgvector
cd /tmp
git clone --branch v0.5.1 https://github.com/pgvector/pgvector.git
cd pgvector

# Build and install
make
sudo make install

# Verify installation
psql -U postgres -c "SELECT * FROM pg_available_extensions WHERE name = 'vector';"
```

### Create Database

```bash
# Create database
sudo -u postgres psql << EOF
CREATE DATABASE rag_db;
\c rag_db
CREATE EXTENSION vector;

-- Create user (optional)
CREATE USER rag_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE rag_db TO rag_user;
GRANT ALL ON SCHEMA public TO rag_user;
EOF
```

### Configure PostgreSQL for Production

Edit `/etc/postgresql/[version]/main/postgresql.conf`:

```ini
# Connection Settings
max_connections = 100
shared_buffers = 2GB              # 25% of RAM
effective_cache_size = 6GB        # 75% of RAM
maintenance_work_mem = 512MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1            # For SSD
effective_io_concurrency = 200    # For SSD
work_mem = 10MB
min_wal_size = 1GB
max_wal_size = 4GB

# Performance for vector operations
shared_preload_libraries = 'vector'
```

Restart PostgreSQL:
```bash
sudo systemctl restart postgresql
```

---

## 3. Application Setup

### Install Python Dependencies

```bash
# Create virtual environment
python3.11 -m venv venv
source venv/bin/activate

# Upgrade pip
pip install --upgrade pip setuptools wheel

# Install production requirements
pip install --no-cache-dir -r requirements_production.txt

# Verify installation
python -c "from sentence_transformers import SentenceTransformer; print('✓ Embeddings OK')"
python -c "import psycopg2; print('✓ PostgreSQL OK')"
python -c "import fastapi; print('✓ FastAPI OK')"
```

### Download Embedding Model (First Time)

```bash
# Pre-download model to avoid delays on first request
python << EOF
from sentence_transformers import SentenceTransformer
model = SentenceTransformer('BAAI/bge-large-en-v1.5')
print('✓ Model downloaded successfully')
EOF
```

### Configure Environment Variables

Create `.env` file:

```bash
# .env
GEMINI_API_KEY=your_gemini_api_key_here
PGVECTOR_CONNECTION_STRING=postgresql://rag_user:your_secure_password@localhost:5432/rag_db

# Optional: Sentry error tracking
# SENTRY_DSN=https://your-sentry-dsn
```

**Security:** Set proper permissions:
```bash
chmod 600 .env
```

### Update Production Config

Edit `config.py`:

```python
API_CONFIG = {
    "host": "0.0.0.0",
    "port": 8000,
    "reload": False,  # IMPORTANT: Disable auto-reload in production!
    "cors_origins": [
        "https://yourdomain.com",
        "https://www.yourdomain.com"
    ],  # Restrict to your domains only!
}
```

---

## 4. Running the Application

### Option 1: Gunicorn (Recommended)

```bash
# Start with 4 worker processes
gunicorn app:app \
  -w 4 \
  -k uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:8000 \
  --access-logfile /var/log/rag/access.log \
  --error-logfile /var/log/rag/error.log \
  --log-level info
```

**Worker calculation:** `(2 x CPU cores) + 1`
- 2 cores → 5 workers
- 4 cores → 9 workers
- 8 cores → 17 workers

### Option 2: Uvicorn with Multiple Workers

```bash
uvicorn app:app \
  --host 0.0.0.0 \
  --port 8000 \
  --workers 4 \
  --log-level info
```

### Option 3: Systemd Service (Best for Production)

Create `/etc/systemd/system/rag-api.service`:

```ini
[Unit]
Description=RAG API Service
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=notify
User=www-data
Group=www-data
WorkingDirectory=/home/seetha/Documents/Seetha/RAG
Environment="PATH=/home/seetha/Documents/Seetha/RAG/venv/bin"
EnvironmentFile=/home/seetha/Documents/Seetha/RAG/.env

ExecStart=/home/seetha/Documents/Seetha/RAG/venv/bin/gunicorn app:app \
  -w 4 \
  -k uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:8000 \
  --access-logfile /var/log/rag/access.log \
  --error-logfile /var/log/rag/error.log

ExecReload=/bin/kill -s HUP $MAINPID
KillMode=mixed
TimeoutStopSec=5
PrivateTmp=true

Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target
```

**Start the service:**

```bash
# Create log directory
sudo mkdir -p /var/log/rag
sudo chown www-data:www-data /var/log/rag

# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable rag-api
sudo systemctl start rag-api

# Check status
sudo systemctl status rag-api

# View logs
sudo journalctl -u rag-api -f
```

---

## 5. Nginx Reverse Proxy

### Install Nginx

```bash
sudo apt install nginx
```

### Configure Nginx

Create `/etc/nginx/sites-available/rag-api`:

```nginx
upstream rag_backend {
    server 127.0.0.1:8000;
}

server {
    listen 80;
    server_name api.yourdomain.com;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    # SSL certificates (use Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # File upload size
    client_max_body_size 50M;

    # Timeouts for long-running requests
    proxy_connect_timeout 300s;
    proxy_send_timeout 300s;
    proxy_read_timeout 300s;

    location / {
        proxy_pass http://rag_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
    limit_req zone=api_limit burst=20 nodelay;

    # Access log
    access_log /var/log/nginx/rag-api-access.log;
    error_log /var/log/nginx/rag-api-error.log;
}
```

**Enable site:**

```bash
sudo ln -s /etc/nginx/sites-available/rag-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Setup SSL with Let's Encrypt

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d api.yourdomain.com
```

---

## 6. Monitoring and Logging

### Setup Structured Logging

Update `app.py` to add JSON logging:

```python
import logging
from pythonjsonlogger import jsonlogger

# Configure logger
logHandler = logging.StreamHandler()
formatter = jsonlogger.JsonFormatter()
logHandler.setFormatter(formatter)
logger = logging.getLogger()
logger.addHandler(logHandler)
logger.setLevel(logging.INFO)
```

### Monitor with Sentry (Optional)

Add to `app.py`:

```python
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration

sentry_sdk.init(
    dsn=os.getenv("SENTRY_DSN"),
    integrations=[FastApiIntegration()],
    traces_sample_rate=0.1,
    environment="production"
)
```

### Health Check Endpoint

Add to `app.py`:

```python
@app.get("/health")
async def health_check():
    """Health check endpoint for monitoring."""
    try:
        # Check database connection
        stats = vector_db.get_stats()
        return {
            "status": "healthy",
            "database": "connected",
            "total_vectors": stats.get("total_vectors", 0)
        }
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Unhealthy: {str(e)}")
```

---

## 7. Security Checklist

- [ ] **Environment variables:** Never commit `.env` to git
- [ ] **API keys:** Rotate Gemini API key regularly
- [ ] **Database:** Use strong passwords, restrict network access
- [ ] **CORS:** Restrict to your domain only (not `["*"]`)
- [ ] **HTTPS:** Always use SSL in production
- [ ] **Rate limiting:** Configure Nginx rate limits
- [ ] **File uploads:** Validate file types and sizes
- [ ] **Updates:** Keep dependencies updated (`pip list --outdated`)
- [ ] **Firewall:** Only expose ports 80, 443 (close 8000)
- [ ] **User permissions:** Run service as non-root user

---

## 8. Performance Tuning

### Database Indexing

The pgvector index is created automatically, but verify:

```sql
-- Check indexes
\d rag_documents

-- Rebuild index if needed
REINDEX INDEX rag_documents_embedding_idx;

-- Analyze for query optimization
ANALYZE rag_documents;
```

### Connection Pooling

For high traffic, use pgBouncer:

```bash
sudo apt install pgbouncer
```

Configure `/etc/pgbouncer/pgbouncer.ini`:

```ini
[databases]
rag_db = host=localhost port=5432 dbname=rag_db

[pgbouncer]
pool_mode = transaction
max_client_conn = 100
default_pool_size = 25
```

Update connection string:
```
PGVECTOR_CONNECTION_STRING=postgresql://user:pass@localhost:6432/rag_db
```

---

## 9. Backup Strategy

### Database Backups

```bash
# Daily backup script
#!/bin/bash
BACKUP_DIR="/backups/rag"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR
pg_dump -U postgres rag_db > $BACKUP_DIR/rag_db_$DATE.sql
gzip $BACKUP_DIR/rag_db_$DATE.sql

# Keep only last 7 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete
```

Add to crontab:
```bash
0 2 * * * /usr/local/bin/backup_rag.sh
```

---

## 10. Troubleshooting

### Check service status
```bash
sudo systemctl status rag-api
sudo journalctl -u rag-api -f
```

### Check PostgreSQL
```bash
sudo systemctl status postgresql
sudo tail -f /var/log/postgresql/postgresql-*.log
```

### Check Nginx
```bash
sudo nginx -t
sudo tail -f /var/log/nginx/rag-api-error.log
```

### Test API
```bash
curl http://localhost:8000/health
curl http://localhost:8000/status
```

---

## 11. Cost Estimation

**Monthly costs for moderate usage (1000 queries/day):**

- **Gemini API:** ~$2-5/month (Flash model is very cheap)
- **Server:** $20-80/month (DigitalOcean, AWS EC2, etc.)
- **PostgreSQL:** Included (self-hosted) or ~$15/month (managed)
- **Domain + SSL:** ~$1/month (Let's Encrypt is free)

**Total: ~$23-100/month** depending on server choice

---

## Support

For issues:
1. Check logs: `sudo journalctl -u rag-api -f`
2. Test components individually (PostgreSQL, embedding model, API)
3. Verify environment variables are set correctly
4. Check firewall and port configurations
