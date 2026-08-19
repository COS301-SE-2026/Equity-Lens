data "aws_iam_policy_document" "deploy_ssm_permissions" {
  statement {
    effect    = "Allow"
    actions   = ["ec2:DescribeInstances"]
    resources = ["*"]
  }

  statement {
    effect  = "Allow"
    actions = ["ssm:SendCommand"]
    resources = [
      "arn:aws:ec2:${var.aws_region}:${data.aws_caller_identity.current.account_id}:instance/${module.compute.instance_id}",
      "arn:aws:ssm:${var.aws_region}::document/AWS-RunShellScript",
    ]
  }

  statement {
    effect    = "Allow"
    actions   = ["ssm:GetCommandInvocation", "ssm:ListCommandInvocations"]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "deploy_ssm" {
  name   = "equitylens-deploy-ssm-run-command"
  role   = module.iam.deploy_role_name
  policy = data.aws_iam_policy_document.deploy_ssm_permissions.json
}
