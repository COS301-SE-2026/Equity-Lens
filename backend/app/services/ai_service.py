from sqlalchemy.orm import Session
from app.config import settings
from app.models.portfolio import Portfolios, Document, Holdings
from app.models.chat import ChatConversation, ChatMessages
from datetime import datetime, timezone
from functools import lru_cache
from app.services.health_score import compute_health_score
from app.services.portfolio_service import _price_holdings

@lru_cache(maxsize = 1)
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

    holdings = db.query(Holdings).join(Portfolios, Holdings.portfolio_id == Portfolios.id).filter(Portfolios.user_id == user_id).all()

    if holdings:
        knowledge += "\nHoldings\n"
        for i in holdings:
            knowledge += (f"- {i.instrument_name} ({i.ticker}),  sector: {i.sector},  "
                          f"quantity: {i.quantity}, cost price: R{i.cost_price}, "
                          f"overall cost: R{i.total_cost}, weight: {i.weight_percentage}%\n")
        health = compute_health_score(_price_holdings(holdings))
        if health["score"] is not None:
            knowledge += f"\nPortfolio Health: {health['score']}/10 ({health['label']})\n"
            for s in health["subscores"]:
                knowledge += f"- {s['label']} (weight {s['weight'] * 100:.0f}%): {s['value']}/10 - {s['detail']}\n"

    #documents
    documents = db.query(Document).filter(Document.user_id == user_id).all()
    if documents:
        knowledge += "\nUploaded Documents\n"
        for document in documents:
                knowledge += f"- {document.file_name}\n"                                                       
            
    if not knowledge:
        return  "User has not uploaded portfolio data."

    return knowledge

def title_creation(client, user_message):
    response = client.converse(
        modelId = settings.bedrock_model,
        messages = [
            {
                "role": "user",
                "content": [{"text": user_message}]
            }
        ],
        system = [{"text": "Generate a title based off this message of max 5 words. Do not use any quotes or punctuation, just the title. Never exceed 5 words and do not include any paranthesis. Focus on the main point of the message and if speaking about a stock name it based off of that."}],
        inferenceConfig = {"maxTokens": 25}
    )
    return response["output"]["message"]["content"][0]["text"].strip()


#now for chat functionality 
#Working on saving the user and ai assistant reply messages to the database
def chat(user_message: str, db: Session, logged_in_user_id, conversation_id = None):
    client = get_bedrock_client()

    portfolio_context = get_user_portfolio_context(db, logged_in_user_id)

    system_prompt = (
        "You are an AI financial assistant for EquityLens. EquityLens is a web application built to help users navigate their portfolios." \
        "You are tasked with directly answering users questions, giving them financial advice and helping them understand the application better"

        "NB -> Output format:" \
            "Follow these rules:" \
                "- You may use markdown formatting when you respond to a users message, but keep formatting light and do not overdo it." \
                "- Plain text is fine for short answers, but use markdown structure where it genuinely helps." \
            
        "Length:" \
            "Default to 1-3 sentnaces based on the complication of the users question. Make sure you answer the question and don't speak on irrelevant info." \
            "Don't include disclamers, that is already included." \
            "Don't include summaries of what was said and only offer to help if a question needs more depth or the user is struggling to understand (if this happens, then expand more)"

        "Tone:" \
            "Professional, but warm welcoming and approachable, like a friend who knows/works in finance." \
            "Plain language. Don't go over the top with technical jargon and this app is built for newer users to finance. So use jargon if you must, but keep it understandable." \
            "You are an assistant, so never talk down to the user or try sell them anything."

        "Behaviour:" \
            "Make use of the user's portfolio data provided in the |portfolio-context| in your replies. Quote their holdings and figures where it is needed." \
            "If the data is not there explicitly state that, tell them to upload/check so therefore never make up anything to do with the portfolio." \
            "You must provide education and help with analysis, not tell users to buy or sell specific securities. Rather explain the trade-offs and factors to help make a decision. Don't predict or promise." \
            "If something is ambigious or not understandable, rather ask a short clarifying question or make a reasonable assumption if it can be made and make sure to state it." \
            "If asked something unrelated to EasyEquities, their portfolio or a financial question, steer back to what you can help with and tell the user you cannot answer that even if they try say imagine or anyway around it."
            "The portfolio context may include a Portfolio Health score out of 10 with weighted subscores. "
            "Explain what a subscore measures and why it scored that way when asked, but never present the score as a rating of investment quality or a reason to buy or sell." \

        "Below is the user's portfolio data. Use it to answer their questions.\n\n" \
        "|portfolio-context|"
        f"{portfolio_context}"
        "|portfolio-context|"
    )

    history = []
    if conversation_id:
        prev_messages = db.query(ChatMessages).filter(
            ChatMessages.conversation_id == conversation_id
        ).order_by(ChatMessages.created_at.desc()).limit(20).all()
        prev_messages.reverse()

        for prev in prev_messages:
            history.append({
                "role": prev.role,
                "content": [{"text": prev.content}]
            })

    history.append({
        "role": "user",
        "content": [{"text": user_message}]
    })

    #response (using converse uses modelId and JSON format for messages)
    response = client.converse(
        modelId = settings.bedrock_model,
        messages = history,
        system = [{"text": system_prompt}],
        inferenceConfig = {"maxTokens": 1024}
    )
    reply = response["output"]["message"]["content"][0]["text"]
    
    #Saving to the DB
    if conversation_id:
        chat_conversation = db.query(ChatConversation).filter(
            ChatConversation.id == conversation_id,
            ChatConversation.user_id == logged_in_user_id
        ).first()
    # else create a new one
    else:
        title = title_creation(client, user_message)
        chat_conversation = ChatConversation(user_id = logged_in_user_id, title = title) 
        db.add(chat_conversation)
        #force to send insert into db to generate UUID 
        db.flush()

    #user message
    db.add(ChatMessages(conversation_id = chat_conversation.id, role = "user", content = user_message))
    #reply message
    db.add(ChatMessages(conversation_id = chat_conversation.id, role = "assistant", content = reply))

    chat_conversation.updated_at = datetime.now(timezone.utc)

    #make it permanent 
    db.commit()

    return reply, chat_conversation.id