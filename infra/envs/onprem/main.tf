# 온프레미스(맥북) 루트. 플랫폼 모듈을 태그로 참조한다.
# state는 이 맥북에만 둔다 (로컬 backend, .gitignore). 맥북 밖으로 나가지 않는다.
terraform {
  required_version = ">= 1.6"
}

module "cluster" {
  source = "git::https://github.com/SoftBank-Hackathon-2026-Team-Amethyst/one-tatchi-platform.git//modules/cluster/onprem?ref=v1.1.0"
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
  source       = "git::https://github.com/SoftBank-Hackathon-2026-Team-Amethyst/one-tatchi-platform.git//modules/cluster_addons/onprem?ref=v1.1.0"
  cluster_name = module.cluster.cluster_name
  tunnel       = var.tunnel
}

module "registry" {
  source       = "git::https://github.com/SoftBank-Hackathon-2026-Team-Amethyst/one-tatchi-platform.git//modules/registry/onprem?ref=v1.1.0"
  owner        = var.github_owner
  repositories = ["${var.service}-be", "${var.service}-fe"]
}

module "database" {
  source        = "git::https://github.com/SoftBank-Hackathon-2026-Team-Amethyst/one-tatchi-platform.git//modules/database/onprem?ref=v1.1.0"
  name          = "${var.service}-db"
  database_name = var.database_name
  namespace     = module.cluster_addons.secret_namespace
}
