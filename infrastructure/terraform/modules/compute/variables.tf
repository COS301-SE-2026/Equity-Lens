variable "aws_region" {
  type = string
}

variable "environment" {
  type = string
}

variable "instance_type" {
  type = string
}

variable "subnet_id" {
  description = "from the networking module's output"
  type        = string
}

variable "app_security_group_id" {
  description = "from the security module's output"
  type        = string
}

variable "rds_security_group_id" {
  description = "ec2-rds-1, an existing security group shared with the current production instance (sg-0a2366186e858c5d3), attached by ID, never managed as a resource here"
  type        = string
}

variable "key_pair_name" {
  description = "name of an AWS key pair already registered outside Terraform - referenced by name, never generated or imported here so the private key never touches state"
  type        = string
}

variable "iam_instance_profile_name" {
  description = "from the iam module's output"
  type        = string
}

variable "backend_repository_url" {
  description = "from the ecr module's output"
  type        = string
}

variable "frontend_repository_url" {
  type = string
}

variable "secret_names" {
  description = "from the secrets module's output - full Secrets Manager names, e.g. equitylens/backend/DATABASE_URL. user_data derives the env-var name from the last path segment"
  type        = list(string)
}

variable "certbot_email" {
  description = "email for Let's Encrypt expiry notices. Optional - left empty by default rather than guessing a team address; user_data falls back to --register-unsafely-without-email when unset, which still issues and auto-renews certs, just without expiry-reminder emails"
  type        = string
  default     = ""
}