CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


CREATE TABLE IF NOT EXISTS  transaction_type
(

    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    transaction_name varchar(100) UNIQUE NOT NULL,
    transaction_description TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS  instrument_type
(

    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    instrument_name varchar(100) UNIQUE NOT NULL,
    instrument_description TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS documents 
(

    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    file_name VARCHAR(100) NOT NULL,
    encrypted_file_path TEXT NOT NULL,
    encrypted_document_text TEXT,
    extracted_password TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS portfolios 
(

    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,

    account_number VARCHAR(100),
    portfolio_name VARCHAR(100),
    statement_start_date DATE,
    statement_end_date DATE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS holdings 
(

    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,

    instrument_name VARCHAR(100),
    quantity NUMERIC(18,4),
    total_cost NUMERIC(18,2),
    cost_price NUMERIC(18,2),
    current_price NUMERIC(18,2),
    current_value NUMERIC(18,2),
    weight_percentage NUMERIC(18,2),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS Instrument_Purchases_and_Sales 
(

    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,

    transactions_date DATE,
    transaction_type_id UUID REFERENCES transaction_type(id),
    instrument_type_id UUID REFERENCES instrument_type(id),
    price NUMERIC(18,2),
    quantity NUMERIC(18,4),
    transactions_cost NUMERIC(18,2),
    Value_Zar NUMERIC(18,2),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS  Transaction_Costs 
(

    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,

    instrument_type_id UUID REFERENCES instrument_type(id),
    Brokerage NUMERIC(18,2),
    Other_Trading_Costs NUMERIC(18,2),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS  Contributions_and_Withdrawals
(

    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,

    transaction_date DATE,
    Settlement_Date DATE,
    transaction_type_id UUID REFERENCES transaction_type(id),
    value_ZAR NUMERIC(18,2),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS  Dividends_and_Withholding_Tax 
(

    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,

    transaction_date DATE,
    instrument_type_id UUID REFERENCES instrument_type(id),
    Gross_dividend NUMERIC(18,2),
    Withholding_tax NUMERIC(18,2),
    Net_dividend NUMERIC(18,2),
    Tax_rate NUMERIC(18,2),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS  transaction_Interest
(

    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,

    transaction_date DATE,
    Settlement_Date DATE,
    transaction_type_id UUID REFERENCES transaction_type(id),
    instrument_type_id UUID REFERENCES instrument_type(id),
    value_ZAR NUMERIC(18,2),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS  transaction_Expenses
(

    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,

    transaction_date DATE,
    Settlement_Date DATE,
    transaction_type_id UUID REFERENCES transaction_type(id),
    narrative TEXT,
    value_ZAR NUMERIC(18,2),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);






