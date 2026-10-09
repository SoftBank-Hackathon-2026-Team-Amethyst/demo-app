# 온프레미스(맥북) 루트. 플랫폼 모듈을 태그로 참조한다.
# state는 이 맥북에만 둔다 (로컬 backend, .gitignore). 맥북 밖으로 나가지 않는다.
terraform {
  required_version = ">= 1.6"
}

module "cluster" {
  source = "git::https://github.com/SoftBank-Hackathon-2026-Team-Amethyst/one-tatchi-platform.git//modules/cluster/onprem?ref=v1.8.0"
  name   = var.name
}

provider "kubernetes" {
  host                   = module.cluster.endpoint
  cluster_ca_certificate = base64decode(module.cluster.ca_certificate)
  client_certificate     = base64decode(module.cluster.client_certificate)
  client_key             = base64decode(module.cluster.client_key)
}

provider "helm" {
  kubernetes = {
    host                   = module.cluster.endpoint
    cluster_ca_certificate = base64decode(module.cluster.ca_certificate)
    client_certificate     = base64decode(module.cluster.client_certificate)
    client_key             = base64decode(module.cluster.client_key)
  }
}

module "cluster_addons" {
  source       = "git::https://github.com/SoftBank-Hackathon-2026-Team-Amethyst/one-tatchi-platform.git//modules/cluster_addons/onprem?ref=v1.8.0"
  cluster_name = module.cluster.cluster_name
  # 환경마다 Quick Tunnel 하나씩. 각 환경의 FE Service로 연결한다.
  tunnels = {
    for env in var.environments : env => { origin_url = "http://${var.service}-fe.${env}.svc.cluster.local:80" }
  }
}

module "registry" {
  source       = "git::https://github.com/SoftBank-Hackathon-2026-Team-Amethyst/one-tatchi-platform.git//modules/registry/onprem?ref=v1.8.0"
  owner        = var.github_owner
  repositories = ["${var.service}-be", "${var.service}-fe"]
}

# test · prod는 DB를 따로 둔다 (같은 클러스터, 다른 Postgres).
module "database" {
  source   = "git::https://github.com/SoftBank-Hackathon-2026-Team-Amethyst/one-tatchi-platform.git//modules/database/onprem?ref=v1.8.0"
  for_each = toset(var.environments)

  name          = "${var.service}-db-${each.key}"
  database_name = var.database_name
  namespace     = module.cluster_addons.secret_namespace
}

# 환경별 네임스페이스와 DB 접속 Secret(cloud-secrets → <service>-db). 앱은 deploy.yml이 이 네임스페이스에 올린다.
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
      remoteKey  = module.database[each.key].credentials_secret_id
      host       = module.database[each.key].host
      port       = module.database[each.key].port
      name       = module.database[each.key].database_name
    }
  })]
}
