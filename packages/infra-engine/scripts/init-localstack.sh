#!/bin/bash
set -e

echo "=== LocalStack 초기화 ==="

# S3 버킷 생성 (Pulumi state)
awslocal s3 mb s3://qa-sdk-infra-state 2>/dev/null || echo "S3 버킷 이미 존재"

# S3 버전관리 활성화
awslocal s3api put-bucket-versioning \
  --bucket qa-sdk-infra-state \
  --versioning-configuration Status=Enabled

# DynamoDB lock 테이블 생성
awslocal dynamodb create-table \
  --table-name qa-sdk-infra-lock \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST 2>/dev/null || echo "DynamoDB 테이블 이미 존재"

# KMS 키 생성
KEY_ID=$(awslocal kms create-key --query 'KeyMetadata.KeyId' --output text 2>/dev/null || echo "")
if [ -n "$KEY_ID" ]; then
  awslocal kms create-alias --alias-name alias/qa-sdk-sops --target-key-id "$KEY_ID" 2>/dev/null || true
  echo "KMS Key ID: $KEY_ID"
  echo "KMS Alias: alias/qa-sdk-sops"
fi

echo "=== LocalStack 초기화 완료 ==="
echo "  S3: s3://qa-sdk-infra-state"
echo "  DynamoDB: qa-sdk-infra-lock"
echo "  KMS: alias/qa-sdk-sops"
