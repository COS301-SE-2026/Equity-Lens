output "deploy_role_arn" {
  description = "the value the AWS_ROLE_ARN GitHub Actions secret should be updated to once this environment replaces the current one - not applied automatically, that update happens by hand in GitHub Settings"
  value       = aws_iam_role.deploy.arn
}

output "deploy_role_name" {
  description = "consumed at the repo root (ssm_deploy.tf) to attach an additional inline policy scoped to the compute module's instance ARN - can't live inside this module without creating a cycle between iam and compute, see ssm_deploy.tf for why"
  value       = aws_iam_role.deploy.name
}

output "oidc_provider_arn" {
  value = aws_iam_openid_connect_provider.github.arn
}

output "instance_profile_name" {
  description = "attach this to the new aws_instance in ../compute so it can read backend.env secrets at boot via IMDS, no static keys needed"
  value       = aws_iam_instance_profile.instance.name
}

output "terraform_plan_role_arn" {
  description = "paste this into the TERRAFORM_PLAN_ROLE_ARN GitHub Actions secret - .github/workflows/terraform-plan.yml assumes it via OIDC, read-only"
  value       = aws_iam_role.terraform_plan.arn
}

output "terraform_apply_role_arn" {
  description = "paste this into the TERRAFORM_APPLY_ROLE_ARN GitHub Actions secret - .github/workflows/terraform-apply.yml assumes it via OIDC, gated behind the terraform-apply GitHub Environment's required-reviewers rule"
  value       = aws_iam_role.terraform_apply.arn
}
