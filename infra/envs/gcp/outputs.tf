output "cluster_name" {
  value = module.cluster.cluster_name
}
output "repository_urls" {
  value = module.registry.repository_urls
}
output "secret_store_name" {
  value = module.cluster_addons.secret_store_name
}

output "dashboard_path" {
  value = module.observability.dashboard_path
}
output "dashboard_url" {
  value = module.observability.dashboard_url
}

output "grafana_gcp_monitoring" {
  description = "GCP WIF 적용 후 AWS 루트의 gcp_monitoring에 전달할 공개 식별자. 비활성 상태에서는 null"
  value = var.grafana_eks_oidc_issuer == "" ? null : {
    project_id            = var.project_id
    workload_provider     = module.observability.grafana_workload_provider
    service_account_email = module.observability.grafana_service_account
  }
}
