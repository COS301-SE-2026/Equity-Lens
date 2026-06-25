# adding boto3 to reach AWS services
import boto3
from app.config import settings

def get_bedrock_client():
    return boto3.client(
        "bedrock-runtime",
        region = settings.aws_region
        acces_key = settings.aws_access_key_id
        secret_access_key = settings.aws_secret_access_key_id
    )

