resource "aws_security_group" "app" {
  name_prefix = "equitylens-app-${var.environment}-"
  description = "new-environment app host: 80/443 public, no inbound SSH, no direct container port exposure"
  vpc_id      = var.vpc_id

  tags = {
    Name = "equitylens-app-${var.environment}"
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_security_group_rule" "http" {
  type              = "ingress"
  security_group_id = aws_security_group.app.id
  from_port         = 80
  to_port           = 80
  protocol          = "tcp"
  cidr_blocks       = ["0.0.0.0/0"]
  description       = "nginx - plain HTTP (serves the ACME challenge and redirects to HTTPS once certbot has issued a cert)"

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_security_group_rule" "https" {
  type              = "ingress"
  security_group_id = aws_security_group.app.id
  from_port         = 443
  to_port           = 443
  protocol          = "tcp"
  cidr_blocks       = ["0.0.0.0/0"]
  description       = "nginx - TLS"

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_security_group_rule" "egress_all" {
  type              = "egress"
  security_group_id = aws_security_group.app.id
  from_port         = 0
  to_port           = 0
  protocol          = "-1"
  cidr_blocks       = ["0.0.0.0/0"]
  description       = "outbound - Cognito, Bedrock, yfinance, Alpha Vantage, NewsData, ECR and Secrets Manager are all reached over arbitrary HTTPS destinations, not worth restricting at this scale"

  lifecycle {
    create_before_destroy = true
  }
}