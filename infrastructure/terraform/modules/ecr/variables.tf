variable "backend_repository_name" {
  description = "must match the live BACKEND_ECR_REPOSITORY GitHub Actions variable exactly (deploy-backend.yml) - read it from GitHub Settings -> Actions -> Variables, don't guess."
  type        = string
}

variable "frontend_repository_name" {
  description = "must match the live FRONTEND_ECR_REPOSITORY GitHub Actions variable exactly (deploy-frontend.yml) - same caveat as backend_repository_name."
  type        = string
}

variable "untagged_image_expire_days" {
  description = "how many days an untagged image survives before the lifecycle policy expires it"
  type        = number
  default     = 14
}

variable "max_tagged_image_count" {
  description = "how many images (any tag status) the lifecycle policy keeps before expiring the oldest"
  type        = number
  default     = 15
}
