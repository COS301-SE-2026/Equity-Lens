
-- all these tables, will be used to create a user

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


-- all these will be used for RBAC

CREATE TABLE IF NOT EXISTS roles
(

    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    roles_name varchar(100) UNIQUE NOT NULL,
    roles_description TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS  user_roles
(

    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,    
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,  

    -- in here just to prevent any duplicates inside here
    primary key(user_id,role_id)
);


-- all these will be used to import all the information for the pdf

CREATE TABLE IF NOT EXISTS  transaction_types
(

    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    transaction_name varchar(100) UNIQUE NOT NULL,
    transaction_description TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS  instrument_types
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

CREATE TABLE IF NOT EXISTS instrument_purchases_and_sales 
(

    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,

    transactions_date DATE,
    transaction_type_id UUID REFERENCES transaction_types(id),
    instrument_type_id UUID REFERENCES instrument_types(id),
    price NUMERIC(18,2),
    quantity NUMERIC(18,4),
    transactions_cost NUMERIC(18,2),
    value_zar NUMERIC(18,2),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS  transaction_costs 
(

    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,

    instrument_type_id UUID REFERENCES instrument_types(id),
    brokerage NUMERIC(18,2),
    other_trading_costs NUMERIC(18,2),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS  contributions_and_withdrawals
(

    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,

    transaction_date DATE,
    settlement_date DATE,
    transaction_type_id UUID REFERENCES transaction_types(id),
    value_zar NUMERIC(18,2),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS  dividends_and_withholding_tax 
(

    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,

    transaction_date DATE,
    instrument_type_id UUID REFERENCES instrument_types(id),
    gross_dividend NUMERIC(18,2),
    withholding_tax NUMERIC(18,2),
    net_dividend NUMERIC(18,2),
    tax_rate NUMERIC(18,2),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS  transaction_interest
(

    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,

    transaction_date DATE,
    settlement_date DATE,
    transaction_type_id UUID REFERENCES transaction_types(id),
    instrument_type_id UUID REFERENCES instrument_types(id),
    value_zar NUMERIC(18,2),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS  transaction_expenses
(

    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,

    transaction_date DATE,
    settlement_date DATE,
    transaction_type_id UUID REFERENCES transaction_types(id),
    narrative TEXT,
    value_zar NUMERIC(18,2),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);






