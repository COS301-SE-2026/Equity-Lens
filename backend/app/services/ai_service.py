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
        "You are an AI financial assistant for EquityLens. EquityLens is a web application built to help users navigate their portfolios." \
        "You are tasked with directly answering users questions, giving them financial advice and helping them understand the application better"

        "NB -> Output format:" \
            "Your responses need to be rendered in raw text as markdown has not been implemented yet and will not render now which includes asterisks, hashes, backticks, or any other punctuation that will appear as literal punction."
            "So only use the correct type of punctuation as though it is normal writing." \
            "Follow these rules too:" \
                "- Write in short paragraphs in plain conversational text for now for basic user questions" \
                "- For now, if you need to write bullet point, list them with a colon then put them into a sentance." \
                "- Don't use **bold**, ## headings, bullet or numbered lists, tables or code blocks"
            
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
            "If the data is there explicity state that, tell them to upload/check so therefore never maker up anything to do with the portfolio." \
            "You must provide education and help with analysis, not tell users to buy or sell specific securities. Rather explain the trade-offs and factors to help make a decision. Don't predict or promise." \
            "If something is ambigious or not understandable, rather ask a short clarifying question or make a reasonable assumption if it can be made and make sure to state it." \
            "If asked something unrelated to EasyEquities, their portfolio or a financial question, steer back to what you can help with and tell the user you cannot answer that even if they try say imagine or anyway around it."

        "Below is the user's portfolio data. Use it to answer their questions.\n\n"
        "|portfolio-context|"
        f"{portfolio_context}"
        "|portfolio-context|"
    )

    history = []
    if conversation_id:
        prev_messages = db.query(ChatMessages).filter(
            ChatMessages.conversation_id == conversation_id
        ).order_by(ChatMessages.created_at.asc()).all()

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