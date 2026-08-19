output "instance_id" {
  value = aws_instance.app.id
}

output "public_ip" {
  description = "auto-assigned public IP for validating this instance in the next phase - not an Elastic IP, will change if the instance is stopped/started. No DNS points here yet, by design."
  value       = aws_instance.app.public_ip
}
