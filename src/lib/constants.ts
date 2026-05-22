export const UTILITY_SERVICES = [
  "Kafka",
  "Redis",
  "NiFi",
  "RabbitMQ",
  "MongoDB",
  "Elasticsearch",
  "PostgreSQL",
  "MySQL",
  "MariaDB",
  "Cassandra",
  "Zookeeper",
  "Vault",
  "Consul",
  "Prometheus",
  "Grafana",
  "Loki",
  "Jaeger",
  "MinIO",
  "ClickHouse",
  "Etcd",
] as const;

export type UtilityService = (typeof UTILITY_SERVICES)[number];
