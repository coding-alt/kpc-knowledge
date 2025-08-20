#!/bin/bash

# KPC Knowledge System Deployment Script
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE="kpc-system"
DOCKER_REGISTRY="${DOCKER_REGISTRY:-kpc}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
DEPLOYMENT_TYPE="${DEPLOYMENT_TYPE:-docker-compose}" # docker-compose or kubernetes

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_prerequisites() {
    log_info "Checking prerequisites..."
    
    if [ "$DEPLOYMENT_TYPE" = "docker-compose" ]; then
        if ! command -v docker &> /dev/null; then
            log_error "Docker is not installed"
            exit 1
        fi
        
        if ! command -v docker-compose &> /dev/null; then
            log_error "Docker Compose is not installed"
            exit 1
        fi
    elif [ "$DEPLOYMENT_TYPE" = "kubernetes" ]; then
        if ! command -v kubectl &> /dev/null; then
            log_error "kubectl is not installed"
            exit 1
        fi
        
        if ! kubectl cluster-info &> /dev/null; then
            log_error "Cannot connect to Kubernetes cluster"
            exit 1
        fi
    fi
    
    log_success "Prerequisites check passed"
}

build_images() {
    log_info "Building Docker images..."
    
    # Build API image
    log_info "Building API image..."
    docker build -f Dockerfile.api -t ${DOCKER_REGISTRY}/api:${IMAGE_TAG} .
    
    # Build Web image
    log_info "Building Web image..."
    docker build -f Dockerfile.web -t ${DOCKER_REGISTRY}/web:${IMAGE_TAG} .
    
    log_success "Docker images built successfully"
}

deploy_docker_compose() {
    log_info "Deploying with Docker Compose..."
    
    # Create necessary directories
    mkdir -p monitoring/grafana/provisioning
    mkdir -p nginx/ssl
    
    # Generate nginx configuration if it doesn't exist
    if [ ! -f nginx/nginx.conf ]; then
        log_info "Generating nginx configuration..."
        cat > nginx/nginx.conf << 'EOF'
events {
    worker_connections 1024;
}

http {
    upstream api {
        server api:3000;
    }
    
    upstream web {
        server web:3001;
    }
    
    server {
        listen 80;
        server_name localhost;
        
        location /api/ {
            proxy_pass http://api/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
        
        location / {
            proxy_pass http://web/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
        
        location /health {
            access_log off;
            return 200 "healthy\n";
            add_header Content-Type text/plain;
        }
    }
}
EOF
    fi
    
    # Generate Prometheus configuration if it doesn't exist
    if [ ! -f monitoring/prometheus.yml ]; then
        log_info "Generating Prometheus configuration..."
        mkdir -p monitoring
        cat > monitoring/prometheus.yml << 'EOF'
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'kpc-api'
    static_configs:
      - targets: ['api:3000']
    metrics_path: '/metrics'
    scrape_interval: 30s
    
  - job_name: 'milvus'
    static_configs:
      - targets: ['milvus-standalone:9091']
    metrics_path: '/metrics'
    scrape_interval: 30s
    
  - job_name: 'redis'
    static_configs:
      - targets: ['redis:6379']
    scrape_interval: 30s
EOF
    fi
    
    # Start services
    log_info "Starting services..."
    docker-compose up -d
    
    # Wait for services to be healthy
    log_info "Waiting for services to be healthy..."
    sleep 30
    
    # Check service health
    check_service_health_docker
    
    log_success "Docker Compose deployment completed"
    log_info "Services available at:"
    log_info "  - Web UI: http://localhost"
    log_info "  - API: http://localhost/api"
    log_info "  - Grafana: http://localhost:3002 (admin/admin)"
    log_info "  - Prometheus: http://localhost:9090"
}

deploy_kubernetes() {
    log_info "Deploying to Kubernetes..."
    
    # Create namespace
    log_info "Creating namespace..."
    kubectl apply -f k8s/namespace.yaml
    
    # Apply configurations
    log_info "Applying configurations..."
    kubectl apply -f k8s/configmap.yaml
    
    # Deploy databases first
    log_info "Deploying databases..."
    kubectl apply -f k8s/databases.yaml
    kubectl apply -f k8s/milvus.yaml
    
    # Wait for databases to be ready
    log_info "Waiting for databases to be ready..."
    kubectl wait --for=condition=ready pod -l app=postgres -n $NAMESPACE --timeout=300s
    kubectl wait --for=condition=ready pod -l app=redis -n $NAMESPACE --timeout=300s
    kubectl wait --for=condition=ready pod -l app=neo4j -n $NAMESPACE --timeout=300s
    kubectl wait --for=condition=ready pod -l app=milvus-standalone -n $NAMESPACE --timeout=600s
    
    # Deploy applications
    log_info "Deploying applications..."
    kubectl apply -f k8s/api-deployment.yaml
    kubectl apply -f k8s/web-deployment.yaml
    
    # Wait for applications to be ready
    log_info "Waiting for applications to be ready..."
    kubectl wait --for=condition=ready pod -l app=kpc-api -n $NAMESPACE --timeout=300s
    kubectl wait --for=condition=ready pod -l app=kpc-web -n $NAMESPACE --timeout=300s
    
    # Apply ingress
    log_info "Applying ingress..."
    kubectl apply -f k8s/ingress.yaml
    
    # Check deployment status
    check_service_health_k8s
    
    log_success "Kubernetes deployment completed"
    log_info "Services status:"
    kubectl get pods -n $NAMESPACE
    log_info "To access services, configure your DNS or use port-forwarding:"
    log_info "  kubectl port-forward -n $NAMESPACE svc/kpc-web 3001:3001"
    log_info "  kubectl port-forward -n $NAMESPACE svc/kpc-api 3000:3000"
}

check_service_health_docker() {
    log_info "Checking service health..."
    
    # Check API health
    for i in {1..30}; do
        if curl -f http://localhost:3000/health &> /dev/null; then
            log_success "API service is healthy"
            break
        fi
        if [ $i -eq 30 ]; then
            log_error "API service health check failed"
            return 1
        fi
        sleep 2
    done
    
    # Check Web health
    for i in {1..30}; do
        if curl -f http://localhost:3001/api/health &> /dev/null; then
            log_success "Web service is healthy"
            break
        fi
        if [ $i -eq 30 ]; then
            log_error "Web service health check failed"
            return 1
        fi
        sleep 2
    done
}

check_service_health_k8s() {
    log_info "Checking service health..."
    
    # Check if all pods are running
    if kubectl get pods -n $NAMESPACE | grep -v Running | grep -v Completed | grep -q .; then
        log_warning "Some pods are not running:"
        kubectl get pods -n $NAMESPACE | grep -v Running | grep -v Completed
    else
        log_success "All pods are running"
    fi
    
    # Check service endpoints
    log_info "Service endpoints:"
    kubectl get svc -n $NAMESPACE
}

cleanup() {
    log_info "Cleaning up..."
    
    if [ "$DEPLOYMENT_TYPE" = "docker-compose" ]; then
        docker-compose down -v
        log_success "Docker Compose cleanup completed"
    elif [ "$DEPLOYMENT_TYPE" = "kubernetes" ]; then
        kubectl delete namespace $NAMESPACE --ignore-not-found=true
        log_success "Kubernetes cleanup completed"
    fi
}

show_help() {
    echo "KPC Knowledge System Deployment Script"
    echo ""
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  deploy    Deploy the system"
    echo "  cleanup   Clean up deployed resources"
    echo "  build     Build Docker images only"
    echo "  help      Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  DEPLOYMENT_TYPE    Deployment type (docker-compose|kubernetes) [default: docker-compose]"
    echo "  DOCKER_REGISTRY    Docker registry prefix [default: kpc]"
    echo "  IMAGE_TAG          Docker image tag [default: latest]"
    echo "  OPENAI_API_KEY     OpenAI API key (required)"
    echo ""
    echo "Examples:"
    echo "  $0 deploy                                    # Deploy with Docker Compose"
    echo "  DEPLOYMENT_TYPE=kubernetes $0 deploy         # Deploy to Kubernetes"
    echo "  $0 build                                     # Build images only"
    echo "  $0 cleanup                                   # Clean up resources"
}

# Main execution
case "${1:-deploy}" in
    "deploy")
        check_prerequisites
        build_images
        if [ "$DEPLOYMENT_TYPE" = "docker-compose" ]; then
            deploy_docker_compose
        elif [ "$DEPLOYMENT_TYPE" = "kubernetes" ]; then
            deploy_kubernetes
        else
            log_error "Invalid deployment type: $DEPLOYMENT_TYPE"
            exit 1
        fi
        ;;
    "build")
        check_prerequisites
        build_images
        ;;
    "cleanup")
        cleanup
        ;;
    "help"|"-h"|"--help")
        show_help
        ;;
    *)
        log_error "Unknown command: $1"
        show_help
        exit 1
        ;;
esac