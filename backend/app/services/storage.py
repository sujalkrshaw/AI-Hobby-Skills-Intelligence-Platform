import boto3
from botocore.client import Config
from app.core.config import settings

class Storage:
    def __init__(self):
        scheme = "https" if settings.minio_secure else "http"
        self.client = boto3.client("s3", endpoint_url=f"{scheme}://{settings.minio_endpoint}", aws_access_key_id=settings.minio_access_key, aws_secret_access_key=settings.minio_secret_key, config=Config(signature_version="s3v4"), region_name="us-east-1")
    def ensure_bucket(self):
        try: self.client.head_bucket(Bucket=settings.minio_bucket)
        except Exception: self.client.create_bucket(Bucket=settings.minio_bucket)
    def upload(self, key, content, content_type):
        self.ensure_bucket(); self.client.put_object(Bucket=settings.minio_bucket, Key=key, Body=content, ContentType=content_type)
        return key
    def presigned(self, key, expires=900):
        return self.client.generate_presigned_url("get_object", Params={"Bucket": settings.minio_bucket, "Key": key}, ExpiresIn=expires)
