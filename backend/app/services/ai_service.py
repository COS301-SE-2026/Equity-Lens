from sqlalchemy.orm import Session
from app.config import settings
from app.models.portfolio import Portfolios, Document
from app.models.chat import ChatConversation, ChatMessages

def get_bedrock_client():
    import boto3
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
#Working on saving the user and ai assistant reply messages to the database
def chat(user_message: str, db: Session, logged_in_user_id, conversation_id = None):
    client = get_bedrock_client()

    portfolio_context = get_user_portfolio_context(db, logged_in_user_id)

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
    reply = response["output"]["message"]["content"][0]["text"]
    
    #Saving to the DB
    #exitising conversatio?
    if conversation_id:
        chat_conversation = db.query(ChatConversation).filter(
            ChatConversation.id == conversation_id,
            ChatConversation.user_id == logged_in_user_id
        ).first()
    # else create a new one
    else:
        chat_conversation = ChatConversation(user_id = logged_in_user_id) 
        db.add(chat_conversation)
        #force to send insert into db to generate UUID 
        db.flush()

    #user message
    db.add(ChatMessages(conversation_id = chat_conversation.id, role = "user", content = user_message))
    #reply message
    db.add(ChatMessages(conversation_id = chat_conversation.id, role = "assistant", content = reply))

    #make it permanent 
    db.commit()

    return reply, chat_conversation.id