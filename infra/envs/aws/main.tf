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
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.38"
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
  source = "git::https://github.com/SoftBank-Hackathon-2026-Team-Amethyst/one-tatchi-platform.git//modules/network/aws?ref=v2.11.0"

  name       = var.name
  cidr       = "10.0.0.0/16"
  az_count   = 2
  single_nat = true
}

module "cluster" {
  source = "git::https://github.com/SoftBank-Hackathon-2026-Team-Amethyst/one-tatchi-platform.git//modules/cluster/aws?ref=v2.11.0"

  name                = var.name
  kubernetes_version  = var.kubernetes_version
  network_id          = module.network.network_id
  subnet_ids          = module.network.private_subnet_ids
  node_instance_types = ["t3.medium"]
  node_count          = { min = 3, desired = 3, max = 5 } # Cluster Autoscaler가 Pending Pod에 맞춰 최대 5대까지 확장

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

# db_link 모듈의 Service 리소스용. helm provider와 같은 exec 인증.
provider "kubernetes" {
  host                   = module.cluster.endpoint
  cluster_ca_certificate = base64decode(module.cluster.ca_certificate)
  exec {
    api_version = "client.authentication.k8s.io/v1beta1"
    command     = "aws"
    args        = ["eks", "get-token", "--cluster-name", module.cluster.cluster_name, "--region", var.region]
  }
}

module "registry" {
  source = "git::https://github.com/SoftBank-Hackathon-2026-Team-Amethyst/one-tatchi-platform.git//modules/registry/aws?ref=v2.11.0"

  repositories = ["${var.service}-be", "${var.service}-fe"]
}

module "database" {
  source = "git::https://github.com/SoftBank-Hackathon-2026-Team-Amethyst/one-tatchi-platform.git//modules/database/aws?ref=v2.11.0"

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

# 승인자용 green 미리보기의 SSO 중계 (platform ADR 0015). 사용자는 Identity Center에만 있고 Cognito는 SAML → OIDC만 한다.
# 로그인할 수 있는 사람은 Identity Center 앱(관리 계정)에 할당한 그룹이다. 출력 preview_auth의 saml_*이 그 앱의 ACS URL · Audience다.
module "preview_auth" {
  source = "git::https://github.com/SoftBank-Hackathon-2026-Team-Amethyst/one-tatchi-platform.git//modules/preview_auth/aws?ref=v2.12.0"

  name              = "${var.service}-preview"
  domain_prefix     = "${var.service}-preview-${var.account_id}"
  callback_hosts    = concat(values(var.preview_hosts), values(var.onprem_preview_hosts))
  saml_metadata_url = var.preview_saml_metadata_url
  # PR plan(ReadOnlyAccess)이 시크릿 버전을 refresh할 수 있게 한다. plan 역할은 state에서 같은 값을 이미 읽는다.
  secret_reader_arns = [data.aws_iam_role.plan.arn]
}

module "cluster_addons" {
  source = "git::https://github.com/SoftBank-Hackathon-2026-Team-Amethyst/one-tatchi-platform.git//modules/cluster_addons/aws?ref=v2.11.0"

  cluster_name = module.cluster.cluster_name
  region       = var.region
  network_id   = module.network.network_id
  readable_secret_arns = concat(
    [module.database.credentials_secret_id, data.aws_secretsmanager_secret.slack_bot.arn, module.preview_auth.secret_id],
    [for s in data.aws_secretsmanager_secret.tailscale_oauth : s.arn],
    [for s in data.aws_secretsmanager_secret.db_link : s.arn],
  )
  dns_zone_id = data.aws_route53_zone.service.zone_id
}

module "observability" {
  source = "git::https://github.com/SoftBank-Hackathon-2026-Team-Amethyst/one-tatchi-platform.git//modules/observability/aws?ref=v2.11.0"

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
    # db_link에 적힌 환경은 RDS 대신 온프레미스 DB(tailnet 통로)를 쓴다 (T33). 접속 문자열 키 · 형식은 같다.
    database = contains(keys(var.db_link), each.key) ? {
      secretName = "${var.service}-db"
      remoteKey  = data.aws_secretsmanager_secret.db_link[each.key].name
      host       = module.db_link[0].consumed[each.key].host
      port       = module.db_link[0].consumed[each.key].port
      name       = var.db_link[each.key].database_name
      } : {
      secretName = "${var.service}-db"
      remoteKey  = module.database.credentials_secret_id
      host       = module.database.host
      port       = module.database.port
      name       = module.database.database_name
    }
  })]
}

# ---------- DB 링크 (T33): 지정한 환경의 앱이 온프레미스(맥북 k3d) Postgres를 tailnet으로 쓴다 ----------
# OAuth · DB 자격증명은 Secrets Manager에 사람이 넣고(콘솔 · CLI) Terraform은 ARN · 이름만 읽는다. 값은 External Secrets가 클러스터로 가져간다.
data "aws_secretsmanager_secret" "tailscale_oauth" {
  count = length(var.db_link) > 0 ? 1 : 0
  name  = var.tailscale_oauth_secret_name
}

data "aws_secretsmanager_secret" "db_link" {
  for_each = var.db_link
  name     = each.value.secret_name
}

# 네임스페이스 tailscale과 operator-oauth Secret(cloud-secrets → client_id · client_secret)
resource "helm_release" "tailscale_base" {
  count = length(var.db_link) > 0 ? 1 : 0

  name       = "tailscale-base"
  namespace  = "default"
  repository = "oci://ghcr.io/softbank-hackathon-2026-team-amethyst/charts"
  chart      = "service-base"
  version    = var.chart_version

  values = [yamlencode({
    namespace   = "tailscale"
    secretStore = module.cluster_addons.secret_store_name
    secret = {
      secretName = "operator-oauth"
      remoteKey  = var.tailscale_oauth_secret_name
    }
  })]
}

module "db_link" {
  source = "git::https://github.com/SoftBank-Hackathon-2026-Team-Amethyst/one-tatchi-platform.git//modules/db_link/tailscale?ref=v2.12.0"
  count  = length(var.db_link) > 0 ? 1 : 0

  cluster_name           = var.name
  tailnet                = var.tailnet
  create_oauth_secret    = false # tailscale_base가 External Secrets로 만든다
  manage_namespace       = false
  operator_chart_version = var.tailscale_operator_chart_version

  consume = {
    for env, link in var.db_link : env => {
      namespace = env
      name      = "${var.service}-db-onprem"
      fqdn      = link.fqdn
      # 그 환경의 BE 파드와 배포마다 도는 마이그레이션 Job 파드만 DB 포트에 닿는다 (NetworkPolicy, T33). 다른 네임스페이스 · 파드는 거부.
      # App Chart의 pre-upgrade 마이그레이션 Job 파드는 라벨이 없고 Kubernetes가 붙이는 batch.kubernetes.io/job-name만 있다.
      # 이 항목이 없으면 helm upgrade가 "pre-upgrade hooks failed: Job ... not ready"로 실패한다 (2026-10-11 run 38070479286).
      allow_from = [
        { namespace = env, pod_labels = { "app.kubernetes.io/name" = "${var.service}-be" } },
        { namespace = env, pod_labels = { "batch.kubernetes.io/job-name" = "${var.service}-be-migration" } },
      ]
    }
  }

  depends_on = [helm_release.tailscale_base]
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
    image          = { repository = "ghcr.io/softbank-hackathon-2026-team-amethyst/slack-bot", tag = var.slack_bot_image_version }
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
