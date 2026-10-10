output "deployer_arn" {
  description = "이 루트를 실행한 역할 (기존 인증 확인용 출력)"
  value       = data.aws_caller_identity.current.arn
}

output "cluster_name" {
  value = module.cluster.cluster_name
}

output "region" {
  value = var.region
}

output "kubeconfig_command" {
  description = "본인 SSO 로그인 후 실행할 접속 명령"
  value       = "aws eks update-kubeconfig --profile onetatchi --region ${var.region} --name ${module.cluster.cluster_name}"
}

output "repository_urls" {
  value = module.registry.repository_urls
}

# service-base 차트의 database 입력에 연결한다.
output "database" {
  value = {
    host      = module.database.host
    port      = module.database.port
    name      = module.database.database_name
    remoteKey = module.database.credentials_secret_id
  }
}

output "secret_store_name" {
  value = module.cluster_addons.secret_store_name
}

output "ingress_class" {
  value = module.cluster_addons.ingress_class
}

output "ingress_group" {
  value = var.service
}

output "dashboard_path" {
  value = module.observability.dashboard_path
}

output "dashboard_url" {
  value = module.observability.dashboard_url
}

output "observability_log_group" {
  value = module.observability.evidence_log_group
}

output "observability_remote_write_url" {
  value = module.observability.remote_write_url
}

output "dns_zone_id" {
  value = data.aws_route53_zone.service.zone_id
}
