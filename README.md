# HarvestHub

HarvestHub is a web application for managing garden allotment waiting list and assignments. It allows users to register, login, and make plot requests, while admins can manage users and plot assignments.

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Installation](#installation)
- [Running the Application](#running-the-application)
- [License](#license)

## Features

- User registration and login
- Plot request management
- Admin dashboard for managing users and assignments
- Responsive UI using Bootstrap

## Tech Stack

- **Frontend**: HTML, CSS, JavaScript, Bootstrap
- **Backend**: Node.js, Express.js, EJS
- **Database**: PostgreSQL

## Dependencies

This project uses the following dependencies:

- **dotenv**: ^16.4.5
- **express**: ^4.19.2
- **pg**: ^8.11.5

Ensure you have the correct versions of these packages installed to avoid compatibility issues.

## Installation

Follow these steps to set up the project locally:

1. **Clone the repository**:
   ```sh
   git clone https://github.com/yourusername/harvesthub.git
   cd harvesthub

2. **Install Node.js and npm**:
Make sure you have Node.js and npm installed. You can download them from here, https://nodejs.org/.
Node.js (v22.x or higher)
npm is included with Node.js
    ```sh
    npm install

3. **Install Dependencies**:
    ```sh
    npm i pg
    npm i express
    npm i dotenv

4. **Install PostgreSQL**:
PostgreSQL (v15.x or higher)

5. **Set up the PostgreSQL database**:
Create a database named HarvestHub.
    ```sh
    createdb harvesthub

Create a user with the necessary privileges.
Create a .env file in the project root and add the following environment variables:

6. **Create a .env file in the project root and add the following environment variables**:
    ```sh
    DB_HOST=localhost
    DB_USER=your_db_user
    DB_PASSWORD=your_db_password
    DB_NAME=HarvestHub
    DB_PORT=5432

7. **Set up the database schema**:
Use the provided SQL script to set up the database schema. Open your PostgreSQL client, connect to the harvesthub database, and run the following script:
    ```sh
    -- PostgreSQL database schema setup for HarvestHub

    -- Set up encoding and other configurations
    SET statement_timeout = 0;
    SET lock_timeout = 0;
    SET idle_in_transaction_session_timeout = 0;
    SET client_encoding = 'UTF8';
    SET standard_conforming_strings = on;
    SELECT pg_catalog.set_config('search_path', '', false);
    SET check_function_bodies = false;
    SET xmloption = content;
    SET client_min_messages = warning;
    SET row_security = off;

    SET default_tablespace = '';

    SET default_table_access_method = heap;

    -- Create tables
    CREATE TABLE public.assignments (
        assignment_id integer NOT NULL,
        user_id integer,
        plot_id integer,
        assigned_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
        status character varying(20),
        CONSTRAINT chk_status CHECK (((status)::text = ANY ((ARRAY['Active'::character varying, 'Waiting'::character varying, 'Pending'::character varying, 'Completed'::character varying])::text[])))
    );

    CREATE SEQUENCE public.assignments_assignment_id_seq
        AS integer
        START WITH 1
        INCREMENT BY 1
        NO MINVALUE
        NO MAXVALUE
        CACHE 1;

    ALTER SEQUENCE public.assignments_assignment_id_seq OWNED BY public.assignments.assignment_id;

    ALTER TABLE ONLY public.assignments ALTER COLUMN assignment_id SET DEFAULT nextval('public.assignments_assignment_id_seq'::regclass);

    ALTER TABLE public.assignments OWNER TO postgres;

    CREATE TABLE public.plots (
        plot_id integer NOT NULL,
        plot_location character varying(3),
        plot_area character varying(10),
        plot_size character varying(10)
    );

    CREATE SEQUENCE public.plots_id_seq
        AS integer
        START WITH 1
        INCREMENT BY 1
        NO MINVALUE
        NO MAXVALUE
        CACHE 1;

    ALTER SEQUENCE public.plots_id_seq OWNED BY public.plots.plot_id;

    ALTER TABLE ONLY public.plots ALTER COLUMN plot_id SET DEFAULT nextval('public.plots_id_seq'::regclass);

    ALTER TABLE public.plots OWNER TO postgres;

    CREATE TABLE public.users (
        user_id integer NOT NULL,
        first_name character varying(20),
        last_name character varying(20),
        email character varying(30) NOT NULL,
        is_admin boolean DEFAULT false,
        password character varying(25) NOT NULL
    );

    CREATE SEQUENCE public.users_id_seq
        AS integer
        START WITH 1
        INCREMENT BY 1
        NO MINVALUE
        NO MAXVALUE
        CACHE 1;

    ALTER SEQUENCE public.users_id_seq OWNED BY public.users.user_id;

    ALTER TABLE ONLY public.users ALTER COLUMN user_id SET DEFAULT nextval('public.users_id_seq'::regclass);

    ALTER TABLE public.users OWNER TO postgres;

    CREATE TABLE public.waitings (
        waiting_id integer NOT NULL,
        user_id integer,
        request_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
        plot_size character varying(10),
        CONSTRAINT waitings_plot_size_check CHECK (((plot_size)::text = ANY ((ARRAY['small'::character varying, 'medium'::character varying, 'large'::character varying])::text[])))
    );

    CREATE SEQUENCE public.waiting_waiting_id_seq
        AS integer
        START WITH 1
        INCREMENT BY 1
        NO MINVALUE
        NO MAXVALUE
        CACHE 1;

    ALTER SEQUENCE public.waiting_waiting_id_seq OWNED BY public.waitings.waiting_id;

    ALTER TABLE ONLY public.waitings ALTER COLUMN waiting_id SET DEFAULT nextval('public.waiting_waiting_id_seq'::regclass);

    ALTER TABLE public.waitings OWNER TO postgres;

    -- Add primary keys
    ALTER TABLE ONLY public.assignments
        ADD CONSTRAINT assignments_pkey PRIMARY KEY (assignment_id);

    ALTER TABLE ONLY public.plots
        ADD CONSTRAINT plots_pkey PRIMARY KEY (plot_id);

    ALTER TABLE ONLY public.users
        ADD CONSTRAINT users_pkey PRIMARY KEY (user_id);

    ALTER TABLE ONLY public.waitings
        ADD CONSTRAINT waiting_pkey PRIMARY KEY (waiting_id);

    -- Add unique constraints
    ALTER TABLE ONLY public.users
        ADD CONSTRAINT email_unique UNIQUE (email);

    -- Add foreign keys
    ALTER TABLE ONLY public.assignments
        ADD CONSTRAINT assignments_plot_id_fkey FOREIGN KEY (plot_id) REFERENCES public.plots(plot_id);

    ALTER TABLE ONLY public.assignments
        ADD CONSTRAINT assignments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id);

    ALTER TABLE ONLY public.waitings
        ADD CONSTRAINT waiting_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id);

    -- Reset sequences based on the current max value in the table
    DO $$ 
    BEGIN 
    EXECUTE 'ALTER SEQUENCE public.users_id_seq RESTART WITH ' || (SELECT COALESCE(MAX(user_id), 0) + 1 FROM public.users);
    EXECUTE 'ALTER SEQUENCE public.plots_id_seq RESTART WITH ' || (SELECT COALESCE(MAX(plot_id), 0) + 1 FROM public.plots);
    EXECUTE 'ALTER SEQUENCE public.assignments_assignment_id_seq RESTART WITH ' || (SELECT COALESCE(MAX(assignment_id), 0) + 1 FROM public.assignments);
    EXECUTE 'ALTER SEQUENCE public.waiting_waiting_id_seq RESTART WITH ' || (SELECT COALESCE(MAX(waiting_id), 0) + 1 FROM public.waitings);
    END $$;


8. **Sample Data**:
Optionally, you can populate your database with sample data for testing purposes. Run the following SQL script:
    ```sh
    -- Insert sample users
    INSERT INTO users (first_name, last_name, email, password, is_admin) VALUES
    ('John', 'Doe', 'admin1@example.com', '123456', true),
    ('Jane', 'Smith', 'admin2@example.com', '123456', true),
    ('Alice', 'Johnson', 'user1@example.com', '123456', false),
    ('Bob', 'Brown', 'user2@example.com', '123456', false);

    -- Insert sample plots
    INSERT INTO plots (plot_id, plot_location, plot_area, plot_size) VALUES
    (1, 'A1', '50 sqm', 'small'),
    (2, 'A2', '50 sqm', 'small'),
    (3, 'A3', '50 sqm', 'small'),
    (4, 'A4', '50 sqm', 'small'),
    (5, 'B1', '100 sqm', 'medium'),
    (6, 'B2', '100 sqm', 'medium'),
    (7, 'C1', '150 sqm', 'large'),
    (8, 'C2', '150 sqm', 'large');

## Running the Application

1. **Start the PostgreSQL server**:
Ensure your PostgreSQL server is running.

2. **Start the Node.js server**:
    ```sh
    node index.js

3. **Access the application**:
Open your web browser and go to http://localhost:3000.

## License
This project is licensed under the MIT License - see the LICENSE file for details.


