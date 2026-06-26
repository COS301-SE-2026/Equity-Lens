# adding boto3 to reach AWS services
import boto3
from sqlalchemy.orm import Session
from app.config import settings
from app.models.portfolio import Portfolios, Document

def get_bedrock_client():
    return boto3.client(
        "bedrock-runtime",
        region_name = settings.aws_region,
        aws_access_key_id = settings.aws_access_key_id,
        aws_secret_access_key = settings.aws_secret_access_key
    )

def get_user_portfolio_context(db: Session, user_id):
    portfolios = db.query(Portfolios).filter(Portfolios.user_id == user_id).all()
    knowledge = ""

    if portfolios:
        for info in portfolios:
            knowledge += f"Portfolio: {info.portfolio_name}, Account: {info.account_number}\n"

    #documents
    documents = db.query(Document).filter(Document.user_id == user_id).all()
    if documents:
        knowledge += "\nUploaded Documents\n"
        for document in documents:
            if document.encrypted_document_text:
                knowledge += f"- {document.file_name}- \n{document.encrypted_document_text}\n\n\n"                                                       
            
    if not knowledge:
        return  "User has not uploaded portfolio data."

    return knowledge

#now for chat functionality 
def chat(user_message: str, db: Session, user_id):
    client = get_bedrock_client()

    portfolio_context = get_user_portfolio_context(db, user_id)

    system_prompt = (
        "You are an AI financial assistant for EquityLens. "
        "Below is the user's portfolio data. Use it to answer their questions.\n\n"
        f"{portfolio_context}"
    )

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
        system = [{"text": system_prompt}],
        inferenceConfig = {"maxTokens": 256}
    )
    return response["output"]["message"]["content"][0]["text"]
