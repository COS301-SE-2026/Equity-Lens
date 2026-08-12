set -uxo pipefail
exec > >(tee -a /var/log/equitylens-bootstrap.log) 2>&1
echo "equitylens bootstrap starting $(date -u)"

apt-get update -y
apt-get install -y ca-certificates curl gnupg unzip nginx certbot python3-certbot-nginx

install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  > /etc/apt/sources.list.d/docker.list
apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
systemctl enable --now docker
usermod -aG docker ubuntu

curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o /tmp/awscliv2.zip
unzip -q /tmp/awscliv2.zip -d /tmp
/tmp/aws/install
rm -rf /tmp/awscliv2.zip /tmp/aws

snap install amazon-ssm-agent --classic \
  || echo "note: amazon-ssm-agent snap install skipped (already present, or this AMI doesn't support snap - check manually if the enable step below also fails)" >&2
systemctl enable --now snap.amazon-ssm-agent.amazon-ssm-agent.service \
  || echo "warn: could not enable amazon-ssm-agent - SSM Run Command deploys will not reach this host until this is fixed" >&2

cat > /etc/nginx/sites-available/equitylens.conf <<'NGINX_CONF'
${nginx_conf}
NGINX_CONF
rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/equitylens.conf /etc/nginx/sites-enabled/equitylens.conf
nginx -t && systemctl reload nginx

: > /home/ubuntu/backend.env
chmod 600 /home/ubuntu/backend.env

set +x
while IFS= read -r secret_name; do
  [ -z "$secret_name" ] && continue
  var_name=$(basename "$secret_name")
  value=$(aws secretsmanager get-secret-value --region ${aws_region} --secret-id "$secret_name" --query SecretString --output text 2>/dev/null) \
    || { echo "warn: could not fetch $secret_name yet - still a placeholder, or IAM propagation lag" >&2; continue; }
  echo "$var_name=$value" >> /home/ubuntu/backend.env
done <<'SECRET_NAMES_EOF'
${secret_names_newline}
SECRET_NAMES_EOF
set -x
chown ubuntu:ubuntu /home/ubuntu/backend.env
           ---
aws ecr get-login-password --region ${aws_region} | docker login --username AWS --password-stdin ${ecr_registry}

docker pull ${backend_repository_url}:latest
docker pull ${frontend_repository_url}:latest

docker run --rm --env-file /home/ubuntu/backend.env ${backend_repository_url}:latest alembic upgrade head \
  || echo "warn: alembic upgrade head failed - expected until DATABASE_URL secret has a real value" >&2

docker stop equity-lens-backend >/dev/null 2>&1 || true
docker rm equity-lens-backend >/dev/null 2>&1 || true
docker run -d --name equity-lens-backend --restart unless-stopped -p 8000:8000 --env-file /home/ubuntu/backend.env ${backend_repository_url}:latest \
  || echo "warn: backend container failed to start - re-check /home/ubuntu/backend.env once real secrets are populated" >&2

docker stop equity-lens-frontend >/dev/null 2>&1 || true
docker rm equity-lens-frontend >/dev/null 2>&1 || true
docker run -d --name equity-lens-frontend --restart unless-stopped -p 3000:8080 ${frontend_repository_url}:latest \
  || echo "warn: frontend container failed to start" >&2

%{ if certbot_email != "" }
certbot --nginx -d equitylens.co.za -d www.equitylens.co.za -d api.equitylens.co.za \
  --non-interactive --agree-tos -m ${certbot_email} \
  || echo "warn: certbot issuance failed, expected on first boot, DNS doesn't point here yet" >&2
%{ else }
certbot --nginx -d equitylens.co.za -d www.equitylens.co.za -d api.equitylens.co.za \
  --non-interactive --agree-tos --register-unsafely-without-email \
  || echo "warn: certbot issuance failed, expected on first boot, DNS doesn't point here yet" >&2
%{ endif }
systemctl enable --now certbot.timer

echo "equitylens bootstrap finished $(date -u)"