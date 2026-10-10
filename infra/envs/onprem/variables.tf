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

variable "api_port" {
  type    = number
  default = 6550
}

variable "onprem_auth" {
  description = "onpremctl이 메모리에서 공급. tfvars/파일에 기록하지 않는다"
  type = object({
    endpoint           = string
    ca_certificate     = string
    client_certificate = string
    client_key         = string
  })
  sensitive = true
  ephemeral = true
  default = {
    endpoint           = "https://127.0.0.1:6550"
    ca_certificate     = ""
    client_certificate = ""
    client_key         = ""
  }
}

variable "onprem_db_passwords" {
  description = "환경별 DB 비밀번호. onpremctl이 기존 Secret 값을 보존한다"
  type        = map(string)
  sensitive   = true
  ephemeral   = true
  default     = {}
}

variable "kubernetes_version" {
  description = "프로필별 k3s 이미지 태그. 기존 서버 업그레이드는 별도 절차로 수행한다"
  type        = string
  default     = "v1.33.4-k3s1"
  validation {
    condition     = can(regex("^v[0-9]+\\.[0-9]+\\.[0-9]+-k3s[0-9]+$", var.kubernetes_version))
    error_message = "k3s Docker 이미지 태그가 필요합니다 (예: v1.33.6-k3s1)."
  }
}
