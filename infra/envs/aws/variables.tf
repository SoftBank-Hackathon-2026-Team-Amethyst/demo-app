variable "account_id" {
  description = "팀 AWS 계정. 잘못된 계정으로 apply하는 것을 provider에서 차단한다"
  type        = string
  default     = "993371732872"
}

variable "region" {
  type    = string
  default = "ap-northeast-2"

  validation {
    condition     = var.region == "ap-northeast-2"
    error_message = "팀 SCP와 S3 backend는 서울 리전(ap-northeast-2)을 사용합니다."
  }
}

variable "name" {
  description = "팀 공용 VPC와 EKS 클러스터 이름"
  type        = string
  default     = "one-tatchi"
}

variable "service" {
  description = "이미지 저장소 접두사와 ALB Ingress 그룹 이름"
  type        = string
  default     = "demo-app"
}

variable "kubernetes_version" {
  type    = string
  default = "1.36"
}

variable "domain_name" {
  description = "bootstrap에서 이미 만든 Route53 public hosted zone"
  type        = string
  default     = "onetatchi.soulee.dev"
}

variable "additional_admin_principal_arns" {
  description = "팀 SSO 관리자와 CI deploy 역할 외에 추가할 IAM 관리자 역할 ARN"
  type        = list(string)
  default     = []
}

variable "environments" {
  description = "앱을 배포할 환경(네임스페이스)"
  type        = list(string)
  default     = ["test", "prod"]
}

variable "chart_version" {
  description = "service-base 차트 버전 (template_version과 같게)"
  type        = string
  default     = "1.6.0"
}
