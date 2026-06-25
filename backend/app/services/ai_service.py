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

#now for chat functionality 
def chat(user_message: str):
    client = get_bedrock_client()
    #response (using converse uses modelId and JSON format for messages)
    response = client.converse(
        modelId = settings.bedrock_model,
        #for user
        messages = [
            {
                "role": "user",
                "content": [{"text": user_message}]
            }
        ],
        system = [{"text": "You are an AI financial asistant for EquityLens."}],
        inferenceConfig = {"maxTokens": 256}
    )
    return response["output"]["message"]["content"][0]["text"]
