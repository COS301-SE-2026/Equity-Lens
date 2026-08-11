terraform {
  backend "s3" {
    bucket         = "equitylens-terraform-state-578377798340"
    key            = "equitylens/terraform.tfstate"
    region         = "af-south-1"
    dynamodb_table = "equitylens-terraform-locks"
    encrypt        = true
  }
}
