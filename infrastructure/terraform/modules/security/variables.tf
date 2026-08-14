variable "vpc_id" {
  description = "VPC the security group is created in - from the networking module's output"
  type        = string
}

variable "environment" {
  description = "used only to name the security group distinctly"
  type        = string
}
