# K8s Manifests — sibs namespace @ 10.1.1.40

## 架构

```
Traefik Ingress (sibs.realhyx.local)
  /api, /mcp  →  si-beaver-cloud  Service  →  si-beaver-cloud  Deployment (sisbc:7420)
  /            →  sisbc-web         Service  →  sisbc-web         Deployment (nginx:80)
```

## 文件

| 文件 | 用途 |
|------|------|
| `namespace.yaml` | 创建 `sibs` namespace |
| `deployment.yaml` | sisbc API server (2 replicas, port 7420) |
| `service.yaml` | sisbc ClusterIP service |
| `deployment-web.yaml` | sisbc-web nginx (1 replica, port 80) |
| `service-web.yaml` | sisbc-web ClusterIP service |
| `ingress.yaml` | Traefik 路径分流 |

## 部署

### 首次部署

```bash
./k8s/deploy.sh
```

### 日常更新

代码变更用 `deploy` skill（构建镜像 + 滚动更新），k8s manifests 通常不需重复 apply。

### 仅更新 manifests

```bash
ssh 10.1.1.40 "sudo kubectl apply -f -" < k8s/ingress.yaml
```

## 镜像

| Deployment | 镜像 | 构建方式 |
|------------|------|----------|
| `si-beaver-cloud` | `10.1.1.40:5000/si-beaver-cloud:latest` | `docker/Dockerfile` (node) |
| `sisbc-web` | `10.1.1.40:5000/sisbc-web:latest` | `docker/Dockerfile.web` (node serve.js) |

## Secrets

需预先创建：

```bash
kubectl create secret generic si-beaver-secret \
  --from-literal=auth-token=xxx -n sibs

kubectl create secret generic si-beaver-cloud-secret \
  --from-literal=auth-token=xxx \
  --from-literal=sibs-project=xxx \
  --from-literal=llm-api-key=xxx \
  -n sibs
```
