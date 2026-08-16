module "networking" {
  source = "./modules/networking"

  vpc_id            = var.vpc_id
  subnet_id         = var.subnet_id
  availability_zone = var.availability_zone
}

module "security" {
  source = "./modules/security"

  vpc_id      = module.networking.vpc_id
  environment = var.environment
}

module "ecr" {
  source = "./modules/ecr"

  backend_repository_name  = var.backend_ecr_repository_name
  frontend_repository_name = var.frontend_ecr_repository_name
}

module "secrets" {
  source = "./modules/secrets"
}

module "iam" {
  source = "./modules/iam"

  github_org             = var.github_org
  github_repo            = var.github_repo
  ecr_repository_arns    = module.ecr.repository_arns
  secret_arns            = module.secrets.secret_arns
  use_minimal_ssm_policy = var.use_minimal_ssm_policy
  aws_region             = var.aws_region
}

module "compute" {
  source = "./modules/compute"

  aws_region                = var.aws_region
  environment               = var.environment
  instance_type             = var.instance_type
  subnet_id                 = module.networking.subnet_id
  app_security_group_id     = module.security.security_group_id
  rds_security_group_id     = var.rds_security_group_id
  key_pair_name             = var.key_pair_name
  iam_instance_profile_name = module.iam.instance_profile_name
  backend_repository_url    = module.ecr.backend_repository_url
  frontend_repository_url   = module.ecr.frontend_repository_url
  secret_names              = module.secrets.secret_names
  certbot_email             = var.certbot_email
}