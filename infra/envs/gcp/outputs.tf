output "cluster_name" {
  value = module.cluster.cluster_name
}
output "repository_urls" {
  value = module.registry.repository_urls
}
output "secret_store_name" {
  value = module.cluster_addons.secret_store_name
}
