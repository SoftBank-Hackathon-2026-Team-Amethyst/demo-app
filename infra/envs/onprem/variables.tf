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
  default     = "1.3.0"
}
