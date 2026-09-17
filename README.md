# iLaundry &bull; Point-of-Sale & Laundry Management Platform

Complete multi-store laundry and dry cleaning operations management platform built with Node.js, Express, MySQL, and EJS. Features dedicated POS receipt printing, automated cloth wash tag generation with Code128 barcodes, multi-branch tracking, expense management, and customer ledgers.

---

## 🚀 Quick Specs

| Component | Technology / Spec |
|---|---|
| **Runtime & Backend** | Node.js (v18, v20, v22 LTS) &bull; Express.js &bull; EJS |
| **Database** | MySQL 5.7+ / MySQL 8.0+ / MariaDB (`utf8mb4`) |
| **Process Manager** | PM2 (`pm2-windows-startup` on Windows / `systemd` on Linux) |
| **Web Servers** | Microsoft IIS (Windows) &bull; Nginx &bull; Apache2 (Linux) |
| **Printing Service** | POS Silent Printing Server (Daemon @ `http://127.0.0.1:4321`) |

---

## 📦 Installation & Local Development

### 1. Prerequisites
- **Node.js**: v18.x, v20.x, or v22.x LTS ([nodejs.org](https://nodejs.org/))
- **MySQL Server**: Running locally or accessible remotely
- **Git**: Installed on system

### 2. Setup Steps

```bash
# 1. Clone repository
git clone https://github.com/zohaibmultan/ilaundry.git
cd ilaundry

# 2. Install dependencies
npm install

# 3. Create environment file
cp config.env.example config.env
```

### 3. Configure Database (`config.env`)

Edit `config.env` with your MySQL credentials:

```env
PORT=5000
NODE_ENV=production
TOKEN_KEY=your_secure_jwt_token_key_here
TOKEN=your_language_token_key_here
DB_HOST="127.0.0.1"
DB_PORT=3306
DB_USER="root"
DB_PASSWORD="your_password"
DB_NAME="lndry"
DISABLE_DB_WRITE=false
```

### 4. Database Import

Create the database and import your schema:

```sql
CREATE DATABASE lndry CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

```bash
# Import schema via terminal (if you have SQL dump file)
mysql -u root -p -P 3306 lndry < path/to/dump.sql
```

### 5. Start Application

```bash
# Development (with auto-restart via nodemon)
npm start

# Production standalone
node app.js
```
Access in browser: `http://localhost:5000`

---

## 🔑 Default Credentials

> [!WARNING]
> Change default passwords immediately after deploying to production.

| Role | Username | Password | Notes |
|---|---|---|---|
| **Master Admin** | `admin` | `12344556` (or `1234`) | Full platform and multi-store control |
| **Store Manager** | `meera` | `123` | Store branch operational management |
| **Store Branch** | `trinity` | `123` | Branch order processing |
| **Customer** | `watson` | `123` | Customer portal |

---

## 🖥️ Windows Server IIS Deployment

### Architecture
```
[ Incoming Request (Port 80/443) ]
               │
               ▼
   [ Microsoft IIS (Reverse Proxy) ]
               │ (Reads pre-packaged web.config)
               ▼
[ PM2 Service @ http://127.0.0.1:5000 ]
               │
               ▼
       [ MySQL Database ]
```

### Step 1: Install Required IIS Modules
1. **URL Rewrite Module 2.1**: [Download URL Rewrite](https://www.iis.net/downloads/microsoft/url-rewrite)
2. **Application Request Routing (ARR) 3.0**: [Download ARR 3.0](https://www.iis.net/downloads/microsoft/application-request-routing)

### Step 2: Enable ARR Proxy (Critical)
1. Open **IIS Manager** (`inetmgr`).
2. Click top **Server Node** in left tree.
3. Open **Application Request Routing Cache** &bull; Click **Server Proxy Settings...** in right pane.
4. Check **Enable proxy** $\boxed{\checkmark}$ &bull; Click **Apply**.

### Step 3: Map Website to Folder
1. In IIS Manager, create or edit website (e.g. `iLaundry`).
2. Set **Physical Path** to repository root (e.g. `C:\inetpub\wwwroot\ilaundry`).
3. Set Binding: Port `80` (or `443` with SSL).
4. IIS automatically detects [`web.config`](web.config) (pre-configured with reverse proxy to `127.0.0.1:5000` and 50MB file upload limit).

### Step 4: Grant Upload Folder Permissions
```powershell
icacls "public\uploads" /grant "IIS_IUSRS:(OI)(CI)M" /T
icacls "public\uploads" /grant "IUSR:(OI)(CI)M" /T
```

### Step 5: Keep Node Running 24/7 with PM2
```powershell
npm install -g pm2 pm2-windows-startup
pm2-startup install
pm2 start app.js --name "ilaundry"
pm2 save
```

---

## 🐧 Linux Server Deployment (Ubuntu / Debian / RHEL)

### 1. Setup Node.js & PM2
```bash
# Install PM2 process manager
sudo npm install -g pm2

# Start application and configure auto-start on server boot
pm2 start app.js --name "ilaundry"
pm2 startup
pm2 save

# Permissions for upload directory
sudo chown -R www-data:www-data public/uploads
sudo chmod -R 775 public/uploads
```

---

### 2. Web Server Configuration

#### Option A: Nginx (Recommended)

Create `/etc/nginx/sites-available/ilaundry`:

```nginx
server {
    listen 80;
    server_name laundry.yourdomain.com;

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Enable site & test config
sudo ln -s /etc/nginx/sites-available/ilaundry /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# Install free SSL certificate (Let's Encrypt)
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d laundry.yourdomain.com
```

---

#### Option B: Apache2

Enable required modules:
```bash
sudo a2enmod proxy proxy_http proxy_wstunnel rewrite ssl headers
```

Create `/etc/apache2/sites-available/ilaundry.conf`:

```apache
<VirtualHost *:80>
    ServerName laundry.yourdomain.com
    LimitRequestBody 52428800

    ProxyPreserveHost On
    ProxyPass / http://127.0.0.1:5000/
    ProxyPassReverse / http://127.0.0.1:5000/

    RequestHeader set X-Forwarded-Proto "http"
</VirtualHost>
```

```bash
# Enable site & restart
sudo a2ensite ilaundry.conf
sudo systemctl reload apache2

# Install free SSL certificate (Let's Encrypt)
sudo apt install -y certbot python3-certbot-apache
sudo certbot --apache -d laundry.yourdomain.com
```

---

## 🖨️ POS Silent Printing Server Integration

The system supports zero-click silent thermal printing via a local background daemon running on `http://127.0.0.1:4321`.

### 1. Dual-Printer Architecture
Configured in **Admin &bull; Master Settings &bull; POS Hardware Settings**:
- **Printer 1 (Invoice & POS Receipt)**: 80mm / 58mm thermal rolls with auto-cut and cash drawer kick options.
- **Printer 2 (Cloth Wash Tag)**: 50mm / 75mm / 80mm sticky/washable tags with individual Code128 barcodes.

### 2. POS Receipt Page Manual Controls (`views/posprint.ejs`)
- **Suppressed Auto-Print**: Receipt page loads without popping up annoying browser print dialogs.
- **Live Status Badge**: Live pill indicator showing `🟢 Online` or `🔴 Offline` with auto-ping health checks every 25 seconds.
- **Button 1 (Print Invoice)**: Dispatches customer receipt to Printer 1.
- **Button 2 (Print Cloth Tag)**: Generates high-density vector barcodes per piece (`1/n`, `2/n`) and sends directly to Printer 2.
- **Button 3 (Cancel)**: Safely navigates back to previous order/POS screen.
- **Graceful Fallback**: If the local printing daemon is offline, clicking either button seamlessly routes the print job through standard browser native print (`window.print()`).

### 3. Printing Server Daemon Startup
```bash
cd printing-server
npm install
node server-standalone.js    # Run headless service on Port 4321
# OR
npm start                    # Run Electron app with system tray icon
```

---

## 🛠️ Operations & Maintenance

### Deploying Updates from GitHub
```bash
git pull origin main
pm2 reload ilaundry
```

### PM2 Process Monitoring
```bash
pm2 status                  # View uptime & memory
pm2 logs ilaundry           # Live error/stdout stream
pm2 restart ilaundry        # Force restart
```

### Database Backup & Restore
```bash
# Backup
mysqldump -u root -p -P 3306 lndry > backup_$(date +%F).sql

# Restore
mysql -u root -p -P 3306 lndry < backup_2026-09-17.sql
```

### Common Pitfalls & Checklist
1. **HTTP 500 URL Rewrite Error (IIS)**: Ensure `web.config` does not contain unregistered `<serverVariables>`.
2. **HTTP 502 / 404 (IIS)**: Verify **ARR "Enable proxy"** is checked in IIS Manager.
3. **Custom MySQL Port**: Configurable in `config.env` as `DB_PORT=3307`. Check console on startup:
   `✅ [Database] Successfully connected to MySQL at 127.0.0.1:3307/lndry`.
4. **Image Uploads Failing**: Ensure write permissions (`IIS_IUSRS` on Windows or `www-data` on Linux) are granted on `public/uploads`.
