-- QuoteXtract database schema initialisation
-- This runs automatically when postgres starts with an empty data volume.

CREATE TABLE IF NOT EXISTS emails (
    id          serial PRIMARY KEY,
    sender_name text,
    sender_email text,
    subject     text,
    received_at text,
    pdf_filename text,
    pdf_storage_key text,
    body_text   text,
    body_html   text,
    is_read     boolean NOT NULL DEFAULT false,
    message_id  text,
    source      text NOT NULL DEFAULT 'upload',
    status      text NOT NULL DEFAULT 'pending',
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS quotations (
    id               serial PRIMARY KEY,
    email_id         integer,
    supplier_name    text,
    supplier_email   text,
    quotation_number text,
    quotation_date   text,
    currency         text,
    payment_terms    text,
    delivery_terms   text,
    total_amount     text,
    status           text NOT NULL DEFAULT 'draft',
    extraction_score integer,
    notes            text,
    pdf_storage_key  text,
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS quotation_items (
    id           serial PRIMARY KEY,
    quotation_id integer NOT NULL,
    part_number  text,
    description  text,
    quantity     text,
    unit_price   text,
    total_price  text,
    lead_time    text,
    moq          text,
    currency     text,
    notes        text,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS settings (
    id         serial PRIMARY KEY,
    key        text NOT NULL UNIQUE,
    value      text,
    updated_at timestamptz NOT NULL DEFAULT now()
);
