#!/usr/bin/env bash
# Read-only audit for the eztopup VPS. Makes no changes.
# Usage:  ssh deploy@161.97.130.68 'bash -s' < docs/audits/vps-audit.sh
set +e
SEC=""
if sudo -n true 2>/dev/null; then SEC="sudo -n"; echo "mode: sudo passwordless"; else echo "mode: TANPA sudo (bagian bertanda [sudo] dilewati)"; fi

echo
echo "== 1. SISTEM =="
hostnamectl 2>/dev/null | sed -n '1,6p' || uname -a
echo "uptime: $(uptime -p 2>/dev/null)"
echo "reboot-required: $([ -f /var/run/reboot-required ] && echo YA || echo tidak)"
echo "updates tersedia: $($SEC apt-get -s upgrade 2>/dev/null | grep -c '^Inst')"
echo "updates keamanan:"
$SEC apt-get -s upgrade 2>/dev/null | grep -E "^Inst .*(security|Security)" | head -10
echo "unattended-upgrades: $(systemctl is-enabled unattended-upgrades 2>/dev/null)"
echo "disk: $(df -h / | tail -1)"
free -h 2>/dev/null | sed -n '1,2p'
echo "time sync: $(timedatectl 2>/dev/null | grep -i 'synchronized')"

echo
echo "== 2. SSH [sudo] =="
$SEC sshd -T 2>/dev/null | grep -E "^(permitrootlogin|passwordauthentication|pubkeyauthentication|permitemptypasswords|port|allowusers|x11forwarding|maxauthtries)"
echo "uid 0: $(awk -F: '$3==0{print $1}' /etc/passwd | tr '\n' ' ')"
echo "shell login: $(awk -F: '$7 !~ /(nologin|false)$/{print $1}' /etc/passwd | tr '\n' ' ')"
echo "grup sudo/adm: $(getent group sudo adm 2>/dev/null | cut -d: -f1,4 | tr '\n' ' ')"
echo "failed ssh 24h: $($SEC journalctl -u ssh --since '24 hours ago' 2>/dev/null | grep -ci 'failed password')"

echo
echo "== 3. FIREWALL [sudo] =="
$SEC ufw status verbose 2>/dev/null | sed -n '1,12p'
echo "--- port mendengarkan (non-loopback) ---"
ss -tulpn 2>/dev/null | grep -vE '127\.0\.0\.1|\[::1\]' | head -20
echo "--- fail2ban ---"
echo "active: $(systemctl is-active fail2ban 2>/dev/null)"
$SEC fail2ban-client status 2>/dev/null | head -5

echo
echo "== 4. NGINX / TLS =="
nginx -v 2>&1
$SEC nginx -T 2>/dev/null | grep -E "ssl_protocols|ssl_ciphers|add_header (Strict|X-|Content-Security|Referrer)|proxy_set_header|client_max_body_size|listen 443|server_name" | sed 's/^[[:space:]]*//' | sort -u | head -40
echo "--- cert ---"
echo | openssl s_client -connect 127.0.0.1:443 -servername eztopup.io 2>/dev/null | openssl x509 -noout -subject -dates 2>/dev/null
echo "--- nginx error log ringkas ---"
$SEC tail -300 /var/log/nginx/error.log 2>/dev/null | awk '{print $9,$10,$11,$12}' | sort | uniq -c | sort -rn | head -8

echo
echo "== 5. POSTGRES [sudo] =="
ss -ltn 2>/dev/null | grep 5432
$SEC grep -hE "^(listen_addresses|port)" /etc/postgresql/*/main/postgresql.conf 2>/dev/null
$SEC grep -vhE "^\s*#|^\s*$" /etc/postgresql/*/main/pg_hba.conf 2>/dev/null | tail -12
echo "--- backup terjadwal ---"
crontab -l 2>/dev/null | grep -iE 'pg_dump|backup'
$SEC ls -lh /var/backups 2>/dev/null | tail -6

echo
echo "== 6. APLIKASI =="
pm2 list
echo "--- env app: hanya NAMA variabel rahasia (nilai tidak dicetak) ---"
pm2 jlist 2>/dev/null | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{JSON.parse(s).forEach(p=>{const e=p.pm2_env.env||{};const k=Object.keys(e).filter(x=>/SUPPLIER|SECRET|TOKEN|_KEY|DATABASE_URL/.test(x));console.log(p.name,'| cwd='+p.pm2_env.pm_cwd,'| restarts='+p.pm2_env.restart_time,'| env-rahasia-dari-PM2='+(k.length?k.join(','):'tidak ada'))})}catch(e){console.log('n/a')}})"
echo "--- izin file rahasia ---"
ls -l /var/www/eztu/.env /var/www/eztu/apps/web/.env 2>/dev/null
echo "--- jumlah baris + key duplikat ---"
for f in /var/www/eztu/.env /var/www/eztu/apps/web/.env; do
  [ -f "$f" ] && echo "$f: $(grep -cE '^[A-Z_]+=' "$f") baris | duplikat: $(grep -oE '^[A-Z_]+=' "$f" | sort | uniq -d | tr '\n' ' ')"
done
echo "--- git di VPS ---"
cd /var/www/eztu 2>/dev/null && { git log -1 --format='%h %ci %s'; echo "uncommitted:"; git status --porcelain | head -10; echo "branch: $(git rev-parse --abbrev-ref HEAD)"; }

echo
echo "== 7. LOG APLIKASI =="
pm2 logs eztu --lines 300 --nostream 2>/dev/null | grep -oE "Error [A-Za-z]+|SupplierApiError|ERR_[A-Z_]+" | sort | uniq -c | sort -rn | head -10
echo "--- probe mencurigakan di access log [sudo] ---"
$SEC grep -acE "/(\.env|wp-admin|wp-login|\.git|phpmyadmin)" /var/log/nginx/access.log 2>/dev/null
echo "--- cron deploy ---"
crontab -l 2>/dev/null | grep -v '^#' | head
echo
echo "== SELESAI — tidak ada perubahan yang dibuat =="
