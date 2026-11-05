--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.11 (Debian 17.11-1.pgdg13+2)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: enum_contact_messages_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_contact_messages_status AS ENUM (
    'UNREAD',
    'READ',
    'REPLIED'
);


--
-- Name: enum_coupon_redemptions_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_coupon_redemptions_status AS ENUM (
    'used'
);


--
-- Name: enum_coupons_audience_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_coupons_audience_type AS ENUM (
    'all_users',
    'new_users_only'
);


--
-- Name: enum_coupons_discount_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_coupons_discount_type AS ENUM (
    'flat',
    'percent'
);


--
-- Name: enum_coupons_visibility; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_coupons_visibility AS ENUM (
    'public',
    'hidden'
);


--
-- Name: enum_orders_payment_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_orders_payment_status AS ENUM (
    'PENDING',
    'PAID',
    'FAILED',
    'REFUNDED'
);


--
-- Name: enum_orders_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_orders_status AS ENUM (
    'PENDING',
    'CONFIRMED',
    'ASSIGNED',
    'PICKED',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
    'CANCELLED',
    'FAILED'
);


--
-- Name: enum_seller_bills_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_seller_bills_status AS ENUM (
    'PENDING',
    'PAID',
    'CANCELLED'
);


--
-- Name: enum_support_tickets_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_support_tickets_status AS ENUM (
    'OPEN',
    'IN_PROGRESS',
    'RESOLVED',
    'CLOSED'
);


--
-- Name: enum_users_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_users_role AS ENUM (
    'CUSTOMER',
    'DRIVER',
    'ADMIN'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: addresses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.addresses (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    title character varying(50) NOT NULL,
    street character varying(255) NOT NULL,
    city character varying(100) NOT NULL,
    pincode character varying(20) NOT NULL,
    latitude double precision NOT NULL,
    longitude double precision NOT NULL,
    is_deliverable boolean DEFAULT false,
    is_default boolean DEFAULT false,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


--
-- Name: banners; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.banners (
    id uuid NOT NULL,
    title character varying(100),
    image_url character varying(255) NOT NULL,
    is_active boolean DEFAULT true,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


--
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories (
    id uuid NOT NULL,
    name character varying(100) NOT NULL,
    image_url character varying(255),
    is_active boolean DEFAULT true,
    sort_order integer DEFAULT 0,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


--
-- Name: contact_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contact_messages (
    id uuid NOT NULL,
    name character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    message text NOT NULL,
    status public.enum_contact_messages_status DEFAULT 'UNREAD'::public.enum_contact_messages_status,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: coupon_redemptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coupon_redemptions (
    id uuid NOT NULL,
    coupon_id uuid NOT NULL,
    user_id uuid NOT NULL,
    order_id character varying(255) NOT NULL,
    discount_amount numeric(10,2) NOT NULL,
    status public.enum_coupon_redemptions_status DEFAULT 'used'::public.enum_coupon_redemptions_status NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


--
-- Name: coupons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coupons (
    id uuid NOT NULL,
    code character varying(50) NOT NULL,
    title character varying(120) NOT NULL,
    description text,
    discount_type public.enum_coupons_discount_type NOT NULL,
    discount_value numeric(10,2) NOT NULL,
    max_discount_amount numeric(10,2),
    min_order_amount numeric(10,2),
    max_order_amount numeric(10,2),
    start_at timestamp with time zone,
    end_at timestamp with time zone,
    is_active boolean DEFAULT true NOT NULL,
    visibility public.enum_coupons_visibility DEFAULT 'public'::public.enum_coupons_visibility NOT NULL,
    audience_type public.enum_coupons_audience_type DEFAULT 'all_users'::public.enum_coupons_audience_type NOT NULL,
    total_redemption_limit integer,
    per_user_limit integer DEFAULT 1 NOT NULL,
    auto_hide_after_use boolean DEFAULT true NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


--
-- Name: delivery_slots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.delivery_slots (
    id uuid NOT NULL,
    start_time character varying(255) NOT NULL,
    end_time character varying(255) NOT NULL,
    label character varying(255) NOT NULL,
    is_active boolean DEFAULT true,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


--
-- Name: COLUMN delivery_slots.start_time; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.delivery_slots.start_time IS 'e.g., 09:00';


--
-- Name: COLUMN delivery_slots.end_time; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.delivery_slots.end_time IS 'e.g., 11:00';


--
-- Name: COLUMN delivery_slots.label; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.delivery_slots.label IS 'e.g., Morning: 9 AM - 11 AM';


--
-- Name: order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_items (
    id uuid NOT NULL,
    order_id character varying(255) NOT NULL,
    product_id uuid NOT NULL,
    variant_id uuid NOT NULL,
    product_name_snapshot character varying(255) NOT NULL,
    variant_name_snapshot character varying(255) NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    price numeric(10,2) NOT NULL,
    instruction text,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    cost_price_snapshot numeric(10,2) DEFAULT 0
);


--
-- Name: COLUMN order_items.cost_price_snapshot; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.order_items.cost_price_snapshot IS 'Snapshot of the wholesale price at the time of order';


--
-- Name: orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orders (
    id character varying(255) NOT NULL,
    user_id uuid NOT NULL,
    total_amount numeric(10,2) NOT NULL,
    status public.enum_orders_status DEFAULT 'PENDING'::public.enum_orders_status,
    driver_id uuid,
    payment_method character varying(255) DEFAULT 'COD'::character varying,
    delivery_instruction text,
    failure_reason text,
    delivered_at timestamp with time zone,
    delivery_date date,
    delivery_slot_id uuid,
    delivery_slot_label character varying(255),
    address_title character varying(255),
    address_street character varying(255) NOT NULL,
    address_city character varying(255) NOT NULL,
    address_pincode character varying(255) NOT NULL,
    address_latitude numeric(10,8),
    address_longitude numeric(11,8),
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    delivery_charge numeric(10,2) DEFAULT 0 NOT NULL,
    total_cost numeric(10,2) DEFAULT 0,
    total_profit numeric(10,2) DEFAULT 0,
    subtotal_amount numeric(10,2) DEFAULT 0,
    discount_amount numeric(10,2) DEFAULT 0,
    coupon_id uuid,
    coupon_code_snapshot character varying(50),
    payment_status public.enum_orders_payment_status DEFAULT 'PENDING'::public.enum_orders_payment_status,
    cf_order_id character varying(255),
    payment_session_id character varying(255)
);


--
-- Name: COLUMN orders.delivery_date; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.orders.delivery_date IS 'The date requested for pre-order delivery. If null, it is an ASAP order.';


--
-- Name: COLUMN orders.delivery_slot_label; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.orders.delivery_slot_label IS 'Snapshot of the slot label (e.g. Morning: 9 AM - 11 AM) in case the slot config changes';


--
-- Name: COLUMN orders.delivery_charge; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.orders.delivery_charge IS 'Delivery fee charged at time of order placement';


--
-- Name: COLUMN orders.total_cost; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.orders.total_cost IS 'Sum of all item cost prices at the time of order';


--
-- Name: COLUMN orders.total_profit; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.orders.total_profit IS 'total_amount minus delivery_charge minus total_cost';


--
-- Name: COLUMN orders.subtotal_amount; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.orders.subtotal_amount IS 'Sum of item selling prices before delivery fee and coupon discount';


--
-- Name: COLUMN orders.discount_amount; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.orders.discount_amount IS 'Coupon discount applied at order placement';


--
-- Name: COLUMN orders.payment_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.orders.payment_status IS 'Status of the payment for ONLINE methods';


--
-- Name: COLUMN orders.cf_order_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.orders.cf_order_id IS 'Cashfree internal order reference';


--
-- Name: COLUMN orders.payment_session_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.orders.payment_session_id IS 'Cashfree session for the frontend SDK';


--
-- Name: product_variants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_variants (
    id uuid NOT NULL,
    product_id uuid NOT NULL,
    weight character varying(50) NOT NULL,
    price double precision NOT NULL,
    discounted_price double precision,
    in_stock boolean DEFAULT true,
    is_active boolean DEFAULT true,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    cost_price double precision DEFAULT '0'::double precision
);


--
-- Name: COLUMN product_variants.cost_price; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.product_variants.cost_price IS 'Wholesale supplier price for this variant';


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    id uuid NOT NULL,
    category_id uuid NOT NULL,
    name character varying(200) NOT NULL,
    description text,
    image_url character varying(255),
    is_active boolean DEFAULT true,
    is_popular boolean DEFAULT false,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    storage_instructions character varying(255),
    sort_order integer DEFAULT 0
);


--
-- Name: promo_notification_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.promo_notification_logs (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    sent_on date NOT NULL,
    kind character varying(20) NOT NULL,
    message_key character varying(40) NOT NULL,
    "createdAt" timestamp with time zone NOT NULL
);


--
-- Name: COLUMN promo_notification_logs.sent_on; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.promo_notification_logs.sent_on IS 'Indian Standard Time date the push was sent';


--
-- Name: COLUMN promo_notification_logs.message_key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.promo_notification_logs.message_key IS 'Hash of the title and body';


--
-- Name: seller_bill_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.seller_bill_items (
    id uuid NOT NULL,
    bill_id character varying(255) NOT NULL,
    product_id uuid NOT NULL,
    product_name_snapshot character varying(255) NOT NULL,
    variant_id uuid,
    variant_name_snapshot character varying(255),
    quantity integer DEFAULT 1 NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


--
-- Name: seller_bills; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.seller_bills (
    id character varying(255) NOT NULL,
    status public.enum_seller_bills_status DEFAULT 'PENDING'::public.enum_seller_bills_status,
    notes text,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    category_name character varying(255),
    supplier_name character varying(255)
);


--
-- Name: shop_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shop_settings (
    id integer NOT NULL,
    shop_latitude double precision NOT NULL,
    shop_longitude double precision NOT NULL,
    delivery_radius_km double precision DEFAULT '999'::double precision NOT NULL,
    min_order_for_free_delivery double precision DEFAULT '1000'::double precision NOT NULL,
    delivery_fee_amount double precision DEFAULT '0'::double precision NOT NULL,
    free_delivery_distance_km double precision DEFAULT '5'::double precision NOT NULL,
    distance_delivery_fee_amount double precision DEFAULT '0'::double precision NOT NULL,
    delivery_fee_strategy character varying(255) DEFAULT 'amount'::character varying NOT NULL,
    store_start_time character varying(255) DEFAULT '09:00'::character varying,
    store_close_time character varying(255) DEFAULT '22:00'::character varying,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    orders_paused boolean DEFAULT false NOT NULL,
    pause_reason text DEFAULT 'Under Maintenance'::text,
    deliverable_pincodes text DEFAULT '[]'::text,
    distance_tiers text DEFAULT '[]'::text
);


--
-- Name: COLUMN shop_settings.store_start_time; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.shop_settings.store_start_time IS 'Store opening time';


--
-- Name: COLUMN shop_settings.store_close_time; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.shop_settings.store_close_time IS 'Store closing time';


--
-- Name: COLUMN shop_settings.orders_paused; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.shop_settings.orders_paused IS 'When true, the shop is not accepting new orders';


--
-- Name: COLUMN shop_settings.pause_reason; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.shop_settings.pause_reason IS 'Reason shown to customers when orders are paused';


--
-- Name: shop_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.shop_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: shop_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.shop_settings_id_seq OWNED BY public.shop_settings.id;


--
-- Name: support_tickets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.support_tickets (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    order_id character varying(255),
    subject character varying(255) NOT NULL,
    message text NOT NULL,
    status public.enum_support_tickets_status DEFAULT 'OPEN'::public.enum_support_tickets_status,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid NOT NULL,
    name character varying(100),
    email character varying(150),
    password character varying(255),
    phone character varying(20),
    is_profile_completed boolean DEFAULT false,
    role public.enum_users_role DEFAULT 'CUSTOMER'::public.enum_users_role NOT NULL,
    is_active boolean DEFAULT true,
    refresh_token character varying(255),
    push_token character varying(255),
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    promotional_notifications boolean DEFAULT true,
    device_id character varying(255),
    otp character varying(6),
    otp_expires_at timestamp with time zone,
    otp_attempts integer DEFAULT 0,
    tokens_valid_after timestamp with time zone,
    push_devices jsonb,
    signup_location character varying(255)
);


--
-- Name: COLUMN users.tokens_valid_after; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.tokens_valid_after IS 'Access tokens issued before this time are rejected (used to force logout on all devices)';


--
-- Name: COLUMN users.push_devices; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.push_devices IS 'Per push token metadata: { "<token>": { platform: "android"|"ios", app_version: "1.0.0" } }';


--
-- Name: COLUMN users.signup_location; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.signup_location IS 'Approximate area where the customer first opened the app after signing up (e.g. "Crawford, Tamil Nadu")';


--
-- Name: shop_settings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shop_settings ALTER COLUMN id SET DEFAULT nextval('public.shop_settings_id_seq'::regclass);


--
-- Name: addresses addresses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.addresses
    ADD CONSTRAINT addresses_pkey PRIMARY KEY (id);


--
-- Name: banners banners_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.banners
    ADD CONSTRAINT banners_pkey PRIMARY KEY (id);


--
-- Name: categories categories_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_name_key UNIQUE (name);


--
-- Name: categories categories_name_key1; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_name_key1 UNIQUE (name);


--
-- Name: categories categories_name_key10; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_name_key10 UNIQUE (name);


--
-- Name: categories categories_name_key11; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_name_key11 UNIQUE (name);


--
-- Name: categories categories_name_key12; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_name_key12 UNIQUE (name);


--
-- Name: categories categories_name_key13; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_name_key13 UNIQUE (name);


--
-- Name: categories categories_name_key14; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_name_key14 UNIQUE (name);


--
-- Name: categories categories_name_key15; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_name_key15 UNIQUE (name);


--
-- Name: categories categories_name_key16; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_name_key16 UNIQUE (name);


--
-- Name: categories categories_name_key17; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_name_key17 UNIQUE (name);


--
-- Name: categories categories_name_key18; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_name_key18 UNIQUE (name);


--
-- Name: categories categories_name_key19; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_name_key19 UNIQUE (name);


--
-- Name: categories categories_name_key2; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_name_key2 UNIQUE (name);


--
-- Name: categories categories_name_key20; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_name_key20 UNIQUE (name);


--
-- Name: categories categories_name_key21; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_name_key21 UNIQUE (name);


--
-- Name: categories categories_name_key22; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_name_key22 UNIQUE (name);


--
-- Name: categories categories_name_key23; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_name_key23 UNIQUE (name);


--
-- Name: categories categories_name_key24; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_name_key24 UNIQUE (name);


--
-- Name: categories categories_name_key3; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_name_key3 UNIQUE (name);


--
-- Name: categories categories_name_key4; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_name_key4 UNIQUE (name);


--
-- Name: categories categories_name_key5; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_name_key5 UNIQUE (name);


--
-- Name: categories categories_name_key6; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_name_key6 UNIQUE (name);


--
-- Name: categories categories_name_key7; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_name_key7 UNIQUE (name);


--
-- Name: categories categories_name_key8; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_name_key8 UNIQUE (name);


--
-- Name: categories categories_name_key9; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_name_key9 UNIQUE (name);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: contact_messages contact_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_messages
    ADD CONSTRAINT contact_messages_pkey PRIMARY KEY (id);


--
-- Name: coupon_redemptions coupon_redemptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupon_redemptions
    ADD CONSTRAINT coupon_redemptions_pkey PRIMARY KEY (id);


--
-- Name: coupons coupons_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupons
    ADD CONSTRAINT coupons_code_key UNIQUE (code);


--
-- Name: coupons coupons_code_key1; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupons
    ADD CONSTRAINT coupons_code_key1 UNIQUE (code);


--
-- Name: coupons coupons_code_key2; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupons
    ADD CONSTRAINT coupons_code_key2 UNIQUE (code);


--
-- Name: coupons coupons_code_key3; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupons
    ADD CONSTRAINT coupons_code_key3 UNIQUE (code);


--
-- Name: coupons coupons_code_key4; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupons
    ADD CONSTRAINT coupons_code_key4 UNIQUE (code);


--
-- Name: coupons coupons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupons
    ADD CONSTRAINT coupons_pkey PRIMARY KEY (id);


--
-- Name: delivery_slots delivery_slots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_slots
    ADD CONSTRAINT delivery_slots_pkey PRIMARY KEY (id);


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: product_variants product_variants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_variants
    ADD CONSTRAINT product_variants_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: promo_notification_logs promo_notification_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promo_notification_logs
    ADD CONSTRAINT promo_notification_logs_pkey PRIMARY KEY (id);


--
-- Name: seller_bill_items seller_bill_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seller_bill_items
    ADD CONSTRAINT seller_bill_items_pkey PRIMARY KEY (id);


--
-- Name: seller_bills seller_bills_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seller_bills
    ADD CONSTRAINT seller_bills_pkey PRIMARY KEY (id);


--
-- Name: shop_settings shop_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shop_settings
    ADD CONSTRAINT shop_settings_pkey PRIMARY KEY (id);


--
-- Name: support_tickets support_tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_email_key1; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key1 UNIQUE (email);


--
-- Name: users users_email_key10; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key10 UNIQUE (email);


--
-- Name: users users_email_key11; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key11 UNIQUE (email);


--
-- Name: users users_email_key12; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key12 UNIQUE (email);


--
-- Name: users users_email_key13; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key13 UNIQUE (email);


--
-- Name: users users_email_key14; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key14 UNIQUE (email);


--
-- Name: users users_email_key15; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key15 UNIQUE (email);


--
-- Name: users users_email_key16; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key16 UNIQUE (email);


--
-- Name: users users_email_key17; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key17 UNIQUE (email);


--
-- Name: users users_email_key18; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key18 UNIQUE (email);


--
-- Name: users users_email_key19; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key19 UNIQUE (email);


--
-- Name: users users_email_key2; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key2 UNIQUE (email);


--
-- Name: users users_email_key20; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key20 UNIQUE (email);


--
-- Name: users users_email_key21; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key21 UNIQUE (email);


--
-- Name: users users_email_key22; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key22 UNIQUE (email);


--
-- Name: users users_email_key23; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key23 UNIQUE (email);


--
-- Name: users users_email_key24; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key24 UNIQUE (email);


--
-- Name: users users_email_key3; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key3 UNIQUE (email);


--
-- Name: users users_email_key4; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key4 UNIQUE (email);


--
-- Name: users users_email_key5; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key5 UNIQUE (email);


--
-- Name: users users_email_key6; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key6 UNIQUE (email);


--
-- Name: users users_email_key7; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key7 UNIQUE (email);


--
-- Name: users users_email_key8; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key8 UNIQUE (email);


--
-- Name: users users_email_key9; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key9 UNIQUE (email);


--
-- Name: users users_phone_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_phone_key UNIQUE (phone);


--
-- Name: users users_phone_key1; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_phone_key1 UNIQUE (phone);


--
-- Name: users users_phone_key10; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_phone_key10 UNIQUE (phone);


--
-- Name: users users_phone_key11; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_phone_key11 UNIQUE (phone);


--
-- Name: users users_phone_key12; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_phone_key12 UNIQUE (phone);


--
-- Name: users users_phone_key13; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_phone_key13 UNIQUE (phone);


--
-- Name: users users_phone_key14; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_phone_key14 UNIQUE (phone);


--
-- Name: users users_phone_key15; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_phone_key15 UNIQUE (phone);


--
-- Name: users users_phone_key16; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_phone_key16 UNIQUE (phone);


--
-- Name: users users_phone_key17; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_phone_key17 UNIQUE (phone);


--
-- Name: users users_phone_key18; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_phone_key18 UNIQUE (phone);


--
-- Name: users users_phone_key19; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_phone_key19 UNIQUE (phone);


--
-- Name: users users_phone_key2; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_phone_key2 UNIQUE (phone);


--
-- Name: users users_phone_key20; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_phone_key20 UNIQUE (phone);


--
-- Name: users users_phone_key21; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_phone_key21 UNIQUE (phone);


--
-- Name: users users_phone_key22; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_phone_key22 UNIQUE (phone);


--
-- Name: users users_phone_key23; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_phone_key23 UNIQUE (phone);


--
-- Name: users users_phone_key24; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_phone_key24 UNIQUE (phone);


--
-- Name: users users_phone_key3; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_phone_key3 UNIQUE (phone);


--
-- Name: users users_phone_key4; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_phone_key4 UNIQUE (phone);


--
-- Name: users users_phone_key5; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_phone_key5 UNIQUE (phone);


--
-- Name: users users_phone_key6; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_phone_key6 UNIQUE (phone);


--
-- Name: users users_phone_key7; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_phone_key7 UNIQUE (phone);


--
-- Name: users users_phone_key8; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_phone_key8 UNIQUE (phone);


--
-- Name: users users_phone_key9; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_phone_key9 UNIQUE (phone);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: addresses_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX addresses_user_id_idx ON public.addresses USING btree (user_id);


--
-- Name: coupon_redemptions_coupon_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX coupon_redemptions_coupon_idx ON public.coupon_redemptions USING btree (coupon_id);


--
-- Name: coupon_redemptions_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX coupon_redemptions_order_idx ON public.coupon_redemptions USING btree (order_id);


--
-- Name: coupon_redemptions_user_coupon_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX coupon_redemptions_user_coupon_idx ON public.coupon_redemptions USING btree (user_id, coupon_id);


--
-- Name: coupons_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX coupons_active_idx ON public.coupons USING btree (is_active, visibility);


--
-- Name: coupons_code_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX coupons_code_idx ON public.coupons USING btree (code);


--
-- Name: order_items_order_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX order_items_order_id_idx ON public.order_items USING btree (order_id);


--
-- Name: order_items_product_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX order_items_product_id_idx ON public.order_items USING btree (product_id);


--
-- Name: orders_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX orders_created_at_idx ON public.orders USING btree ("createdAt");


--
-- Name: orders_delivered_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX orders_delivered_at_idx ON public.orders USING btree (delivered_at);


--
-- Name: orders_delivery_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX orders_delivery_date_idx ON public.orders USING btree (delivery_date);


--
-- Name: orders_driver_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX orders_driver_status_idx ON public.orders USING btree (driver_id, status);


--
-- Name: orders_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX orders_status_idx ON public.orders USING btree (status);


--
-- Name: orders_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX orders_user_id_idx ON public.orders USING btree (user_id);


--
-- Name: products_category_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX products_category_id_idx ON public.products USING btree (category_id);


--
-- Name: promo_logs_user_sent_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX promo_logs_user_sent_idx ON public.promo_notification_logs USING btree (user_id, sent_on);


--
-- Name: users_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_email_idx ON public.users USING btree (email);


--
-- Name: users_phone_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_phone_idx ON public.users USING btree (phone);


--
-- Name: users_role_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_role_idx ON public.users USING btree (role);


--
-- Name: variants_product_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX variants_product_id_idx ON public.product_variants USING btree (product_id);


--
-- Name: addresses addresses_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.addresses
    ADD CONSTRAINT addresses_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: coupon_redemptions coupon_redemptions_coupon_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupon_redemptions
    ADD CONSTRAINT coupon_redemptions_coupon_id_fkey FOREIGN KEY (coupon_id) REFERENCES public.coupons(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: coupon_redemptions coupon_redemptions_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupon_redemptions
    ADD CONSTRAINT coupon_redemptions_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: coupon_redemptions coupon_redemptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupon_redemptions
    ADD CONSTRAINT coupon_redemptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: order_items order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: order_items order_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON UPDATE CASCADE;


--
-- Name: order_items order_items_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id) ON UPDATE CASCADE;


--
-- Name: orders orders_coupon_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_coupon_id_fkey FOREIGN KEY (coupon_id) REFERENCES public.coupons(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: orders orders_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: orders orders_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: product_variants product_variants_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_variants
    ADD CONSTRAINT product_variants_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: products products_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: seller_bill_items seller_bill_items_bill_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seller_bill_items
    ADD CONSTRAINT seller_bill_items_bill_id_fkey FOREIGN KEY (bill_id) REFERENCES public.seller_bills(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: seller_bill_items seller_bill_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seller_bill_items
    ADD CONSTRAINT seller_bill_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON UPDATE CASCADE;


--
-- Name: support_tickets support_tickets_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: support_tickets support_tickets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--


