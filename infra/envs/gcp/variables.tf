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
  default = "1.13.0"
}
