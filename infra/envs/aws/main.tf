# AWS 루트. 플랫폼 모듈을 태그로 참조한다 (source = "git::https://github.com/SoftBank-Hackathon-2026-Team-Amethyst/one-tatchi-platform.git//modules/<기능>/aws?ref=v1.x.y").
# 모듈 구성은 T24에서 채운다. 지금은 GHA plan · apply 경로(OIDC · state)만 확인한다.
terraform {
  required_version = ">= 1.11"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }

  # bucket은 워크플로가 -backend-config로 넣는다 (vars.TF_STATE_BUCKET).
  backend "s3" {
    key          = "demo-app/aws.tfstate"
    region       = "ap-northeast-2"
    use_lockfile = true
    encrypt      = true
  }
}

provider "aws" {
  region = "ap-northeast-2"

  default_tags {
    tags = { Project = "one-tatchi", ManagedBy = "terraform", Stack = "demo-app" }
  }
}

data "aws_caller_identity" "current" {}

output "deployer_arn" {
  description = "이 루트를 실행한 역할 (plan · deploy 역할 확인용)"
  value       = data.aws_caller_identity.current.arn
}
