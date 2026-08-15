variable "secret_name_prefix" {
  description = "prefix every backend.env secret name gets, so these don't collide with anything else in the account and so ../iam's read policy can scope to this prefix instead of listing every ARN by hand"
  type        = string
  default     = "equitylens/backend/"
}
