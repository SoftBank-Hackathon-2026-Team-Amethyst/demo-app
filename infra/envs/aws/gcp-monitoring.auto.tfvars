# GCP apply run 38046968776, grafana_gcp_monitoring output (public identifiers).
# Grafana exchanges its short-lived EKS token; no service-account key is stored.
gcp_monitoring = {
  project_id            = "one-tatchi-gejkm"
  workload_provider     = "projects/435451069062/locations/global/workloadIdentityPools/grafana-eks/providers/eks-grafana"
  service_account_email = "grafana-monitoring@one-tatchi-gejkm.iam.gserviceaccount.com"
}
