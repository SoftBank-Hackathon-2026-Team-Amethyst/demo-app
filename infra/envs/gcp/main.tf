terraform {
  required_version = ">= 1.11.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 7.0"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 3.0"
    }
  }
  backend "gcs" {
    prefix = "demo-app/gcp"
  }
}
provider "google" {
  project = var.project_id
  region  = var.region
}
module "network" {
  source = "git::https://github.com/SoftBank-Hackathon-2026-Team-Amethyst/one-tatchi-platform.git//modules/network/gcp?ref=v1.13.0"
  name   = var.name
}
module "cluster" {
  source              = "git::https://github.com/SoftBank-Hackathon-2026-Team-Amethyst/one-tatchi-platform.git//modules/cluster/gcp?ref=v1.13.0"
  name                = var.name
  region              = var.region
  network_id          = module.network.network_id
  subnet_ids          = module.network.private_subnet_ids
  pods_range_name     = module.network.pods_range_name
  services_range_name = module.network.services_range_name
}
module "registry" {
  source       = "git::https://github.com/SoftBank-Hackathon-2026-Team-Amethyst/one-tatchi-platform.git//modules/registry/gcp?ref=v1.13.0"
  repositories = ["${var.service}-be", "${var.service}-fe"]
  region       = var.region
}
provider "helm" {
  kubernetes = {
    host                   = module.cluster.endpoint
    cluster_ca_certificate = base64decode(module.cluster.ca_certificate)
    exec = {
      api_version = "client.authentication.k8s.io/v1beta1"
      command     = "gke-gcloud-auth-plugin"
    }
  }
}
module "cluster_addons" {
  source              = "git::https://github.com/SoftBank-Hackathon-2026-Team-Amethyst/one-tatchi-platform.git//modules/cluster_addons/gcp?ref=v1.13.0"
  project_id          = var.project_id
  cluster_name        = module.cluster.cluster_name
  region              = var.region
  readable_secret_ids = [module.database.credentials_secret_id]
}
resource "helm_release" "service_base" {
  for_each   = toset(var.environments)
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
  depends_on = [module.cluster_addons]
}

module "database" {
  source        = "git::https://github.com/SoftBank-Hackathon-2026-Team-Amethyst/one-tatchi-platform.git//modules/database/gcp?ref=v1.13.0"
  project_id    = var.project_id
  name          = "${var.service}-gcp-db"
  database_name = "demo"
  region        = var.region
  network_id    = module.network.network_id
  credential_readers = [
    "serviceAccount:one-tatchi-gha-plan@${var.project_id}.iam.gserviceaccount.com",
    "serviceAccount:one-tatchi-gha-deploy@${var.project_id}.iam.gserviceaccount.com",
  ]
}

module "observability" {
  source       = "git::https://github.com/SoftBank-Hackathon-2026-Team-Amethyst/one-tatchi-platform.git//modules/observability/gcp?ref=v1.13.0"
  project_id   = var.project_id
  cluster_name = module.cluster.cluster_name
}
