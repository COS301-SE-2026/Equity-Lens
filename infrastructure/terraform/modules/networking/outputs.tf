output "vpc_id" {
  value = data.aws_vpc.main.id
}

output "subnet_id" {
  value = data.aws_subnet.app.id
}

output "vpc_cidr_block" {
  description = "not currently consumed anywhere, kept for when ../security needs to scope a rule to in-VPC traffic instead of a hardcoded CIDR"
  value       = data.aws_vpc.main.cidr_block
}
