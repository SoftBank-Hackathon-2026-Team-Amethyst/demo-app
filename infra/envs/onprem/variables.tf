variable "name" {
  description = "클러스터 이름"
  type        = string
  default     = "onetouch"
}

variable "service" {
  type    = string
  default = "demo-app"
}

variable "database_name" {
  type    = string
  default = "demo"
}

variable "github_owner" {
  type    = string
  default = "SoftBank-Hackathon-2026-Team-Amethyst"
}

variable "environments" {
  description = "배포 환경. 환경마다 네임스페이스와 DB를 하나씩 만든다"
  type        = list(string)
  default     = ["test", "prod"]
}

variable "chart_version" {
  description = "service-base 차트 버전 (template_version과 같게)"
  type        = string
  default     = "1.16.0"
}

variable "metrics_remote_write_url" {
  description = "중앙 Grafana용 HTTPS 수신 주소. 비우면 로컬 수집만 수행한다"
  type        = string
  default     = ""
}

variable "metrics_remote_write_secret_name" {
  description = "monitoring namespace에 미리 만든 username/password Secret 이름"
  type        = string
  default     = ""
}

variable "metrics_dashboard_url" {
  type    = string
  default = ""
}
