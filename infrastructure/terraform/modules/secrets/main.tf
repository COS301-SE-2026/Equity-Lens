locals {
  backend_env_vars = [
    "NEWSDATA_API_KEY",
    "DATABASE_URL",
    "SECRET_KEY",
    "ALGORITHM",
    "ACCESS_TOKEN_EXPIRE_MINUTES",
    "AWS_REGION",
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "AWS_COGNITO_USER_POOL_ID",
    "AWS_COGNITO_CLIENT_ID",
    "ALPHA_VANTAGE_API_KEY",
    "ALLOW_LIVE_MARKET_FALLBACK",
    "BEDROCK_MODEL",
    "MARKET_DATA_REFRESH_TTL_HOURS",
    "CORS_ORIGINS",
    "MARKET_API_KEY",
  ]
}

resource "aws_secretsmanager_secret" "backend_env" {
  for_each = toset(local.backend_env_vars)

  name        = "${var.secret_name_prefix}${each.value}"
  description = "placeholder slot for backend.env's ${each.value} - value set out-of-band by a human, never by Terraform"
}

removed {
  from = aws_secretsmanager_secret_version.backend_env

  lifecycle {
    destroy = false
  }
}
