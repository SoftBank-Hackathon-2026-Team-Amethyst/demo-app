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
  description = "service-base · App Chart 버전 (Slack 봇 이미지는 slack_bot_image_version으로 별도 고정)"
  type        = string
  default     = "2.9.0"
}

variable "slack_bot_image_version" {
  description = "Slack 봇 이미지 버전. 공통 차트와 독립적으로 업데이트한다."
  type        = string
  default     = "2.3.0"
}

variable "slack_bot_secret_name" {
  description = "Slack 봇 토큰 · GitHub App 키 (Secrets Manager, JSON 키가 환경변수 이름)"
  type        = string
  default     = "one-tatchi/slack-bot"
}

variable "gcp_monitoring" {
  description = "GCP 최초 WIF 설정이 끝난 뒤 연결할 읽기 전용 Grafana 인증 식별자"
  type = object({
    project_id            = string
    workload_provider     = string
    service_account_email = string
  })
  default = null
}

variable "preview_hosts" {
  description = "환경별 승인자용 green 미리보기 호스트. 와일드카드 인증서(*.<domain_name>)가 덮도록 한 단계 이름만 쓴다"
  type        = map(string)
  default = {
    test = "green-yolo.onetatchi.soulee.dev"
    prod = "green.onetatchi.soulee.dev"
  }
}

variable "onprem_preview_hosts" {
  description = "onprem 기본 기기의 green 미리보기 호스트 (Cognito 콜백만 추가). onetatchi.soulee.dev 아래는 Route53에 위임돼 있어 Cloudflare 영역(soulee.dev) 바로 아래 이름을 쓴다"
  type        = map(string)
  default = {
    test = "green-yolo-onprem.soulee.dev"
    prod = "green-onprem.soulee.dev"
  }
}

variable "preview_saml_metadata_url" {
  description = "Identity Center green 미리보기 SAML 앱의 메타데이터 URL. 비우면 IdP 없이 User Pool만 만든다"
  type        = string
  default     = "https://portal.sso.ap-northeast-2.amazonaws.com/saml/metadata/ODEzMzYwMjMyODc0X2lucy03MjMwMGY3NDFhMWJjNjU1"
}

# ---------- DB 링크 (T33) ----------
variable "tailnet" {
  description = "팀 Tailscale tailnet DNS 이름"
  type        = string
  default     = "tailb7ed7e.ts.net"
}

variable "tailscale_oauth_secret_name" {
  description = "Tailscale operator OAuth 클라이언트 (Secrets Manager, JSON 키 client_id · client_secret). 값은 콘솔 · CLI로 넣는다"
  type        = string
  default     = "one-tatchi/tailscale-oauth"
}

variable "tailscale_operator_chart_version" {
  type    = string
  default = "1.102.4"
}

variable "db_link" {
  description = <<-EOT
    RDS 대신 온프레미스 DB를 쓸 환경. fqdn은 온프레미스 루트가 publish한 tailnet 이름, secret_name은 그 DB의
    username/password JSON이 든 Secrets Manager 시크릿. 비우면 모든 환경이 RDS를 쓴다. 첫 지원 조합은 test만 (T32 · T33).
  EOT
  type = map(object({
    fqdn          = string
    secret_name   = string
    database_name = optional(string, "demo")
  }))
  default = {
    test = {
      fqdn        = "demo-app-db-test.tailb7ed7e.ts.net"
      secret_name = "demo-app-db-onprem-test"
    }
  }
}
