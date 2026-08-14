variable "vpc_id" {
  description = "existing VPC to launch into - the same one the current production instance runs in"
  type        = string
}

variable "subnet_id" {
  description = "existing subnet to launch into - the same one the current production instance runs in"
  type        = string
}

variable "availability_zone" {
  description = "AZ the subnet above is expected to be in - checked against the subnet's actual AZ as a sanity check, not used to select the subnet itself"
  type        = string
}
