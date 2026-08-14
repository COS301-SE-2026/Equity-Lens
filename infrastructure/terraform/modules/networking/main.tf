
data "aws_vpc" "main" {
  id = var.vpc_id
}

data "aws_subnet" "app" {
  id = var.subnet_id

  lifecycle {
    postcondition {
      condition     = self.availability_zone == var.availability_zone
      error_message = "subnet ${var.subnet_id} is actually in ${self.availability_zone}, not ${var.availability_zone} - check for a copy-paste mismatch between subnet_id and availability_zone."
    }
  }
}
