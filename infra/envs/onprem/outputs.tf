output "kube_context" {
  value = module.cluster.kube_context
}

output "namespaces" {
  value = [for env in var.environments : env]
}

output "repository_urls" {
  value = module.registry.repository_urls
}

output "public_url_commands" {
  description = "환경 → 외부 주소 확인 명령"
  value       = module.cluster_addons.public_url_commands
}
