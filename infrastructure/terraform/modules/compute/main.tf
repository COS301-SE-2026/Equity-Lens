data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical, the official Ubuntu AMI owner ID

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }

}

data "aws_key_pair" "deploy" {
  key_name = var.key_pair_name
}

data "aws_security_group" "rds_access" {
  id = var.rds_security_group_id
}

locals {
  ecr_registry = split("/", var.backend_repository_url)[0]

  rendered_nginx_conf = templatefile("${path.module}/templates/nginx.conf.tpl", {
    frontend_port    = 3000
    backend_port     = 8000
    web_server_names = "equitylens.co.za www.equitylens.co.za"
    api_server_names = "api.equitylens.co.za"
  })

  user_data = templatefile("${path.module}/templates/user_data.sh.tpl", {
    aws_region              = var.aws_region
    ecr_registry             = local.ecr_registry
    backend_repository_url  = var.backend_repository_url
    frontend_repository_url = var.frontend_repository_url
    secret_names_newline     = join("\n", var.secret_names)
    certbot_email            = var.certbot_email
    nginx_conf               = local.rendered_nginx_conf
  })
}

resource "aws_instance" "app" {
  ami                         = data.aws_ami.ubuntu.id
  instance_type               = var.instance_type
  subnet_id                   = var.subnet_id
  vpc_security_group_ids      = [var.app_security_group_id, data.aws_security_group.rds_access.id]
  key_name                    = data.aws_key_pair.deploy.key_name
  iam_instance_profile        = var.iam_instance_profile_name
  associate_public_ip_address = true

  root_block_device {
    encrypted = true
  }

  user_data                   = local.user_data
  user_data_replace_on_change = true

  metadata_options {
    http_tokens   = "required"
    http_endpoint = "enabled"
  }

  tags = {
    Name        = "equitylens-app-${var.environment}"
    Environment = var.environment
  }
}