variable "github_org" {
  description = "GitHub org/user that owns the repo allowed to assume the deploy role"
  type        = string
}

variable "github_repo" {
  description = "repo name (without org) allowed to assume the deploy role"
  type        = string
}

variable "deploy_branch" {
  description = "branch the deploy role's trust policy is scoped to - both deploy-backend.yml and deploy-frontend.yml only trigger on push to this branch (on: push: branches: [main]), so the trust policy shouldn't allow more than that"
  type        = string
  default     = "main"
}

variable "ecr_repository_arns" {
  description = "ECR repository ARNs the deploy role gets push/pull on - passed in from the ecr module's output"
  type        = list(string)
}

variable "secret_arns" {
  description = "Secrets Manager ARNs the deploy role gets read on - passed in from the secrets module's output"
  type        = list(string)
}

variable "use_minimal_ssm_policy" {
  description = "false (default): attach AWS's own AmazonSSMManagedInstanceCore to the instance role. true: attach a narrower hand-written policy instead. See the comment above the relevant resources in main.tf for the tradeoff - default is false because the narrower policy couldn't be tested against live AWS."
  type        = bool
  default     = false
}

variable "aws_region" {
  description = "used to build the DynamoDB lock table ARN for the terraform_plan/terraform_apply roles - the state bucket/lock table names themselves are hardcoded in main.tf below, matching backend.tf's own reasoning for why those two values are literals rather than variables"
  type        = string
}
