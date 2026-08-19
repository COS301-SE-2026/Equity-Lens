variable "aws_region" {
  description = "AWS region everything is created in"
  type        = string
  default     = "af-south-1"
}

variable "environment" {
  description = "which environment this set of resources represents. Only production is a real deployed target right now - development stays local Docker Compose (SAS 5.1) and there is no staging AWS stack. Parameterized so a second environment could be described later without building one now."
  type        = string
  default     = "production"

  validation {
    condition     = contains(["development", "production"], var.environment)
    error_message = "environment must be \"development\" or \"production\" - those are the only two environments that actually exist per the SAS, no staging yet."
  }
}

variable "instance_type" {
  description = "EC2 instance type for the app host. Defaulted to a free-tier size - not confirmed to match the real running production instance type, don't assume it does."
  type        = string
  default     = "t3.micro"
}

variable "tags" {
  description = "tags applied to every resource via the provider's default_tags block"
  type        = map(string)
  default = {
    Project   = "EquityLens"
    Team      = "TB5"
    ManagedBy = "Terraform"
  }
}

variable "github_org" {
  description = "GitHub org that owns this repo, used to scope the iam module's OIDC trust policy"
  type        = string
  default     = "COS301-SE-2026"
}

variable "github_repo" {
  description = "repo name (without org), used to scope the iam module's OIDC trust policy"
  type        = string
  default     = "Equity-Lens"
}

variable "backend_ecr_repository_name" {
  description = "must match the live BACKEND_ECR_REPOSITORY GitHub Actions variable exactly - read it from GitHub Settings -> Actions -> Variables on the real repo. No default on purpose: guessing this wrong would make the ecr module create a second, wrong repository instead of adopting the real one via imports.tf."
  type        = string
}

variable "frontend_ecr_repository_name" {
  description = "must match the live FRONTEND_ECR_REPOSITORY GitHub Actions variable exactly - same caveat as backend_ecr_repository_name."
  type        = string
}

variable "vpc_id" {
  description = "VPC the new instance launches into - same as current production"
  type        = string
  default     = "vpc-0f7e42a91d611b645"
}

variable "subnet_id" {
  description = "subnet the new instance launches into - same as current production"
  type        = string
  default     = "subnet-05821aad112942f72"
}

variable "availability_zone" {
  description = "AZ the subnet above is expected to be in - checked in the networking module as a sanity check"
  type        = string
  default     = "af-south-1b"
}

variable "rds_security_group_id" {
  description = "ec2-rds-1 - existing security group the current production instance is also a member of, for database connectivity. Attached to the new instance in addition to its own new SG - see modules/compute/main.tf for how this group's rule shape is handled."
  type        = string
  default     = "sg-0a2366186e858c5d3"
}

variable "key_pair_name" {
  description = "name of an AWS key pair already registered outside Terraform - referenced by name only, never generated here"
  type        = string
  default     = "equitylens-prod-new"
}

variable "certbot_email" {
  description = "optional email for Let's Encrypt expiry notices - left empty by default, see modules/compute/variables.tf"
  type        = string
  default     = ""
}

variable "use_minimal_ssm_policy" {
  description = "false (default): the instance role gets AWS's AmazonSSMManagedInstanceCore managed policy. true: a narrower hand-written policy instead - untested against live AWS, validate it actually works before flipping. See modules/iam/main.tf for the full tradeoff."
  type        = bool
  default     = false
}