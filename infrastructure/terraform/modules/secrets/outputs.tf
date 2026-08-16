output "secret_arns" {
  description = "ARNs of every backend.env secret slot - consumed by the iam module's read policy, not re-declared there"
  value       = [for s in aws_secretsmanager_secret.backend_env : s.arn]
}

output "secret_names" {
  description = "full Secrets Manager names (with prefix) - for reference when wiring these into a future deploy step"
  value       = [for s in aws_secretsmanager_secret.backend_env : s.name]
}
