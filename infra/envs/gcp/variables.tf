variable "project_id" {
  type    = string
  default = "one-tatchi-gejkm"
}
variable "region" {
  type    = string
  default = "asia-northeast3"
}
variable "name" {
  type    = string
  default = "one-tatchi-gcp"
}
variable "service" {
  type    = string
  default = "demo-app"
}
variable "environments" {
  type    = list(string)
  default = ["test", "prod"]
}
variable "chart_version" {
  type    = string
  default = "1.16.0"
}

variable "grafana_eks_oidc_issuer" {
  description = "중앙 Grafana의 EKS OIDC issuer. 관리자 최초 권한 설정 후 입력하며, 비우면 GCP WIF를 만들지 않는다"
  type        = string
  default     = ""

  validation {
    condition     = var.grafana_eks_oidc_issuer == "" || can(regex("^https://oidc\\.eks\\.[a-z0-9-]+\\.amazonaws\\.com/id/[A-Za-z0-9]+$", var.grafana_eks_oidc_issuer))
    error_message = "EKS describe-cluster에서 확인한 HTTPS OIDC issuer를 사용하거나 빈 문자열로 두세요."
  }
}
