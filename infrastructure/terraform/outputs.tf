output "deploy_role_arn" {
  description = "update the AWS_ROLE_ARN GitHub Actions secret to this value once this environment replaces the current one - not done automatically by Terraform"
  value       = module.iam.deploy_role_arn
}

output "ecr_repository_arns" {
  value = module.ecr.repository_arns
}

output "secret_arns" {
  description = "Secrets Manager slots created for backend.env - still need real values filled in out-of-band, Terraform only created the empty slots"
  value       = module.secrets.secret_arns
}

output "new_instance_public_ip" {
  description = "reach the new instance at this address to validate it (next phase) - no DNS points here yet, and it's not an Elastic IP so it'll change if the instance stops/starts"
  value       = module.compute.public_ip
}

output "new_instance_id" {
  value = module.compute.instance_id
}

output "terraform_plan_role_arn" {
  description = "paste into the TERRAFORM_PLAN_ROLE_ARN GitHub Actions secret - terraform-plan.yml references it, not created automatically there"
  value       = module.iam.terraform_plan_role_arn
}

output "terraform_apply_role_arn" {
  description = "paste into the TERRAFORM_APPLY_ROLE_ARN GitHub Actions secret - terraform-apply.yml references it, not created automatically there"
  value       = module.iam.terraform_apply_role_arn
}