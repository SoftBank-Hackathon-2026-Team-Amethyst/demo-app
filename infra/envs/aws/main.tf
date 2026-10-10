# 팀 공용 AWS 환경. state 버킷 · CI 역할 · DNS 존은 bootstrap에서 관리한다.
terraform {
  required_version = ">= 1.11"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 3.0"
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
  region              = var.region
  allowed_account_ids = [var.account_id]

  default_tags {
    tags = { Project = "one-tatchi", ManagedBy = "terraform", Stack = "demo-app" }
  }
}

data "aws_caller_identity" "current" {}

# bootstrap의 기존 CI 역할을 재사용한다.
data "aws_iam_role" "plan" {
  name = "one-tatchi-gha-plan"
}

data "aws_iam_role" "deploy" {
  name = "one-tatchi-gha-deploy"
}

# EKS access entry에는 STS 세션이 아닌 IAM 역할 ARN이 필요하다.
data "aws_iam_roles" "team_administrators" {
  name_regex  = "^AWSReservedSSO_AdministratorAccess_.*$"
  path_prefix = "/aws-reserved/sso.amazonaws.com/ap-northeast-2/"

  lifecycle {
    postcondition {
      condition     = length(self.arns) > 0
      error_message = "팀 AdministratorAccess SSO 역할이 없습니다. docs/aws-setup.md의 계정 설정을 확인하세요."
    }
  }
}

# Slack 봇(배포하는 우사기) 토큰과 GitHub App 키. 값은 콘솔에서 넣고 Terraform은 읽기만 한다 (T26).
data "aws_secretsmanager_secret" "slack_bot" {
  name = var.slack_bot_secret_name
}

data "aws_route53_zone" "service" {
  name         = var.domain_name
  private_zone = false
}

module "network" {
  source = "git::https://github.com/SoftBank-Hackathon-2026-Team-Amethyst/one-tatchi-platform.git//modules/network/aws?ref=v1.16.1"

  name       = var.name
  cidr       = "10.0.0.0/16"
  az_count   = 2
  single_nat = true
}

module "cluster" {
  source = "git::https://github.com/SoftBank-Hackathon-2026-Team-Amethyst/one-tatchi-platform.git//modules/cluster/aws?ref=v1.16.1"

  name                = var.name
  kubernetes_version  = var.kubernetes_version
  network_id          = module.network.network_id
  subnet_ids          = module.network.private_subnet_ids
  node_instance_types = ["t3.medium"]
  node_count          = { min = 3, desired = 3, max = 3 } # t3.medium은 노드당 파드 17개. 시스템 파드 + test · prod Blue-Green + 봇을 올리려면 3대

  admin_principal_arns = distinct(concat(
    [data.aws_iam_role.deploy.arn],
    sort(tolist(data.aws_iam_roles.team_administrators.arns)),
    var.additional_admin_principal_arns,
  ))
  viewer_principal_arns = [data.aws_iam_role.plan.arn]
}

provider "helm" {
  kubernetes = {
    host                   = module.cluster.endpoint
    cluster_ca_certificate = base64decode(module.cluster.ca_certificate)
    exec = {
      api_version = "client.authentication.k8s.io/v1beta1"
      command     = "aws"
      args        = ["eks", "get-token", "--cluster-name", module.cluster.cluster_name, "--region", var.region]
    }
  }
}

module "registry" {
  source = "git::https://github.com/SoftBank-Hackathon-2026-Team-Amethyst/one-tatchi-platform.git//modules/registry/aws?ref=v1.16.1"

  repositories = ["${var.service}-be", "${var.service}-fe"]
}

module "database" {
  source = "git::https://github.com/SoftBank-Hackathon-2026-Team-Amethyst/one-tatchi-platform.git//modules/database/aws?ref=v1.16.1"

  name                       = "${var.service}-db"
  database_name              = "demo"
  engine_version             = "17"
  instance_class             = "db.t4g.micro"
  storage_gb                 = 20
  multi_az                   = false
  network_id                 = module.network.network_id
  subnet_ids                 = module.network.private_subnet_ids
  allowed_security_group_ids = [module.cluster.node_security_group_id]
}

module "cluster_addons" {
  source = "git::https://github.com/SoftBank-Hackathon-2026-Team-Amethyst/one-tatchi-platform.git//modules/cluster_addons/aws?ref=v1.16.1"

  cluster_name         = module.cluster.cluster_name
  region               = var.region
  network_id           = module.network.network_id
  readable_secret_arns = [module.database.credentials_secret_id, data.aws_secretsmanager_secret.slack_bot.arn]
  dns_zone_id          = data.aws_route53_zone.service.zone_id
}

module "observability" {
  source = "git::https://github.com/SoftBank-Hackathon-2026-Team-Amethyst/one-tatchi-platform.git//modules/observability/aws?ref=v1.16.1"

  cluster_name   = module.cluster.cluster_name
  region         = var.region
  ingress_class  = module.cluster_addons.ingress_class
  ingress_group  = "${var.service}-prod"
  dashboard_host = var.domain_name
  central_metrics = {
    enabled              = true
    receiver_host        = "metrics.${var.domain_name}"
    receiver_secret_name = "deploy-metrics-auth"
  }
  gcp_monitoring = var.gcp_monitoring
}

# 환경별 네임스페이스와 DB 접속 Secret(cloud-secrets → <service>-db). 앱은 deploy.yml이 이 네임스페이스에 올린다.
# test · prod가 같은 RDS를 쓴다 (onprem은 환경별 DB).
resource "helm_release" "service_base" {
  for_each = toset(var.environments)

  name       = "${var.service}-base-${each.key}"
  namespace  = "default"
  repository = "oci://ghcr.io/softbank-hackathon-2026-team-amethyst/charts"
  chart      = "service-base"
  version    = var.chart_version

  values = [yamlencode({
    namespace   = each.key
    secretStore = module.cluster_addons.secret_store_name
    database = {
      secretName = "${var.service}-db"
      remoteKey  = module.database.credentials_secret_id
      host       = module.database.host
      port       = module.database.port
      name       = module.database.database_name
    }
  })]
}

# Slack 봇(T26). Socket Mode라 Ingress 없이 Slack으로 연결을 건다. 클러스터 권한은 없고, 버튼을 누르면 rollout 워크플로를 실행한다.
resource "helm_release" "slack_bot_base" {
  name       = "slack-bot-base"
  namespace  = "default"
  repository = "oci://ghcr.io/softbank-hackathon-2026-team-amethyst/charts"
  chart      = "service-base"
  version    = var.chart_version

  values = [yamlencode({
    namespace   = "slack-bot"
    secretStore = module.cluster_addons.secret_store_name
    secret = {
      secretName = "slack-bot-env"
      remoteKey  = var.slack_bot_secret_name
    }
  })]
}

resource "helm_release" "slack_bot" {
  name       = "slack-bot"
  namespace  = "slack-bot"
  repository = "oci://ghcr.io/softbank-hackathon-2026-team-amethyst/charts"
  chart      = "app"
  version    = var.chart_version

  # platform slack-bot/deploy/values.yaml과 같은 값
  values = [yamlencode({
    image          = { repository = "ghcr.io/softbank-hackathon-2026-team-amethyst/slack-bot", tag = var.chart_version }
    containerPort  = 8000
    replicas       = 1
    deployStrategy = "rolling"
    env = {
      GITHUB_REPOSITORY = "SoftBank-Hackathon-2026-Team-Amethyst/${var.service}"
      # platform v1.16.0 slack-bot/deploy/values.yaml의 팀원 허용 목록을 보존한다 (T26).
      ALLOWED_USER_IDS = jsonencode(["U0C4749LN6T", "U0C4RRYEK1Q", "U0C4R553BMK", "U0C6UD5BELR", "U0C4LGJTT46"])
    }
    envFromSecrets = ["slack-bot-env"]
    probe          = { path = "/health" }
  })]

  depends_on = [helm_release.slack_bot_base]
}
