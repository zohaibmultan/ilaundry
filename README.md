# iLaundry &bull; Point-of-Sale & Laundry Management Platform

Complete multi-store laundry and dry cleaning operations management platform built with Node.js, Express, MySQL, and EJS. Features dedicated POS receipt printing, automated cloth wash tag generation with Code128 barcodes, multi-branch tracking, expense management, and customer ledgers.

---

## 🚀 Quick Specs

| Component | Technology / Spec |
|---|---|
| **Runtime & Backend** | Node.js (v18, v20, v22 LTS) &bull; Express.js &bull; EJS View Engine |
| **Database** | MySQL 5.7+ / MySQL 8.0+ / MariaDB (`utf8mb4`) |
| **Process Manager** | PM2 (`pm2-windows-startup` on Windows / `systemd` on Linux) &bull; Passenger (cPanel) |
| **Web Servers** | Microsoft IIS (Windows) &bull; Nginx &bull; Apache2 (Linux) &bull; CloudLinux LiteSpeed/Apache (cPanel) |
| **UI Framework** | Bootstrap 5, Liquid Glass Glassmorphism Theme, Server-side DataTables |
| **Printing Service** | POS Silent Printing Server (Local Daemon @ `http://127.0.0.1:4321`) |

---

## 📦 Prerequisites & Environment Setup

### 1. System Requirements
- **Node.js**: v18.x, v20.x, or v22.x LTS ([nodejs.org](https://nodejs.org/))
- **MySQL / MariaDB**: MySQL 5.7+, MySQL 8.0+, or MariaDB 10.4+
- **Git**: Installed on the server or workstation

### 2. Clone & Dependencies
```bash
# Clone repository
git clone https://github.com/zohaibmultan/ilaundry.git
cd ilaundry

# Install production and development dependencies
npm install
```

### 3. Environment Configuration (`config.env`)
Copy the sample environment file to `config.env` in the project root:

```bash
cp config.env.example config.env
```

Edit `config.env` with your environment parameters:

```env
PORT=5000
NODE_ENV=production
TOKEN_KEY=your_secure_jwt_token_key_here
TOKEN=your_language_token_key_here
DB_HOST="127.0.0.1"
DB_PORT=3306
DB_USER="root"
DB_PASSWORD="your_database_password"
DB_NAME="lndry"
DISABLE_DB_WRITE=false
```

### 4. Database Setup & Schema Import
Create the database with full UTF-8 Unicode support:

```sql
CREATE DATABASE lndry CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Import your SQL dump schema into the newly created database:

```bash
# Via terminal
mysql -u root -p -P 3306 lndry < database/lndry.sql
```

*(Or use phpMyAdmin / MySQL Workbench to import the schema file).*

---

## 🔑 Default Credentials

> [!WARNING]
> Change all default passwords immediately after initial deployment to any staging or production server.

| Role | Username | Password | Notes |
|---|---|---|---|
| **Admin** | `admin` | `123456` | Master Super Admin (full multi-store platform control) |
| **Manager** | `manager` | `123456` | Main Store Manager (full branch operations & reports) |
| **Order Delete** | `orderdelete` | `123456` | Main Store Staff with order deletion permissions |
| **Cashier** | `cashier` | `123456` | Main Store Counter Staff (POS billing & customer management) |
| **Customer** | `customer` | `123456` | Customer self-service order tracking portal |

---

## 💻 Local Development

Run locally on your development machine (Windows / macOS / Linux):

```bash
# Start development mode with auto-reload (nodemon)
npm start

# Or start plain Node process
node app.js
```
Open your browser and navigate to: `http://localhost:5000`

---

## 🖥️ Production Deployment 1: Windows OS with Microsoft IIS

Microsoft IIS serves as a high-performance reverse proxy in front of the Node.js application running on `http://127.0.0.1:5000`.

### Architecture
```
[ Incoming Request (Port 80 / 443) ]
               │
               ▼
   [ Microsoft IIS (Reverse Proxy) ]
               │ (Configured via web.config)
               ▼
[ Node.js via PM2 Service @ http://127.0.0.1:5000 ]
               │
               ▼
       [ MySQL Database (Port 3306) ]
```

### Step 1: Install Required IIS Modules
Ensure Windows Server has IIS installed, then download and install these two mandatory extensions:
1. **URL Rewrite Module 2.1**: [Download Microsoft URL Rewrite](https://www.iis.net/downloads/microsoft/url-rewrite)
2. **Application Request Routing (ARR) 3.0**: [Download ARR 3.0](https://www.iis.net/downloads/microsoft/application-request-routing)

### Step 2: Enable ARR Reverse Proxy in IIS
1. Open **IIS Manager** (`inetmgr.exe`).
2. Click on the root **Server Node** in the left navigation tree.
3. In the center pane, double-click **Application Request Routing Cache**.
4. In the right **Actions** pane, click **Server Proxy Settings...**.
5. Check $\boxed{\checkmark}$ **Enable proxy**.
6. Under **HTTP Version**, leave `Pass through` or `HTTP/1.1`.
7. Click **Apply** in the right Actions panel.

### Step 3: Configure Website in IIS
1. In IIS Manager, right-click **Sites** &rarr; **Add Website...** (or select the **Default Web Site**).
2. Set **Site name**: `iLaundry`.
3. Set **Physical path**: Path to the repository root directory (e.g. `C:\inetpub\wwwroot\ilaundry` or `E:\Products\Laragon_Laundary\www`).
4. Set **Binding**:
   - Type: `http` &bull; IP: `All Unassigned` &bull; Port: `80` &bull; Host name: `laundry.yourdomain.com` (or leave blank for IP-only).
5. Click **OK**.

### Step 4: Verify `web.config`
The repository includes a ready-to-use [`web.config`](web.config) at the root level. Ensure it contains the reverse proxy rules:

```xml
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <system.webServer>
    <!-- Allow file uploads up to 50MB -->
    <security>
      <requestFiltering>
        <requestLimits maxAllowedContentLength="52428800" />
      </requestFiltering>
    </security>

    <!-- Reverse Proxy all requests to local Node.js port 5000 -->
    <rewrite>
      <rules>
        <rule name="ReverseProxyToNode" stopProcessing="true">
          <match url="(.*)" />
          <action type="Rewrite" url="http://127.0.0.1:5000/{R:1}" />
        </rule>
      </rules>
    </rewrite>

    <!-- Pass Express status codes & error messages through to the browser -->
    <httpErrors existingResponse="PassThrough" />
  </system.webServer>
</configuration>
```

### Step 5: Grant Folder Permissions for Uploads
Express uploads customer avatars, store logos, and attachments into `public/uploads`. Grant write access to IIS application identity:

```powershell
# Open PowerShell as Administrator
icacls "public\uploads" /grant "IIS_IUSRS:(OI)(CI)M" /T
icacls "public\uploads" /grant "IUSR:(OI)(CI)M" /T
```

### Step 6: Run Node.js as a Windows Service with PM2
Keep Node.js running continuously in the background and surviving server reboots:

```powershell
# Install PM2 and the Windows startup utility globally
npm install -g pm2 pm2-windows-startup

# Register PM2 as a Windows background service
pm2-startup install

# Navigate to project root and start the application
cd "C:\inetpub\wwwroot\ilaundry"
pm2 start app.js --name "ilaundry"

# Save the process list to auto-start on boot
pm2 save
```

### Step 7: Configure SSL / HTTPS in IIS
1. In IIS Manager, select **Server Certificates** to import or create a certificate (or use [win-acme](https://www.win-acme.com/) for free automated Let's Encrypt SSL certificates).
2. Right-click your website &rarr; **Edit Bindings...** &rarr; **Add...**.
3. Type: `https`, Port: `443`, Select your SSL Certificate. Click **OK**.

### IIS Troubleshooting Guide
| Symptom | Cause | Resolution |
|---|---|---|
| **HTTP 500.19** | Missing URL Rewrite module | Download and install URL Rewrite 2.1 x64, then restart IIS (`iisreset`). |
| **HTTP 502.3 Bad Gateway** | Node.js process is stopped or ARR Proxy is disabled | 1. Ensure ARR "Enable proxy" is checked in Server Proxy Settings.<br>2. Check `pm2 status` to verify `ilaundry` is online. |
| **HTTP 404 Not Found on static assets** | Rewrite rule rewrite target mismatch | Ensure `web.config` has `{R:1}` capturing the full URI path to pass to Node. |
| **Uploads fail with 413 or 500** | Upload size exceeds IIS limit | Verify `<requestLimits maxAllowedContentLength="52428800" />` is active in `web.config`. |

---

## 🐧 Production Deployment 2: Linux OS with Nginx (Ubuntu / Debian / RHEL)

Production deployment on Linux using Nginx as a reverse proxy and PM2 as the systemd process daemon.

### Step 1: Install Node.js, Git, and Nginx
On **Ubuntu / Debian**:
```bash
# Update repositories
sudo apt update && sudo apt upgrade -y

# Install Node.js 20.x LTS via NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git nginx build-essential

# Verify versions
node -v
npm -v
```

On **RHEL / AlmaLinux / Rocky Linux**:
```bash
sudo dnf update -y
sudo dnf module enable nodejs:20 -y
sudo dnf install -y nodejs git nginx
```

### Step 2: Configure Firewall
Allow HTTP, HTTPS, and SSH traffic:
```bash
# Ubuntu UFW
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

### Step 3: Deploy Application & Install Dependencies
```bash
# Clone to web directory
sudo mkdir -p /var/www
cd /var/www
sudo git clone https://github.com/zohaibmultan/ilaundry.git
cd ilaundry

# Set ownership
sudo chown -R $USER:$USER /var/www/ilaundry

# Install dependencies
npm install --production

# Create and configure environment file
cp config.env.example config.env
nano config.env
```

### Step 4: Configure Upload Directory Permissions
```bash
sudo chown -R www-data:www-data /var/www/ilaundry/public/uploads
sudo chmod -R 775 /var/www/ilaundry/public/uploads
```

### Step 5: Start Node.js with PM2 and systemd
```bash
# Install PM2 globally
sudo npm install -g pm2

# Start the application on port 5000
pm2 start app.js --name "ilaundry"

# Generate and configure systemd startup script
pm2 startup systemd
# (Copy and execute the command line outputted by PM2 if prompted)

# Freeze process list for auto-boot
pm2 save
```

### Step 6: Create Nginx Reverse Proxy Configuration
Create a new server block configuration file:

```bash
sudo nano /etc/nginx/sites-available/ilaundry
```

Paste the following production Nginx configuration:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name laundry.yourdomain.com;

    # Allow up to 50MB file uploads for receipts & customer media
    client_max_body_size 50M;

    # Gzip Compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml image/svg+xml;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;

        # WebSocket & connection upgrade support
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';

        # Forwarded identity headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts for heavy reports
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;

        proxy_cache_bypass $http_upgrade;
    }

    # Serve static assets directly (optional optimization)
    location /public/ {
        alias /var/www/ilaundry/public/;
        expires 7d;
        add_header Cache-Control "public, max-age=604800";
    }
}
```

Enable site and test configuration:
```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/ilaundry /etc/nginx/sites-enabled/

# Test syntax
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

### Step 7: Secure with Free Let's Encrypt SSL
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d laundry.yourdomain.com
```
Certbot automatically configures HTTPS redirection and schedules auto-renewal via systemd timers.

### Linux Troubleshooting Guide
| Symptom | Cause | Resolution |
|---|---|---|
| **502 Bad Gateway** | Node.js process is down | Run `pm2 status` and `pm2 logs ilaundry`. Check if `config.env` has valid MySQL credentials. |
| **502 Bad Gateway (SELinux enabled)** | SELinux blocks Nginx network connections | On RHEL/AlmaLinux run: `sudo setsebool -P httpd_can_network_connect 1`. |
| **Permission Denied on uploads** | Nginx/Express cannot write to `public/uploads` | Run `sudo chown -R www-data:www-data /var/www/ilaundry/public/uploads && sudo chmod -R 775 /var/www/ilaundry/public/uploads`. |

---

## 🌐 Production Deployment 3: cPanel / CloudLinux (Shared & Cloud Hosting)

Most modern cPanel hosting providers (Namecheap, Hostinger, cPanel CloudLinux, A2 Hosting) support Node.js applications via the **"Setup Node.js App"** interface powered by CloudLinux / Phusion Passenger.

### Step 1: Create MySQL Database in cPanel
1. Log in to your **cPanel** dashboard.
2. Under the **Databases** category, click **MySQL® Database Wizard**.
3. Create a database (e.g. `cpaneluser_lndry`).
4. Create a database user (e.g. `cpaneluser_admin`) and generate a secure password.
5. Grant **ALL PRIVILEGES** to the user on this database.
6. Open **phpMyAdmin** from cPanel, select the database, click the **Import** tab, and import `lndry.sql`.

### Step 2: Upload Files to Hosting Account
You can deploy your code via Git or File Manager:
- **Method A (cPanel Git™ Version Control)**:
  1. In cPanel, click **Git™ Version Control**.
  2. Click **Create**, paste your repository clone URL, and set repository path to `/home/cpaneluser/ilaundry`.
  3. Click **Create** &bull; **Update from Remote**.
- **Method B (cPanel File Manager)**:
  1. On your local machine, zip the repository files (exclude `node_modules`).
  2. In cPanel **File Manager**, navigate to your home directory (`/home/cpaneluser/`).
  3. Create a folder named `ilaundry` (keep it outside `public_html` for maximum security).
  4. Upload and extract the zip file into `/home/cpaneluser/ilaundry`.

### Step 3: Configure `config.env`
In cPanel File Manager, edit or create `/home/cpaneluser/ilaundry/config.env`:

```env
PORT=5000
NODE_ENV=production
TOKEN_KEY=your_secure_random_key_here
TOKEN=your_language_random_key_here
DB_HOST="localhost"
DB_PORT=3306
DB_USER="cpaneluser_admin"
DB_PASSWORD="your_generated_password"
DB_NAME="cpaneluser_lndry"
DISABLE_DB_WRITE=false
```

### Step 4: Create Node.js Application via cPanel Interface
1. In cPanel, navigate to the **Software** section and click **Setup Node.js App**.
2. Click the **Create Application** button.
3. Fill in the application fields:
   - **Node.js version**: Select `20.x` (or `18.x` LTS).
   - **Application mode**: `Production`.
   - **Application root**: `ilaundry` (the relative folder path inside your home directory).
   - **Application URL**: Select your domain or subdomain (e.g., `laundry.yourdomain.com`).
   - **Application startup file**: `app.js`.
   - **Passenger log file**: (optional, e.g. `passenger.log`).
4. Click **Create** in the upper right.

### Step 5: Install Dependencies via NPM
1. After creating the app, cPanel will display a command to enter the Node.js virtual environment at the top of the page, for example:
   ```bash
   source /home/cpaneluser/nodevenv/ilaundry/20/bin/activate && cd /home/cpaneluser/ilaundry
   ```
2. You can install dependencies in one of two ways:
   - **Via cPanel Web UI**: Scroll to the **Detected configuration files** section, click on `package.json`, and click **Run NPM Install**.
   - **Via cPanel Terminal**: Open **Terminal** in cPanel, paste the `source ...` command from Step 1, and run:
     ```bash
     npm install --production
     ```

### Step 6: Configure `.htaccess`
When cPanel's Node.js App is assigned to a domain or subdomain, cPanel creates an `.htaccess` file inside the domain's document root (e.g., `public_html` or `public_html/laundry`).

Verify or add the Passenger directives inside `.htaccess`:

```apache
# DO NOT REMOVE. CLOUDLINUX PASSENGER CONFIGURATION BEGIN
PassengerAppRoot "/home/cpaneluser/ilaundry"
PassengerBaseURI "/"
PassengerNodejs "/home/cpaneluser/nodevenv/ilaundry/20/bin/node"
PassengerAppType node
PassengerStartupFile app.js
# DO NOT REMOVE. CLOUDLINUX PASSENGER CONFIGURATION END

# Enable URL Rewriting & Custom Headers
RewriteEngine On
RewriteRule ^$ http://127.0.0.1:5000/ [P,L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^(.*)$ http://127.0.0.1:5000/$1 [P,L]
```

### Step 7: Application Lifecycle & Restart
Whenever you edit code, update `.env`, or pull changes:
- In the cPanel **Setup Node.js App** page, click the **Restart** button.
- Alternatively, via terminal or file manager, create or touch the restart file:
  ```bash
  mkdir -p /home/cpaneluser/ilaundry/tmp
  touch /home/cpaneluser/ilaundry/tmp/restart.txt
  ```

### cPanel Troubleshooting Guide
| Symptom | Cause | Resolution |
|---|---|---|
| **Passenger error: "Cannot find module"** | `node_modules` not installed inside virtualenv | Run `npm install` inside the virtual environment using cPanel Terminal. |
| **Database Connection Error (ECONNREFUSED)** | Using `127.0.0.1` instead of `localhost` on shared MySQL socket | In `config.env`, set `DB_HOST="localhost"`. |
| **503 Service Unavailable** | Application crashed during startup | Check error details in `stderr.log` inside the application folder or examine the cPanel Error Log. |
| **Uploaded images missing after restart** | Permissions on `public/uploads` directory | In cPanel File Manager, ensure `public/uploads` has permissions set to `0755` or `0775`. |

---

## 🖨️ POS Silent Printing Server Integration

The system supports zero-click silent thermal printing via a local background daemon running on `http://127.0.0.1:4321`.

### 1. Dual-Printer Architecture
Configured in **Admin &bull; Master Settings &bull; POS Hardware Settings**:
- **Printer 1 (Invoice & POS Receipt)**: 80mm / 58mm thermal rolls with auto-cut and cash drawer kick options.
- **Printer 2 (Cloth Wash Tag)**: 50mm / 75mm / 80mm sticky/washable tags with individual Code128 barcodes.

### 2. POS Receipt Page Controls (`views/posprint.ejs`)
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
npm install --production     # If dependencies changed
pm2 reload ilaundry          # Zero-downtime reload on PM2
# Or on cPanel: touch tmp/restart.txt
```

### PM2 Process Monitoring
```bash
pm2 status                  # View uptime & memory consumption
pm2 logs ilaundry           # Live error/stdout stream
pm2 restart ilaundry        # Force restart
```

### Database Backup & Restore
```bash
# Backup
mysqldump -u root -p -P 3306 lndry > backup_$(date +%F).sql

# Restore
mysql -u root -p -P 3306 lndry < backup_2026-09-23.sql
```

---

## 📄 License & Support

&copy; iLaundry Platform. All rights reserved. For commercial inquiries and customization, contact the development team.
