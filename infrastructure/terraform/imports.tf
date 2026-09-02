import {
  to = module.ecr.aws_ecr_repository.backend
  id = var.backend_ecr_repository_name
}

import {
  to = module.ecr.aws_ecr_repository.frontend
  id = var.frontend_ecr_repository_name
}

data "aws_caller_identity" "current" {}

import {
  to = module.iam.aws_iam_openid_connect_provider.github
  id = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:oidc-provider/token.actions.githubusercontent.com"
}

import {
  to = module.secrets.aws_secretsmanager_secret.backend_env["MARKET_API_KEY"]
  id = "equitylens/backend/MARKET_API_KEY"
}