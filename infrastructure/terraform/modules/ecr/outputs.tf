output "backend_repository_arn" {
  value = aws_ecr_repository.backend.arn
}

output "frontend_repository_arn" {
  value = aws_ecr_repository.frontend.arn
}

output "repository_arns" {
  description = "both repository ARNs together - consumed by the iam module's push/pull policy, not re-declared there"
  value       = [aws_ecr_repository.backend.arn, aws_ecr_repository.frontend.arn]
}

output "backend_repository_url" {
  description = "pull/push URL for the backend repo - consumed by the compute module's user_data to know what image to run"
  value       = aws_ecr_repository.backend.repository_url
}

output "frontend_repository_url" {
  value = aws_ecr_repository.frontend.repository_url
}
